"use client";

import {
  CalendarCheck,
  CalendarDays,
  Gauge,
  House,
  Library,
  Mic,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ACCOUNT_CHANGED,
  type DeletionView,
  type PlanSummary,
  fetchDeletion,
  fetchPlan,
} from "@/lib/plan-client";
import {
  ProfileError,
  type ProfileView,
  getProfile,
} from "@/lib/profile-client";
import { AccountBanners, SidebarPlanCard } from "./account-banners";
import { Brand } from "@/components/ui/brand";
import { ProfileProvider } from "./profile-context";
import { TopBar } from "./top-bar";
import { AppearanceProvider } from "@/components/theme/appearance-provider";

// Capture has two tabs (Voice Inbox, Meeting Bot) that live at /voice and /capture; the nav item covers both.
const NAV: readonly {
  href: string;
  label: string;
  Icon: typeof Mic;
  also?: readonly string[];
}[] = [
  { href: "/dashboard", label: "Home", Icon: House },
  {
    href: "/dashboard/voice",
    label: "Capture",
    Icon: Mic,
    also: ["/dashboard/capture"],
  },
  {
    href: "/dashboard/library",
    label: "Library",
    Icon: Library,
    also: ["/dashboard/captures"],
  },
  { href: "/dashboard/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/dashboard/booking", label: "Booking", Icon: CalendarCheck },
];

