import { Suspense } from "react";
import { AuthAccountAction } from "@/components/auth-account-action";
export const metadata={referrer:"no-referrer" as const};
export default function Page(){return <Suspense fallback={<p>Loading…</p>}><AuthAccountAction kind="reset-password"/></Suspense>;}
