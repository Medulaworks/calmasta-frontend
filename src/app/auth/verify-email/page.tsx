import { Suspense } from "react";
import { EmailCodeVerification } from "@/components/email-code-verification";
export const metadata={referrer:"no-referrer" as const};
export default function Page(){return <Suspense fallback={<p>Loading…</p>}><EmailCodeVerification/></Suspense>;}
