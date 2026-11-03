import { CreditCard, House, ScrollText, Settings2, Users } from "lucide-react";

const A = "/dashboard/admin";

/**
 * The staff area in five places. Pages that belong together (all about money, all about people) share one place and
 * are reached by tabs inside it, so the side menu stays short and nobody has to learn our internal vocabulary.
 */
export const SECTIONS = [
  {
    id: "home",
    label: "Home",
    Icon: House,
    tabs: [
      { href: A, label: "Summary", exact: true },
      { href: `${A}/health`, label: "System status" },
    ],
  },
  {
    id: "users",
    label: "Users",
    Icon: Users,
    tabs: [
      { href: `${A}/customers`, label: "All users" },
      { href: `${A}/entitlements`, label: "Subscribers" },
      { href: `${A}/privacy`, label: "Deletion requests" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    Icon: CreditCard,
    tabs: [
      { href: `${A}/plans`, label: "Plans" },
      { href: `${A}/usage`, label: "Usage and cost" },
      { href: `${A}/dunning`, label: "Failed payments" },
      { href: `${A}/webhooks`, label: "Store messages" },
      { href: `${A}/reconciliation`, label: "Mismatches" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    Icon: Settings2,
    tabs: [
      { href: `${A}/settings`, label: "Limits and switches" },
      { href: `${A}/integrations`, label: "Connected services" },
      { href: `${A}/admins`, label: "Admins" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    Icon: ScrollText,
    tabs: [{ href: `${A}/audit`, label: "Activity" }],
  },
] as const;

type Tab = { href: string; label: string; exact?: boolean };

export const tabActive = (pathname: string, t: Tab) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`));

/** The place a path belongs to. An account page (/customers/<id>) belongs to Users. */
export function sectionFor(pathname: string) {
  return SECTIONS.find((s) => (s.tabs as readonly Tab[]).some((t) => tabActive(pathname, t))) ?? null;
}
