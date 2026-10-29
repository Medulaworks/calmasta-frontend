import { connection } from "next/server";
import { consumeAuthError } from "@/server/auth/flash";

export async function GET(request: Request) {
  await connection();
  return consumeAuthError(request, process.env.APP_URL?.startsWith("https:") ?? false);
}
