import * as oidc from "openid-client";
import type { AuthConfig } from "./config";
import type { AuthStore, SessionData } from "./store";
import { cookie, hashId, HttpError, opaqueId, readCookie, readJson, safeReturnTo, sameOrigin } from "./security";

type Profile = Record<string, unknown> & { subject: string; role: string; onboarded: boolean };
const headers = { "Cache-Control": "no-store", "Pragma": "no-cache" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
class LoginError extends Error {}

export class AuthService {
  private configuration?: Promise<oidc.Configuration>;
  constructor(private config: AuthConfig, private store: AuthStore) {}
  private oidc() {
    if (!this.configuration) {
      const execute = [oidc.enableNonRepudiationChecks];
      if (process.env.NODE_ENV === "test" && this.config.issuer.startsWith("http://127.0.0.1:")) execute.push(oidc.allowInsecureRequests);
      this.configuration = oidc.discovery(new URL(this.config.issuer), this.config.clientId,
        { id_token_signed_response_alg: "RS256" },
        this.config.clientSecret ? oidc.ClientSecretPost(this.config.clientSecret) : oidc.None(), { execute, timeout: 10 })
        .catch(error => { this.configuration = undefined; throw error; });
    }
    return this.configuration;
  }
  private setCookie(response: Response, name: string, value: string, age: number) {
    response.headers.append("Set-Cookie", cookie(name, value, this.config.secure, age));
    return response;
  }
  private redirect(path: string) {
    return new Response(null, { status: 303, headers: { ...headers, Location: new URL(path, this.config.appOrigin).href } });
  }
  private failure(code: string) { return this.redirect(`/login?error=${encodeURIComponent(code)}`); }
  private checkOrigin(request: Request) {
    if (!sameOrigin(request, this.config.appOrigin)) throw new HttpError(403, "Request origin not allowed");
  }
  async login(request: Request) {
    try {
      const configuration = await this.oidc();
      const query = new URL(request.url).searchParams;
      const transaction = { verifier: oidc.randomPKCECodeVerifier(), state: oidc.randomState(), nonce: oidc.randomNonce(), returnTo: safeReturnTo(query.get("returnTo")) };
      const id = opaqueId();
      const authorization = oidc.buildAuthorizationUrl(configuration, {
        response_type: "code", redirect_uri: this.config.callbackUrl,
        scope: `openid email profile offline_access urn:zitadel:iam:org:project:id:${this.config.projectId}:aud`,
        code_challenge: await oidc.calculatePKCECodeChallenge(transaction.verifier), code_challenge_method: "S256",
        state: transaction.state, nonce: transaction.nonce,
        ...(query.get("signup") === "1" ? { prompt: "create" } : query.get("prompt") === "login" ? { prompt: "login" } : {}),
      });
      const previous = readCookie(request, this.config.transactionCookie);
      if (previous) {
        try {
          await this.store.consumeTransaction(hashId(previous));
        } catch {
          // Failure to consume an old cookie must never block initiating a new login.
        }
      }
      await this.store.putTransaction(hashId(id), transaction);
      return this.setCookie(new Response(null, { status: 303, headers: { ...headers, Location: authorization.href } }), this.config.transactionCookie, id, 600);
    } catch (error) {
      console.error("[AUTH_LOGIN_ERROR]", error instanceof Error ? error.message : error);
      return this.failure("not_configured");
    }
  }
  async callback(request: Request) {
    let response: Response;
    try {
      const id = readCookie(request, this.config.transactionCookie);
      const transaction = id ? await this.store.consumeTransaction(hashId(id)) : null;
      if (!transaction) throw new LoginError("login_expired");
      const callback = new URL(this.config.callbackUrl);
      callback.search = new URL(request.url).search;
      if (callback.searchParams.getAll("state").length !== 1 || callback.searchParams.get("state") !== transaction.state) throw new LoginError("invalid_response");
      const error = callback.searchParams.get("error");
      if (error) throw new LoginError(error === "access_denied" ? "access_denied" : "idp_error");
      const configuration = await this.oidc();
      const tokens = await oidc.authorizationCodeGrant(configuration, callback, {
        pkceCodeVerifier: transaction.verifier, expectedState: transaction.state, expectedNonce: transaction.nonce, idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims?.sub || !tokens.id_token) throw new LoginError("invalid_response");
      const info = await oidc.fetchUserInfo(configuration, tokens.access_token, claims.sub);
      if (typeof info.email !== "string" || !info.email.trim() || info.email.length > 320) throw new LoginError("no_email");
      if (info.email_verified !== true) throw new LoginError("email_unverified");
      const apiToken = tokens.access_token.split(".").length === 3 || process.env.NODE_ENV === "test" ? tokens.access_token : tokens.id_token;
      const session: SessionData = {
        subject: claims.sub, accessToken: apiToken, refreshToken: tokens.refresh_token,
        idToken: tokens.id_token, accessExpiresAt: Date.now() + (tokens.expires_in ?? 60) * 1000,
        email: info.email, emailVerified: true, identityName: typeof info.name === "string" ? info.name.slice(0, 200) : null,
      };
      // This validates the API token/audience and provisions local identity before the session FK is written.
      const profile = await this.profile(session);
      const sessionId = opaqueId();
      await this.store.putSession(hashId(sessionId), session, Date.now() + 8 * 3600_000);
      const previous = readCookie(request, this.config.sessionCookie);
      if (previous) await this.store.revoke(hashId(previous), false);
      response = this.setCookie(this.redirect(profile.onboarded ? transaction.returnTo : "/welcome"), this.config.sessionCookie, sessionId, 8 * 3600);
    } catch (error) {
      console.error("[AUTH_CALLBACK_ERROR]", error instanceof Error ? `${error.name}: ${error.message}` : error);
      response = this.failure(error instanceof LoginError ? error.message : "invalid_response");
    }
    return this.setCookie(response, this.config.transactionCookie, "", 0);
  }
  private async session(request: Request) {
    const id = readCookie(request, this.config.sessionCookie);
    if (!id) return null;
    return this.store.session(hashId(id), async previous => {
      if (previous.accessExpiresAt > Date.now() + 30_000) return previous;
      if (!previous.refreshToken) return null;
      try {
        const tokens = await oidc.refreshTokenGrant(await this.oidc(), previous.refreshToken);
        const claims = tokens.claims();
        if (claims && claims.sub !== previous.subject) return null;
        const nextIdToken = tokens.id_token ?? previous.idToken;
        const nextApiToken = tokens.access_token.split(".").length === 3 || process.env.NODE_ENV === "test" ? tokens.access_token : nextIdToken;
        return { ...previous, accessToken: nextApiToken, refreshToken: tokens.refresh_token ?? previous.refreshToken,
          idToken: nextIdToken, accessExpiresAt: Date.now() + (tokens.expires_in ?? 60) * 1000 };
      } catch { return null; }
    });
  }
  private async api(session: SessionData, path: string, method = "GET", body?: Record<string, unknown>, idempotencyKey?: string) {
    const requestHeaders: Record<string, string> = { Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" };
    if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
    if (idempotencyKey) requestHeaders["Idempotency-Key"] = idempotencyKey;
    return fetch(new URL(path, this.config.apiOrigin), { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  }
  private async profile(session: SessionData): Promise<Profile> {
    const response = await this.api(session, "/account/me");
    if (!response.ok) throw new HttpError(response.status === 401 ? 401 : 502, `Account is unavailable (status=${response.status})`);
    const profile = await response.json() as Profile;
    if (profile.subject !== session.subject) throw new HttpError(401, "Account identity mismatch");
    return profile;
  }
  private view(profile: Profile, session: SessionData) {
    // Browser's legacy role means profession. Workspace authorization is explicitly separate.
    return { ...profile, role: profile.profession ?? null, workspaceRole: profile.role,
      email: session.email, emailVerified: session.emailVerified, name: profile.name };
  }
  async me(request: Request) {
    try {
      const method = request.method;
      if (method !== "GET" && method !== "PATCH") throw new HttpError(405, "Method not allowed");
      if (method === "PATCH") this.checkOrigin(request);
      const session = await this.session(request);
      if (!session) return this.unauthorized();
      if (method === "GET") return json(this.view(await this.profile(session), session));
      const input = await readJson(request);
      const allowed = new Set(["role", "name", "timezone", "outputsOnly", "complete"]);
      if (Object.keys(input).some(key => !allowed.has(key))) throw new HttpError(400, "Unknown profile field");
      const patch = { ...input };
      if ("role" in patch) { patch.profession = patch.role; delete patch.role; }
      const response = await this.api(session, "/account/me", "PATCH", patch);
      const body = await response.json();
      if (response.status === 401) return this.unauthorized();
      return response.ok ? json(this.view(body as Profile, session)) : json({ error: response.status === 400 ? "Invalid profile update" : "Profile update failed" }, response.status);
    } catch (error) { return this.error(error); }
  }
  async proxy(request: Request, segments: string[]) {
    try {
      if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(request.method)) throw new HttpError(405, "Method not allowed");
      if (request.method !== "GET") this.checkOrigin(request);
      const allowed = new Set(["uploads", "jobs", "usage", "account", "dashboard", "captures", "documents", "library", "calendar", "booking", "plan", "admin", "notifications"]);
      if (!allowed.has(segments[0]) || segments.some(s => !/^[A-Za-z0-9_-]+$/.test(s))) throw new HttpError(404, "API route not found");
      const session = await this.session(request);
      if (!session) return this.unauthorized();
      const transcriptEdit=request.method==="PATCH"&&segments.length===4&&segments[0]==="library"&&segments[1]==="captures"&&segments[3]==="transcript";
      const body = request.method === "GET" || request.method === "DELETE" && !request.body ? undefined : await readJson(request,transcriptEdit?262144:16384);
      const url = new URL(request.url);
      const upstream = await this.api(session, "/" + segments.map(encodeURIComponent).join("/") + url.search, request.method, body, request.headers.get("idempotency-key") ?? undefined);
      if (upstream.status === 401) return this.unauthorized();
      if (upstream.status === 204) return new Response(null, { status: 204, headers });
      const result = await upstream.json().catch(() => ({ error: "Invalid API response" }));
      return json(result, upstream.status);
    } catch (error) { return this.error(error); }
  }
  async logout(request: Request) {
    try {
      this.checkOrigin(request);
      const body = await readJson(request);
      if (Object.keys(body).some(key => key !== "all") || body.all !== undefined && typeof body.all !== "boolean") throw new HttpError(400, "Invalid logout request");
      const id = readCookie(request, this.config.sessionCookie);
      const sessions = id ? await this.store.revoke(hashId(id), body.all === true) : [];
      let redirectTo = this.config.appOrigin + "/login", providerRevocation = "not_requested";
      if (sessions.length) {
        try {
          const configuration = await this.oidc();
          // Local deletion succeeds even if the provider is unavailable. Never claim global IdP logout.
          const results = await Promise.allSettled(sessions.flatMap(session => [session.accessToken, session.refreshToken].filter((t): t is string => Boolean(t)).map(token => oidc.tokenRevocation(configuration, token))));
          providerRevocation = results.every(result => result.status === "fulfilled") ? "completed" : "failed";
          const current = sessions[0];
          if (configuration.serverMetadata().end_session_endpoint) redirectTo = oidc.buildEndSessionUrl(configuration, {
            id_token_hint: current.idToken, post_logout_redirect_uri: this.config.appOrigin + "/login",
          }).href;
        } catch { providerRevocation = "failed"; }
      }
      const response = json({ redirectTo, scope: body.all === true ? "all_calmasta_sessions" : "current_session", providerRevocation });
      this.setCookie(response, this.config.sessionCookie, "", 0);
      return this.setCookie(response, this.config.transactionCookie, "", 0);
    } catch (error) { return this.error(error); }
  }
  private unauthorized() {
    return this.setCookie(json({ error: "Your session expired. Please sign in again." }, 401), this.config.sessionCookie, "", 0);
  }
  private error(error: unknown) {
    if (error instanceof HttpError && error.status === 401) return this.unauthorized();
    return json({ error: error instanceof HttpError ? error.message : "Authentication service unavailable" }, error instanceof HttpError ? error.status : 503);
  }
}
