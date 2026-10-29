import { Suspense } from "react";
import { Login } from "@/components/login";

export const metadata = { title: "Sign in · MyJooba" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
