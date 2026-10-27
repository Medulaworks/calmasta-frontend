import { connection } from "next/server";
import { authRoute } from "@/server/auth/runtime";
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  await connection();
  return authRoute("proxy", request, (await context.params).path);
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
