"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AvailabilityTab } from "@/components/booking/availability-tab";
import { BookingsTab } from "@/components/booking/bookings-tab";
import { MeetingTypesTab } from "@/components/booking/meeting-types-tab";
import { PagesTab } from "@/components/booking/pages-tab";
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
      <div role="tabpanel" id={tabPanelId(tab)} aria-labelledby={tabId(tab)}>
        {tab === "bookings" && <BookingsTab />}
        {tab === "pages" && <PagesTab />}
        {tab === "types" && <MeetingTypesTab />}
        {tab === "availability" && <AvailabilityTab />}
      </div>
    </div>
  );
}
