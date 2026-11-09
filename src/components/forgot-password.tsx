"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AuthCodeForm } from "@/components/auth-code-form";
import { AuthLayout } from "@/components/auth-layout";

/** Password recovery: ask for a code by email, then choose a new password. Its own address, so a link or a refresh lands here. */
export function ForgotPassword() {
  const router = useRouter();
  const returnTo = useSearchParams().get("returnTo");
  const back = () => router.push(returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : "/auth/login");
  return (
    <AuthLayout>
      <AuthCodeForm purpose="recovery" initialEmail="" onBack={back} />
    </AuthLayout>
  );
}