function NavLink({
  href,
  label,
  Icon,
  also = [],
  pathname,
  tone = "page",
}: {
  href: string;
  label: string;
  Icon: typeof Mic;
  also?: readonly string[];
  pathname: string;
  tone?: "page" | "sidebar";
}) {
  const active = [href, ...also].some(
    (base) =>
      pathname === base ||
      (base !== "/dashboard" && pathname.startsWith(`${base}/`)),
  );
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-9 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${tone === "sidebar" ? "sc:md:justify-center sc:md:px-0" : ""} ${
        tone === "sidebar"
          ? active
            ? "bg-sidebar-active font-medium text-sidebar-active-fg"
            : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-fg"
          : active
            ? "bg-accent/10 font-medium text-accent"
            : "text-muted hover:bg-surface hover:text-foreground"
      }`}>
      <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
      <span className={tone === "sidebar" ? "sc:md:sr-only" : ""}>{label}</span>
      {tone === "sidebar" && (
        // Names for the icon-only rail, shown on hover or keyboard focus.
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg sc:md:group-hover:block sc:md:group-focus-visible:block">
          {label}
        </span>
      )}
    </Link>
  );
}

/** What the page area shows until the profile is known: the shape of a page, not a blank. */
function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className="space-y-6">
      <div className="space-y-2" aria-hidden>
        <div className="h-6 w-48 jb-skel rounded bg-border" />
        <div className="h-3.5 w-80 max-w-full jb-skel rounded bg-border" />
      </div>
      <div aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 jb-skel rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
      <div
        aria-hidden
        className="h-64 jb-skel rounded-xl border border-border bg-surface"
      />
    </div>
  );
}

function HomeLink() {
  return (
    <Link
      href="/dashboard"
      aria-label="Jooba home"
      className="text-lg text-sidebar-fg">
      <Brand size={32} tile="paper" labelClassName="sc:md:hidden" />
    </Link>
  );
}

/**
 * The signed-in frame: navigation, user card and the first-time redirect to /welcome.
 * It fails open: if the profile can't be read (not signed in, offline) the app still renders and
 * each page shows its own error, so this can never lock anyone out of their data.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{
    ready: boolean;
    profile: ProfileView | null;
  }>({ ready: false, profile: null });

  useEffect(() => {
    let cancelled = false;
    getProfile().then(
      (profile) => {
        if (cancelled) return;
        if (!profile.onboarded) router.replace("/dashboard/welcome");
        else setState({ ready: true, profile });
      },
      (err) => {
        if (cancelled) return;
        // No (or an expired) session: go and sign in, then come back to this page.
        if (err instanceof ProfileError && err.status === 401) {
          const here = window.location.pathname + window.location.search;
          router.replace(
            `/auth/login?returnTo=${encodeURIComponent(here)}&reason=expired`,
          );
          return;
        }
        setState({ ready: true, profile: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router]);

  const avatarExpiresAt = state.profile?.avatarExpiresAt ?? null;
  useEffect(() => {
    if (!avatarExpiresAt) return;
    const ms = new Date(avatarExpiresAt).getTime() - Date.now() - 30_000;
    if (!Number.isFinite(ms)) return;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        getProfile()
          .then((profile) => {
            if (!cancelled) setState((s) => ({ ...s, profile }));
          })
          .catch(() => undefined);
      },
      Math.max(1_000, ms),
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [avatarExpiresAt]);

  // Plan and deletion status for the banners and the sidebar. Refreshed on every page change; failing to read it
  // never blocks the page, it just shows nothing.
  const [account, setAccount] = useState<{
    plan: PlanSummary | null;
    deletion: DeletionView | null;
  }>({ plan: null, deletion: null });
  const profileReady = state.ready && !!state.profile;
  const [accountTick, setAccountTick] = useState(0);
  useEffect(() => {
    const again = () => setAccountTick((n) => n + 1);
    window.addEventListener(ACCOUNT_CHANGED, again);
    return () => window.removeEventListener(ACCOUNT_CHANGED, again);
  }, []);
  useEffect(() => {
    if (!profileReady) return;
    let cancelled = false;
    Promise.all([
      fetchPlan().catch(() => null),
      fetchDeletion().catch(() => null),
    ]).then(([plan, deletion]) => {
      if (!cancelled) setAccount({ plan, deletion });
    });
    return () => {
      cancelled = true;
    };
  }, [profileReady, pathname, accountTick]);

  return (
    <ProfileProvider
      value={{
        profile: state.profile,
        setProfile: (profile) => setState((s) => ({ ...s, profile })),
      }}>
      <AppearanceProvider
        profile={state.profile}
        onSaved={(profile) => setState((s) => ({ ...s, profile }))}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg">
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col md:flex-row">
          {/* Desktop sidebar */}
          <aside
            id="sidebar"
            className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-fg transition-[width] duration-200 sc:md:w-[4.5rem] md:sticky md:top-0 md:flex md:h-screen">
            {/* Same height as the top bar, so the two line up. */}
            <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-5 sc:md:justify-center sc:md:px-0">
              <HomeLink />
            </div>
            <nav aria-label="Primary" className="flex flex-col gap-0.5 p-3">
              {NAV.map((n) => (
                <NavLink
                  key={n.href}
                  {...n}
                  pathname={pathname}
                  tone="sidebar"
                />
              ))}
            </nav>
            <div className="mt-auto space-y-0.5 border-t border-sidebar-border p-3">
              <SidebarPlanCard plan={account.plan} />
              <NavLink
                href="/dashboard/plan"
                label="Plan and usage"
                Icon={Gauge}
                pathname={pathname}
                tone="sidebar"
              />
              <NavLink
                href="/dashboard/settings"
                label="Settings"
                Icon={Settings}
                pathname={pathname}
                tone="sidebar"
              />
              {state.profile?.isStaff && (
                <NavLink
                  href="/dashboard/admin"
                  label="Staff area"
                  Icon={ShieldCheck}
                  pathname={pathname}
                  tone="sidebar"
                />
              )}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              profile={state.profile}
              plan={account.plan}
              loading={!state.ready}
            />
            <nav
              aria-label="Primary"
              className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
              {NAV.map((n) => (
                <NavLink key={n.href} {...n} pathname={pathname} />
              ))}
              <NavLink
                href="/dashboard/plan"
                label="Plan"
                Icon={Gauge}
                pathname={pathname}
              />
            </nav>

            <main
              id="main"
              tabIndex={-1}
              className="min-w-0 flex-1 outline-none">
              <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
                {/* The page is always rendered (Next validates every segment for instant navigation) but stays hidden until
                the profile is known, so nobody sees a page flash before the first-time redirect to /welcome. */}
                {!state.ready && <PageSkeleton />}
                <div hidden={!state.ready}>
                  <AccountBanners
                    plan={account.plan}
                    deletion={account.deletion}
                    hide={
                      pathname.startsWith("/dashboard/plan/confirming")
                        ? ["pending"]
                        : []
                    }
                  />
                  {children}
                </div>
              </div>
            </main>
          </div>
        </div>
      </AppearanceProvider>
    </ProfileProvider>
  );
}
