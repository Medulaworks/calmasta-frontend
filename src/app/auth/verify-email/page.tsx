import { Suspense } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { SkeletonForm } from "@/components/ui/skeleton";
import { VerifyEmail } from "@/components/verify-email";
export const metadata={referrer:"no-referrer" as const};
export default function Page(){return <Suspense fallback={<AuthLayout><SkeletonForm label="Loading" /></AuthLayout>}><VerifyEmail/></Suspense>;}
