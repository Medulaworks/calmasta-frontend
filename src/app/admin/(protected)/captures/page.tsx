import { AdminHeader } from "@/components/admin/section-tabs";
import { CapturesView } from "@/components/admin/captures-view";

export const metadata = { title: "Recordings — Admin" };

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Recordings" description="Everything customers have recorded or uploaded. Select a row to see the full details." />
      <CapturesView />
    </div>
  );
}
