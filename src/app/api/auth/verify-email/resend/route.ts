import { connection } from "next/server";
import { authRoute } from "@/server/auth/runtime";
export const POST=async(request:Request)=>{await connection();return authRoute("action",request,['verify-email', 'resend']);};
