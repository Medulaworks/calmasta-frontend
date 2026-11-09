import { Suspense } from "react";
import { ForgotPassword } from "@/components/forgot-password";

export const metadata = { title: "Reset your password · Jooba", referrer: "no-referrer" as const };

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPassword />
    </Suspense>
  );
}
