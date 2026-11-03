import { redirect } from "next/navigation";
import { NAV } from "@/lib/nav-labels";

export const metadata = { title: `${NAV.join} · Jooba` };

type Props = {
  searchParams: Promise<{ tab?: string; link?: string }>;
};

export default async function CapturePage({ searchParams }: Props) {
  const params = await searchParams;
  // Preserve tab if explicitly requested, otherwise default to bot. Preserve meeting link if present.
  const tab = params.tab === "voice" ? "voice" : "bot";
  const query = new URLSearchParams();
  query.set("tab", tab);
  if (params.link) query.set("link", params.link);
  redirect(`/dashboard/voice?${query.toString()}`);
}
