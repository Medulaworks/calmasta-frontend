import { CreditCard, House, ScrollText, Settings2, ShieldCheck, Users, Video } from "lucide-react";

const A = "/admin";

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
    id: "captures",
    label: "Recordings",
    Icon: Video,
    tabs: [{ href: `${A}/captures`, label: "Recordings" }],
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
      { href: `${A}/money`, label: "Payments" },
      { href: `${A}/usage`, label: "Credit usage" },
      { href: `${A}/webhooks`, label: "Store messages" },
      { href: `${A}/reconciliation`, label: "Mismatches" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    Icon: Settings2,
    tabs: [
      { href: `${A}/plans`, label: "Plans and pricing", hint: "Prices, hours, extra packs" },
      { href: `${A}/settings`, label: "Limits and switches", hint: "Recording, uploads, sharing, AI" },
      { href: `${A}/integrations`, label: "Connected services", hint: "Meeting bot, storage, email" },
      { href: `${A}/emails`, label: "Email templates", hint: "Subjects, body copy, and button text" },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    Icon: ScrollText,
    tabs: [{ href: `${A}/audit`, label: "Activity" }],
  },
  {
    id: "admins",
    label: "Admins",
    Icon: ShieldCheck,
    tabs: [{ href: `${A}/admins`, label: "Admins" }],
  },
] as const;

type Tab = { href: string; label: string; exact?: boolean; hint?: string };

export const tabActive = (pathname: string, t: Tab) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`));

/** The place a path belongs to. An account page (/customers/<id>) belongs to Users. */
export function sectionFor(pathname: string) {
  return SECTIONS.find((s) => (s.tabs as readonly Tab[]).some((t) => tabActive(pathname, t))) ?? null;
}

/** The side menu is grouped so it reads as a map of the staff area, not a flat list. */
export const NAV_GROUPS: ReadonlyArray<{ label: string; ids: ReadonlyArray<(typeof SECTIONS)[number]["id"]> }> = [
  { label: "Overview", ids: ["home"] },
  { label: "Customers", ids: ["users", "captures"] },
  { label: "Money", ids: ["billing"] },
  { label: "System", ids: ["settings", "activity", "admins"] },
];
