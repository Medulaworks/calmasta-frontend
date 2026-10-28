import { authConfig } from "./config";
import { ApiAuthStore } from "./store";
import { AuthService } from "./service";

// Session and transaction state are persisted via the backend API store.
let service: AuthService | undefined;
function getService() {
  if (!service) {
    const config = authConfig();
    service = new AuthService(config, new ApiAuthStore(config.apiOrigin, config.sessionSecret));
  }
  return service;
}
export async function authRoute(kind: "login" | "callback" | "logout" | "me" | "proxy", request: Request, segments: string[] = []) {
  try {
    const auth = getService();
    return kind === "proxy" ? auth.proxy(request, segments) : auth[kind](request);
  } catch (error) {
    console.error("[AUTH_RUNTIME_ERROR]", error instanceof Error ? error.message : error);
    // No request-derived host is trusted when configuration is missing.
    if (kind === "login" || kind === "callback") return new Response(null, { status: 303, headers: { Location: "/login?error=not_configured", "Cache-Control": "no-store" } });
    return Response.json({ error: "Sign-in is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
