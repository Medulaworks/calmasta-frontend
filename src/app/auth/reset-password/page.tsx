import { Suspense } from "react";
import { SkeletonForm } from "@/components/ui/skeleton";
import { AuthAccountAction } from "@/components/auth-account-action";
export const metadata={referrer:"no-referrer" as const};
export default function Page(){return <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16"><SkeletonForm label="Loading" /></main>}><AuthAccountAction kind="reset-password"/></Suspense>;}
