import { PublicSharedView } from "@/components/sharing/shared-notes-view";

export async function generateMetadata() {
  return { title: "Shared notes", robots: { index: false, follow: false } };
}

export default function Page({ params }: { params: { token: string } }) {
  return <PublicSharedView token={params.token} />;
}
