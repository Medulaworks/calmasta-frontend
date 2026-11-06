import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/admin-login";

export const metadata = {
  title: "Admin sign in · Jooba",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function LegacyAdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLogin />
    </Suspense>
  );
}
