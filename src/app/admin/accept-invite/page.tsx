import { Suspense } from "react";
import AcceptInviteClient from "./client";

export const metadata = { title: "Accept invite · Jooba", robots: { index: false, follow: false } };

export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  // Do not propagate token via analytics/logs; strip from URL after reading
  return (
    <Suspense fallback={null}>
      <AcceptInviteClient initialToken={token} />
    </Suspense>
  );
}
