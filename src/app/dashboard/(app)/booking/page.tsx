import { Suspense } from "react";
import { BookingAdmin } from "@/components/booking/booking-admin";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Booking · MyJooba" };

export default function BookingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking"
        description="Let people book time with you, without an account. Share a page, set your hours, and see who has booked."
      />
      <Suspense fallback={null}>
        <BookingAdmin />
      </Suspense>
    </div>
  );
}
