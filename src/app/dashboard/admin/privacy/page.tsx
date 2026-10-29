import { PageHeader } from "@/components/ui/page-header";
import { PrivacyView } from "@/components/admin/privacy-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Privacy and audit" description="Account deletions and everything staff have done." />
      <PrivacyView />
    </div>
  );
}
