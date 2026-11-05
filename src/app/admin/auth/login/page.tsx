import type { Metadata } from "next";
import { Suspense } from "react";
import { Login } from "@/components/login";

export const metadata: Metadata = {
  title: "Admin sign in · Jooba",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <Login defaultReturnTo="/admin" admin />
    </Suspense>
  );
}
