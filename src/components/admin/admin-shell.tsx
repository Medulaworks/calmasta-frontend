"use client";

import { ExternalLink, LogOut, ShieldAlert, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Loading, Skeleton, SkeletonPanel } from "@/components/ui/skeleton";
import { ADMIN_PREVIEW } from "@/lib/admin-preview";
import { ProfileError, type ProfileView, getProfile } from "@/lib/profile-client";
import { SECTIONS, sectionFor } from "./admin-nav";
import { leaveStaffArea, previewProfile } from "./staff-session";

type Check = { state: "checking" } | { state: "failed" } | { state: "ready"; profile: ProfileView };

/**
 * The staff area's own frame, separate from the customer app. Staff status comes from the server (the profile's
 * `isStaff`); this only decides what to SHOW. Every staff endpoint checks again, so hiding the page is not the security.
 * Not signed in goes to the staff sign-in; signed in but not staff sees a clear "no access" page that names the account.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const [check, setCheck] = useState<Check>(() => (ADMIN_PREVIEW ? { state: "ready", profile: previewProfile() } : { state: "checking" }));
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Preview mode (development only) opens the staff screens with sample data: no profile request, no staff check.
    if (ADMIN_PREVIEW) return;
    let cancelled = false;
    getProfile().then(
      (profile) => {
        if (cancelled) return;
        // On the staff list but the server says there is no admin sign-in yet (ordinary sign-in, or it ran out): ask for one.
        // A server that doesn't send `staffSession` at all has no separate admin sign-in, so the staff flag alone decides.
        if (profile.isStaff && profile.staffSession === false) router.replace(`/admin/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
        else setCheck({ state: "ready", profile });
      },
      (err) => {
        if (cancelled) return;
        if (err instanceof ProfileError && err.status === 401) router.replace(`/admin/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
        else setCheck({ state: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  async function signOut() {
    setSigningOut(true);
    // Leaves the staff area only. They stay signed in to Jooba itself.
    await leaveStaffArea();
    router.replace("/admin/login");
  }

  const profile = check.state === "ready" ? check.profile : null;
  const allowed = ADMIN_PREVIEW || !!profile?.isStaff;
  const notStaff = check.state === "ready" && !allowed;

  if (notStaff || check.state === "failed") {
    return (
      <main id="main" className="grid min-h-dvh place-items-center bg-surface px-4">
        <div role="alert" className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-background p-8 text-center shadow-[0_24px_60px_-28px_rgb(0_0_0/0.3)]">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface text-muted">
            <ShieldAlert className="size-6" />
          </span>
          {check.state === "failed" ? (
            <>
              <h1 className="text-xl font-semibold">Couldn&rsquo;t check your access</h1>
              <p className="text-sm text-muted">Something went wrong. Try again.</p>
              <div className="flex justify-center gap-2 pt-1">
                <Button variant="primary" onClick={() => { setCheck({ state: "checking" }); setAttempt((n) => n + 1); }}>Try again</Button>
                <Link href="/dashboard" className={buttonClass("secondary")}>Back to Jooba</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">You don&rsquo;t have access to this area</h1>
              <p className="text-sm text-muted">
                {profile?.email ? <><span className="font-medium text-foreground">{profile.email}</span> isn&rsquo;t an admin.</> : "This account isn't an admin."} Ask an admin for access.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Link href={`/admin/login?returnTo=${encodeURIComponent(pathname)}`} className={buttonClass("primary")}>Sign in as an admin</Link>
                <Link href="/dashboard" className={buttonClass("secondary")}>Back to Jooba</Link>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface/40 p-3 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-3 md:block md:py-2">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-danger-solid text-sm font-semibold text-white">S</span>
            Admin
          </p>
          {/* Opens the Jooba app in its own tab, so the staff area stays where it is. */}
          <a href="/dashboard" target="_blank" rel="noopener noreferrer" className="hidden h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground md:mt-4 md:flex">
            Open Jooba <ExternalLink aria-hidden className="size-3.5" /><span className="sr-only">(opens in a new tab)</span>
          </a>
          {/* On a phone the same two actions sit in the top bar as icons. */}
          <div className="flex items-center gap-1 md:hidden">
            <a href="/dashboard" target="_blank" rel="noopener noreferrer" aria-label="Open Jooba (opens in a new tab)" title="Open Jooba" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><ExternalLink aria-hidden className="size-[18px]" /></a>
            <button type="button" onClick={() => void signOut()} disabled={signingOut} aria-label="Log out" title="Log out" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-50"><LogOut aria-hidden className="size-[18px]" /></button>
          </div>
        </div>

        <nav aria-label="Admin" className="mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none] md:mt-4 md:flex-col">
          {SECTIONS.map(({ id, label, Icon, tabs }) => {
            const active = current?.id === id;
            return (
              <Link
                key={id}
                href={tabs[0].href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}>
                <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/dashboard/admin/profile"
            aria-current={pathname === "/dashboard/admin/profile" ? "page" : undefined}
            className={`flex h-9 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm transition-colors md:hidden ${pathname === "/dashboard/admin/profile" ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}>
            <UserRound aria-hidden className="h-[18px] w-[18px] shrink-0" />
            My profile
          </Link>
        </nav>

        <div className="mt-4 hidden border-t border-border pt-3 md:mt-auto md:block">
          {profile && (
            <Link
              href="/dashboard/admin/profile"
              aria-current={pathname === "/dashboard/admin/profile" ? "page" : undefined}
              title={profile.email}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface ${pathname === "/dashboard/admin/profile" ? "bg-accent/10" : ""}`}>
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">{(profile.name || profile.email).trim().charAt(0).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{profile.name || profile.email}</span>
                <span className="block text-xs text-muted">My profile</span>
              </span>
            </Link>
          )}
          <button type="button" onClick={() => void signOut()} disabled={signingOut} title="Log out of admin. You stay signed in to Jooba." className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-surface disabled:opacity-50">
            <LogOut aria-hidden className="size-4" /> {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {ADMIN_PREVIEW && (
            <p role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-medium">Preview mode:</span> sample data only. Nothing is sent to the server.
              </span>
            </p>
          )}
          {check.state === "checking" ? (
            <Loading label="Checking your access" className="space-y-6">
              <div aria-hidden className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3.5 w-72 max-w-full" />
              </div>
              <SkeletonPanel className="h-64" />
            </Loading>
          ) : (
            // Rendered only once we know, so a customer never sees a staff page flash. The staff endpoints refuse them anyway.
            children
          )}
        </div>
      </main>
    </div>
  );
}
