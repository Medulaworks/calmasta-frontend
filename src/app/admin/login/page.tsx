import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/admin-login";

export const metadata: Metadata = {
  title: "Admin sign-in · Jooba",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLogin />
    </Suspense>
  );
}
