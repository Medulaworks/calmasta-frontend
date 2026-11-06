"use client";

import { CalendarDays } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AvailabilityTab } from "@/components/booking/availability-tab";
import { BookingsTab } from "@/components/booking/bookings-tab";
import { MeetingTypesTab } from "@/components/booking/meeting-types-tab";
import { PagesTab } from "@/components/booking/pages-tab";
import { Card } from "@/components/ui/card";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";

const TABS = ["bookings", "pages", "types", "availability"] as const;
type TabId = (typeof TABS)[number];

/** Where a host sets up booking and manages what guests have booked. */
export function BookingAdmin() {
  const router = useRouter();
  const asked = useSearchParams().get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(asked ?? "") ? (asked as TabId) : "bookings";
  return (
    <div className="space-y-5">
      <Tabs
        label="Booking"
        items={[{ id: "bookings", label: "Bookings" }, { id: "pages", label: "Pages" }, { id: "types", label: "Meeting types" }, { id: "availability", label: "Availability" }]}
        active={tab}
        onChange={(t) => router.replace(t === "bookings" ? "/dashboard/booking" : `/dashboard/booking?tab=${t}`, { scroll: false })}
      />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface/40 px-4 py-2.5 text-xs text-muted">
          <CalendarDays aria-hidden className="h-3.5 w-3.5" />
          <span>Your booking calendar — bookings here also appear in Calendar</span>
        </div>
        <div className="p-4 sm:p-5" role="tabpanel" id={tabPanelId(tab)} aria-labelledby={tabId(tab)}>
          {tab === "bookings" && <BookingsTab />}
          {tab === "pages" && <PagesTab />}
          {tab === "types" && <MeetingTypesTab />}
          {tab === "availability" && <AvailabilityTab />}
        </div>
      </Card>
    </div>
  );
}
