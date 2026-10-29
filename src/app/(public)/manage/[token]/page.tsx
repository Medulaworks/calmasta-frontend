import { Suspense } from "react";
import { SkeletonGuest } from "@/components/ui/skeleton";
import { ManageBooking } from "@/components/booking/manage-booking";

export const metadata = { title: "Your booking · Jooba" };

async function Manage(props: PageProps<"/manage/[token]">) {
  const { token } = await props.params;
  return <ManageBooking token={token} />;
}

export default function ManagePage(props: PageProps<"/manage/[token]">) {
  return (
    <Suspense
      fallback={<SkeletonGuest label="Loading" />}>
      <Manage {...props} />
    </Suspense>
  );
}
