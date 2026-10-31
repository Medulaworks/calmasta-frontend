import { connection } from "next/server";
import { authConfig } from "@/server/auth/config";
import { ApiAuthStore } from "@/server/auth/store";
import { AuthService } from "@/server/auth/service";
export const POST = async (request: Request) => {
  await connection();
  const config = authConfig();
  const store = new ApiAuthStore(config.apiOrigin, config.sessionSecret);
  const service = new AuthService(config, store);
  return service.microsoftCallback(request);
};
export const GET = async (request: Request) => {
  await connection();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return Response.json({ error: "Missing code or state" }, { status: 400 });
  const config = authConfig();
  const store = new ApiAuthStore(config.apiOrigin, config.sessionSecret);
  const service = new AuthService(config, store);
  const synthetic = new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "", origin: config.appOrigin },
    body: JSON.stringify({ code, state }),
  });
  // Forward relevant headers for origin/client IP handling
  for (const h of ["x-forwarded-for", "x-forwarded-proto", "origin"]) {
    const v = request.headers.get(h);
    if (v) synthetic.headers.set(h, v);
  }
  return service.microsoftCallback(synthetic);
};
