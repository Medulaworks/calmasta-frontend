import { Suspense } from "react";
import { SkeletonForm } from "@/components/ui/skeleton";
import { EmailCodeVerification } from "@/components/email-code-verification";
export const metadata={referrer:"no-referrer" as const};
export default function Page(){return <Suspense fallback={<SkeletonForm label="Loading" />}><EmailCodeVerification/></Suspense>;}
