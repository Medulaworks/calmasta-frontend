"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { sectionFor, tabActive } from "./admin-nav";

/** Links between the pages of one place (for example Billing). Hidden when a place has a single page. */
export function SectionTabs() {
  const pathname = usePathname();
  const tabs = sectionFor(pathname)?.tabs ?? [];
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

/** The top of every staff page: the title, then the tabs of the place it belongs to. */
export function AdminHeader(props: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PageHeader {...props} />
      <SectionTabs />
    </div>
  );
}
