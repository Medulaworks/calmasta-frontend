import type { Metadata } from "next";
import { Brand } from "@/components/ui/brand";

// Booking pages are shared by link with people who have no account: no navigation, no sign-in, and not for search engines.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 text-sm font-semibold tracking-tight">
          <Brand size={26} /> <span className="font-normal text-muted">scheduling</span>
        </div>
      </header>
      <main className="px-4">{children}</main>
    </div>
  );
}
