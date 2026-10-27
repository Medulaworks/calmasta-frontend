import { connection } from "next/server";
import { authRoute } from "@/server/auth/runtime";
export const GET = async (request: Request) => { await connection(); return authRoute("login", request); };
