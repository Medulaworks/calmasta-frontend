import Link from "next/link";

const TABS = [
  { id: "voice", href: "/voice", label: "Voice Inbox" },
  { id: "meeting", href: "/capture", label: "Meeting Bot" },
] as const;

/** The two ways to capture a conversation. A link bar, not client state, so each tab is its own shareable page. */
export function CaptureTabs({ active }: { active: (typeof TABS)[number]["id"] }) {
  return (
    <nav aria-label="Capture type" className="flex gap-6 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm transition-colors ${
            t.id === active ? "border-accent-solid font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
