import type { Metadata } from "next";
import { Brand } from "@/components/ui/brand";

// Booking pages are shared by link with people who have no account: no navigation, no sign-in, and not for search engines.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background px-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3 py-4">
          <Brand size={28} />
          <span aria-hidden className="h-5 w-px bg-border" />
          <span className="text-sm text-muted">Scheduling</span>
        </div>
      </header>
      <main className="px-4">{children}</main>
    </div>
  );
}
