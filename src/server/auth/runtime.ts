import { Pool } from "pg";
import { authConfig } from "./config";
import { PgAuthStore } from "./store";
import { AuthService } from "./service";

// Process-local client/pool only; session and transaction state live in PostgreSQL.
let service: AuthService | undefined;
function getService() {
  if (!service) {
    const config = authConfig();
    const pool = new Pool({ connectionString: config.databaseUrl, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 30000 });
    service = new AuthService(config, new PgAuthStore(pool, config.sessionSecret));
  }
  return service;
}
export async function authRoute(kind: "login" | "callback" | "logout" | "me" | "proxy", request: Request, segments: string[] = []) {
  try {
    const auth = getService();
    return kind === "proxy" ? auth.proxy(request, segments) : auth[kind](request);
  } catch {
    // No request-derived host is trusted when configuration is missing.
    if (kind === "login" || kind === "callback") return new Response(null, { status: 303, headers: { Location: "/login?error=not_configured", "Cache-Control": "no-store" } });
    return Response.json({ error: "Sign-in is not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
