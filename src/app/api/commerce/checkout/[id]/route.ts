import { connection } from "next/server";
import { authRoute } from "@/server/auth/runtime";
export const GET = async (req: Request, ctx: { params: Promise<{ id: string }> }) => { await connection(); const { id } = await ctx.params; return authRoute("proxy", req, ["commerce", "checkout", id]); };
