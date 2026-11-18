import { RecipientSharedView } from "@/components/sharing/shared-notes-view";

export default function Page({ params }: { params: { grantId: string } }) {
  return <RecipientSharedView grantId={params.grantId} />;
}
