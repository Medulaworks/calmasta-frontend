import { authConfig } from "./config";
import { ApiAuthStore } from "./store";
import { AuthService } from "./service";
import { authErrorRedirect } from "./flash";

// Session and transaction state are persisted via the backend API store.
let service: AuthService | undefined;
function getService() {
  if (!service) {
    const config = authConfig();
    service = new AuthService(config, new ApiAuthStore(config.apiOrigin, config.sessionSecret));
  }
  return service;
}
type AuthRouteKind = "login" | "callback" | "logout" | "me" | "proxy" | "register" | "action";

function logFailure(kind: AuthRouteKind, request: Request, segments: string[], status: number) {
  const action = segments.join("/");
  const endpoint = kind === "proxy" ? "/api/[...path]"
    : kind === "me" ? "/api/me"
    : kind === "action" ? ["forgot-password", "verify-reset-code", "reset-password", "verify-email", "verify-email/resend", "change-password"].includes(action) ? `/api/auth/${action}` : "/api/auth/[action]"
    : `/api/auth/${kind}`;
  const method = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(request.method) ? request.method : "UNKNOWN";
  console.error(JSON.stringify({ event: "auth_request_failed", method, endpoint, status }));
}

export async function authRoute(kind: AuthRouteKind, request: Request, segments: string[] = []) {
  try {
    const auth = getService();
    const response = kind === "proxy" ? await auth.proxy(request, segments)
      : kind === "action" ? await auth.action(request, segments.join("/"))
      : await auth[kind](request);
    if (response.status >= 500) logFailure(kind, request, segments, response.status);
    return response;
  } catch {
    logFailure(kind, request, segments, 503);
    // No request-derived host is trusted when configuration is missing.
    if ((kind === "login" && request.method === "GET") || kind === "callback") return authErrorRedirect("not_configured", process.env.APP_URL?.startsWith("https:") ?? false);
    return Response.json({ error: "Sign-in is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
