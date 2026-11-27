import { Suspense } from "react";
import AcceptInviteClient from "./client";

export const metadata = { title: "Accept invite · Joobah", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ token?: string | string[] }> };

async function AcceptInvitePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  // Do not propagate token via analytics/logs; strip from URL after reading
  return <AcceptInviteClient initialToken={token} />;
}

export default function Page(props: PageProps) {
  return (
    <Suspense fallback={null}>
      <AcceptInvitePage {...props} />
    </Suspense>
  );
}
