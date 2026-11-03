import Link from "next/link";

const TABS = [
  { id: "bot", href: "/dashboard/voice?tab=bot", label: "Meeting Bot" },
  { id: "voice", href: "/dashboard/voice?tab=voice", label: "Voice Inbox" },
] as const;

/** The two ways to capture a conversation. Tab selection is persisted in the URL via ?tab=bot | ?tab=voice. */
export function CaptureTabs({ active }: { active: (typeof TABS)[number]["id"] }) {
  return (
    <nav aria-label="Meeting or voice note" className="flex gap-6 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-0.5 pb-3 pt-1 text-sm transition-colors ${
            t.id === active ? "border-accent-solid font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
