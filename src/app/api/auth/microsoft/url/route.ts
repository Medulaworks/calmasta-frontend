import { connection } from "next/server";
import { authConfig } from "@/server/auth/config";
import { ApiAuthStore } from "@/server/auth/store";
import { AuthService } from "@/server/auth/service";
export const POST = async (request: Request) => {
  await connection();
  const config = authConfig();
  const store = new ApiAuthStore(config.apiOrigin, config.sessionSecret);
  const service = new AuthService(config, store);
  return service.microsoftUrl(request);
};
