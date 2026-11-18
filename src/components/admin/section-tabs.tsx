"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { sectionFor, tabActive } from "./admin-nav";

/** Links between the pages of one place (for example Billing). Hidden when a place has a single page. */
export function SectionTabs() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  // Settings uses a left-sided vertical sub-nav instead of horizontal tabs.
  if (section?.id === "settings") return null;
  const tabs = section?.tabs ?? [];
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="In this section" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-background p-1 ring-1 ring-border [scrollbar-width:none]">
      {tabs.map((t) => {
        const on = tabActive(pathname, t);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors ${on ? "bg-accent font-medium text-background shadow-sm" : "text-muted hover:bg-surface hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The left menu inside Settings: every place an admin can set something, each with a line saying what is in it. */
export function SettingsSubNav() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (section?.id !== "settings") return null;
  const tabs = section.tabs as readonly { href: string; label: string; hint?: string; exact?: boolean }[];
  return (
    <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible">
      {tabs.map((t) => {
        const on = tabActive(pathname, t);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`block shrink-0 rounded-xl px-3.5 py-2.5 transition-colors lg:shrink ${on ? "bg-accent/10 ring-1 ring-accent/20" : "hover:bg-surface"}`}
          >
            <span className={`block whitespace-nowrap text-sm ${on ? "font-semibold text-accent" : "font-medium text-foreground"}`}>{t.label}</span>
            {t.hint && <span className="mt-0.5 hidden text-xs text-muted lg:block">{t.hint}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** The top of every staff page: the title, then the tabs of the place it belongs to. */
export function AdminHeader(props: { title: string; description?: string; actions?: React.ReactNode }) {
  const section = sectionFor(usePathname());
  return (
    <div className="space-y-4">
      {section && section.label !== props.title && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{section.label}</p>}
      <PageHeader {...props} />
      <SectionTabs />
    </div>
  );
}

/** Wrapper for Settings pages: page title on top, sticky compact vertical sub-nav on the left, content on the right. */
export function SettingsPageLayout({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} actions={actions} />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-60 lg:self-start">
          <SettingsSubNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
