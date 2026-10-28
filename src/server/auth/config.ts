export interface AuthConfig {
  appOrigin: string; apiOrigin: string; issuer: string; clientId: string; clientSecret?: string;
  projectId: string; sessionSecret: string; databaseUrl?: string; secure: boolean;
  callbackUrl: string; sessionCookie: string; transactionCookie: string;
}
export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const required = (name: string) => { const value = env[name]?.trim(); if (!value) throw new Error(`Missing ${name}`); return value; };
  const url = (name: string, allowLoopback: boolean) => {
    const parsed = new URL(required(name));
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") throw new Error(`Invalid ${name}`);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(allowLoopback && local && parsed.protocol === "http:")) throw new Error(`${name} requires HTTPS`);
    return parsed.origin;
  };
  const appOrigin = url("APP_URL", env.NODE_ENV !== "production");
  // Same-host private HTTP is allowed; public HTTP would expose bearer tokens.
  const apiOrigin = url("CALMASTA_API_URL", true);
  const issuer = url("ZITADEL_ISSUER", env.NODE_ENV === "test");
  const sessionSecret = required("SESSION_SECRET");
  if (!/^[a-f\d]{64}$/i.test(sessionSecret)) throw new Error("Invalid SESSION_SECRET");
  const secure = appOrigin.startsWith("https:");
  return { appOrigin, apiOrigin, issuer, clientId: required("ZITADEL_CLIENT_ID"), clientSecret: env.ZITADEL_CLIENT_SECRET || undefined,
    projectId: required("ZITADEL_PROJECT_ID"), sessionSecret, databaseUrl: env.DATABASE_URL?.trim() || undefined, secure,
    callbackUrl: appOrigin + "/api/auth/callback", sessionCookie: secure ? "__Host-calmasta_session" : "calmasta_session",
    transactionCookie: secure ? "__Host-calmasta_oidc" : "calmasta_oidc" };
}
