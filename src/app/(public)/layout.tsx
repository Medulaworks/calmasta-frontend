import type { Metadata } from "next";

// Booking pages are shared by link with people who have no account: no navigation, no sign-in, and not for search engines.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center gap-2.5 px-4 py-3 text-sm font-semibold tracking-tight">
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-md bg-accent-solid text-xs font-bold text-white">C</span>
          CalMasta <span className="font-normal text-muted">scheduling</span>
        </div>
      </header>
      <main className="px-4">{children}</main>
    </div>
  );
}
