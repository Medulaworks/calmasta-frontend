import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteAccept } from "@/components/admin/invite-accept";

export const metadata: Metadata = {
  title: "Admin invite · Jooba",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Invite({ params }: { params: PageProps<"/staff-invite/[token]">["params"] }) {
  const { token } = await params;
  return <InviteAccept token={token} />;
}

export default function Page({ params }: PageProps<"/staff-invite/[token]">) {
  return (
    <Suspense fallback={null}>
      <Invite params={params} />
    </Suspense>
  );
}
