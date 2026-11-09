import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface Crumb {
  label: string;
  /** Leave out for the page you are on. */
  href?: string;
}

/**
 * The standard way back. Shows where you are as a trail (My Folder / Recordings / Weekly sync): every earlier step is a link,
 * and the last one is the current page. Use it at the top of any page that sits inside another, instead of a "Go back" button.
 * It is a real link trail, so it works with the keyboard, in new tabs and for screen readers.
 */
export function Breadcrumb({ items, className = "" }: { items: readonly Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`min-w-0 ${className}`}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-2">
              {c.href && !last ? (
                <Link href={c.href} className="truncate rounded-md py-1 transition-colors hover:text-foreground focus-visible:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={`truncate py-1 ${last ? "max-w-[24rem] font-medium text-foreground" : ""}`}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted/60" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
