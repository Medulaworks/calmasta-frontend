import { Suspense } from "react";
import { Login } from "@/components/login";

export const metadata = { title: "Create your account · Jooba" };

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <Login mode="signup" />
    </Suspense>
  );
}
