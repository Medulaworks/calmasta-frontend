"use client";

import { ArrowLeft, BellRing, Gauge, LayoutDashboard, ListChecks, ScrollText, Scale, ShieldCheck, Users, Webhook } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileError, type ProfileView, getProfile } from "@/lib/profile-client";

const NAV = [
  { href: "/admin", label: "Overview and jobs", Icon: LayoutDashboard, exact: true },
  { href: "/admin/customers", label: "Customers", Icon: Users },
  { href: "/admin/entitlements", label: "Entitlements", Icon: ShieldCheck },
  { href: "/admin/usage", label: "Usage and cost", Icon: Gauge },
  { href: "/admin/webhooks", label: "Webhook health", Icon: Webhook },
  { href: "/admin/reconciliation", label: "Reconciliation", Icon: Scale },
  { href: "/admin/dunning", label: "Dunning monitor", Icon: BellRing },
  { href: "/admin/privacy", label: "Privacy and audit", Icon: ScrollText },
] as const;

/**
 * The staff area's own frame, separate from the customer app. Staff status comes from the server (the profile's
 * `isStaff`); this only decides what to SHOW. Every staff endpoint checks again, so hiding the page is not the security.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{ ready: boolean; profile: ProfileView | null }>({ ready: false, profile: null });

  useEffect(() => {
    let cancelled = false;
    getProfile().then(
      (profile) => !cancelled && setState({ ready: true, profile }),
      (err) => {
        if (cancelled) return;
        if (err instanceof ProfileError && err.status === 401) router.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}&reason=expired`);
        else setState({ ready: true, profile: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router]);

  const denied = state.ready && !state.profile?.isStaff;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {!denied && (
        <aside className="border-b border-border bg-surface/40 p-3 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2 px-3 md:block md:py-2">
            <p className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-danger-solid text-sm font-semibold text-white">S</span>
              Staff area
            </p>
            <Link href="/dashboard" className="mt-0 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground md:mt-2">
              <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to Mojooba
            </Link>
          </div>
          <nav aria-label="Staff" className="mt-3 flex gap-1 overflow-x-auto md:mt-5 md:flex-col">
            {NAV.map(({ href, label, Icon, ...rest }) => {
              const active = "exact" in rest ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}
                >
                  <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          {state.profile && <p className="mt-4 hidden truncate px-1 text-xs text-muted md:block" title={state.profile.email}>Signed in as {state.profile.email}</p>}
        </aside>
      )}
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {!state.ready && (
            <div role="status" aria-label="Loading" aria-busy="true" className="space-y-6">
              <div aria-hidden className="space-y-2"><div className="h-6 w-48 animate-pulse rounded bg-border" /><div className="h-3.5 w-72 max-w-full animate-pulse rounded bg-border" /></div>
              <div aria-hidden className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
            </div>
          )}
          {denied && (
            <div role="alert" className="mx-auto mt-16 max-w-md space-y-3 text-center">
              <ListChecks aria-hidden className="mx-auto h-8 w-8 text-muted" />
              <h1 className="text-xl font-semibold">You don&rsquo;t have access to this area</h1>
              <p className="text-sm text-muted">The staff area is only for people on the staff list. If you think you should be able to open it, ask an administrator.</p>
              <Link href="/dashboard" className="inline-block font-medium text-accent underline underline-offset-2">Back to Mojooba</Link>
            </div>
          )}
          {/* Rendered but hidden until we know, so a customer never sees a staff page flash. The staff endpoints refuse them anyway. */}
          <div hidden={!state.ready || denied}>{children}</div>
        </div>
      </main>
    </div>
  );
}
