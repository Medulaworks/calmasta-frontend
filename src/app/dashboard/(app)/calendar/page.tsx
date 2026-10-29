import { Suspense } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Calendar · MyJooba" };

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Every meeting from your connected calendars and bookings, with detailed filters. Read-only: MyJooba shows your events but never changes them, and connecting a calendar never starts a recording."
      />
      <Suspense fallback={null}>
        <CalendarView />
      </Suspense>
    </div>
  );
}
