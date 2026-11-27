import { Suspense } from "react";
import AcceptInviteClient from "./client";

export const metadata = { title: "Accept invite · Joobah", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  // Do not propagate token via analytics/logs; strip from URL after reading
  return (
    <Suspense fallback={null}>
      <AcceptInviteClient initialToken={token} />
    </Suspense>
  );
}
