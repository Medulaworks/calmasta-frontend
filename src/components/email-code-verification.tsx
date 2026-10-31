"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthAccountAction } from "@/components/auth-account-action";
import { AuthLayout } from "@/components/auth-layout";
import { AuthCodeForm } from "@/components/auth-code-form";
export function EmailCodeVerification() {
  const params = useSearchParams();
  const [linkMode] = useState(() => params.has("token"));
  return linkMode ? <AuthAccountAction kind="verify-email" /> : <AuthLayout><AuthCodeForm purpose="verification" /></AuthLayout>;
}
