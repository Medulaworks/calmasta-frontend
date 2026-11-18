"use client";

import { ExternalLink, LogOut, ShieldAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Brand } from "@/components/ui/brand";
import { Loading, Skeleton, SkeletonPanel } from "@/components/ui/skeleton";
import { adminGet } from "@/lib/admin-client";
import { clearCapabilities, loadCapabilities } from "@/lib/admin-capabilities";
import { ApiError } from "@/lib/upload-client";
import { NAV_GROUPS, SECTIONS, sectionFor } from "./admin-nav";

type AdminProfile = { name: string | null; email: string };
type Check = { state: "checking" } | { state: "failed" } | { state: "denied" } | { state: "ready"; profile: AdminProfile };

/** Uses the isolated admin session; the backend checks staff access on every admin endpoint. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const [check, setCheck] = useState<Check>({ state: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    clearCapabilities();
    adminGet<AdminProfile>("/api/admin/me").then(async (profile) => {
      if (cancelled) return;
      await loadCapabilities(controller.signal);
      return profile;
    }).then(
      (profile) => {
        if (cancelled || !profile) return;
        setCheck({ state: "ready", profile });
      },
      (err) => {
        if (cancelled) return;
        clearCapabilities();
        if (err instanceof ApiError && err.status === 401) router.replace(`/admin/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
        else if (err instanceof ApiError && err.status === 403) setCheck({ state: "denied" });
        else setCheck({ state: "failed" });
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
      clearCapabilities();
    };
  }, [router, attempt]);

  async function logoutAdmin() {
    clearCapabilities();
    try { await fetch("/api/admin/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}), credentials: "same-origin" }); } catch {}
    router.replace("/admin/auth/login");
  }

  const profile = check.state === "ready" ? check.profile : null;
  const notStaff = check.state === "denied";

  if (notStaff || check.state === "failed") {
    return (
      <main id="main" className="grid min-h-dvh place-items-center bg-surface px-4">
        <div role="alert" className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-background p-6 text-center shadow-[0_24px_60px_-28px_rgb(0_0_0/0.3)]">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface text-muted">
            <ShieldAlert className="size-6" />
          </span>
          {check.state === "failed" ? (
            <>
              <h1 className="text-xl font-semibold">Couldn&rsquo;t check your access</h1>
              <p className="text-sm text-muted">Something went wrong. Try again.</p>
              <div className="flex justify-center gap-2 pt-1">
                <Button variant="primary" onClick={() => { setCheck({ state: "checking" }); setAttempt((n) => n + 1); }}>Try again</Button>
                <Link href="/dashboard" className={buttonClass("secondary")}>Back to Joobah</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">You don&rsquo;t have access to this area</h1>
              <p className="text-sm text-muted">
                {profile?.email ? <><span className="font-medium text-foreground">{profile.email}</span> isn&rsquo;t an admin.</> : "This account isn’t an admin."} Ask an admin for access.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Link href={`/admin/auth/login?returnTo=${encodeURIComponent(pathname)}`} className={buttonClass("primary")}>Sign in as an admin</Link>
                <Link href="/dashboard" className={buttonClass("secondary")}>Back to Joobah</Link>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  const name = profile?.name || profile?.email || "";
  const link = (id: string) => SECTIONS.find((x) => x.id === id)!;
  const item = (active: boolean) =>
    `group relative flex h-9 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 text-sm transition-colors ${active ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white"}`;

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      {/* The side menu: dark, grouped, with the Joobah logo and an Admin tag. */}
      <aside className="relative isolate flex flex-col overflow-hidden bg-[#1d0a10] p-3 text-white md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-56">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 -z-10 size-64 rounded-full bg-accent/60 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 -z-10 size-56 rounded-full bg-accent-solid/15 blur-3xl" />

        <div className="flex shrink-0 items-center justify-between gap-2 px-2 md:py-1">
          <p className="flex items-center gap-2.5">
            <Brand size={24} tile="paper" />
            <span className="rounded-md bg-accent-solid px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#1d0a10]">Admin</span>
          </p>
          <div className="flex items-center gap-1 md:hidden">
            <a href="/dashboard" target="_blank" rel="noopener noreferrer" aria-label="Open Joobah (opens in a new tab)" title="Open Joobah" className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"><ExternalLink aria-hidden className="size-[18px]" /></a>
            <button type="button" onClick={() => { void logoutAdmin(); }} aria-label="Log out" title="Log out" className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"><LogOut aria-hidden className="size-[18px]" /></button>
          </div>
        </div>

        <nav aria-label="Admin" className="mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-3 md:mt-4 md:min-h-0 md:flex-1 md:flex-col md:gap-3 md:overflow-y-auto md:overflow-x-hidden md:px-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="flex gap-1 md:flex-col">
              <p className="hidden px-2.5 pb-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/40 md:block">{g.label}</p>
              {g.ids.map((id) => {
                const { label, Icon, tabs } = link(id);
                const active = current?.id === id;
                return (
                  <Link key={id} href={tabs[0].href} aria-current={active ? "page" : undefined} className={item(active)}>
                    {active && <span aria-hidden className="absolute -left-3 top-2 hidden h-5 w-1 rounded-r-full bg-accent-solid md:block" />}
                    <Icon aria-hidden className={`size-[18px] shrink-0 ${active ? "text-accent-solid" : ""}`} />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
          <Link href="/admin/profile" aria-current={pathname === "/admin/profile" ? "page" : undefined} className={`${item(pathname === "/admin/profile")} md:hidden`}>
            <UserRound aria-hidden className="size-[18px] shrink-0" /> My profile
          </Link>
        </nav>

        <div className="mt-3 hidden shrink-0 space-y-2 border-t border-white/10 pt-3 md:block">
          <a href="/dashboard" target="_blank" rel="noopener noreferrer" className="flex h-9 items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white">
            Open Joobah <ExternalLink aria-hidden className="size-4" /><span className="sr-only">(opens in a new tab)</span>
          </a>
          {profile && (
            <div className="flex items-center gap-2 px-0.5">
              <Link href="/admin/profile" aria-current={pathname === "/admin/profile" ? "page" : undefined} title={profile.email} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 transition-colors hover:text-white">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-solid text-sm font-semibold text-[#1d0a10]">{name.trim().charAt(0).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{name}</span>
                  <span className="block text-xs text-white/50">My profile</span>
                </span>
              </Link>
              <button type="button" onClick={() => { void logoutAdmin(); }} title="Log out" aria-label="Log out" className="grid size-8 shrink-0 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                <LogOut aria-hidden className="size-[18px]" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none md:ml-56">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {check.state === "checking" ? (
            <Loading label="Checking your access" className="space-y-5">
              <div aria-hidden className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
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
