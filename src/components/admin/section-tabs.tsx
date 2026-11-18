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
    <nav aria-label="In this section" className="flex gap-5 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {tabs.map((t) => {
        const on = tabActive(pathname, t);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm transition-colors ${on ? "border-accent-solid font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Vertical left-sided sub-navigation for the Settings place (Connected services / Limits and switches — limits at bottom). */
export function SettingsSubNav() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (section?.id !== "settings") return null;
  const tabs = section.tabs;
  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
      {tabs.map((t) => {
        const on = tabActive(pathname, t);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-7 items-center rounded-md px-2.5 text-xs transition-colors ${on ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The top of every staff page: the title, then the tabs of the place it belongs to. */
export function AdminHeader(props: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="space-y-4">
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
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-44 lg:self-start">
          <SettingsSubNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
