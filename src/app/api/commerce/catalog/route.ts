import { connection } from "next/server";
import { authRoute } from "@/server/auth/runtime";
export const GET = async (req: Request) => { await connection(); return authRoute("proxy", req, ["commerce", "catalog"]); };
