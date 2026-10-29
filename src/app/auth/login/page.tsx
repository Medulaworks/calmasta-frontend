import { Suspense } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Login } from "@/components/login";

export const metadata = { title: "Sign in · Jooba" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLayout><SkeletonForm label="Loading" /></AuthLayout>}>
      <Login />
    </Suspense>
  );
}
