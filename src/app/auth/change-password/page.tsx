import { Suspense } from "react";
import { SkeletonForm } from "@/components/ui/skeleton";
import { AuthAccountAction } from "@/components/auth-account-action";
export const metadata={referrer:"no-referrer" as const};
export default function Page(){return <Suspense fallback={<SkeletonForm label="Loading" />}><AuthAccountAction kind="change-password"/></Suspense>;}
