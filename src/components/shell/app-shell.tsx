"use client";

import { CalendarCheck, CalendarDays, Gauge, House, Library, LogOut, Mic, Search, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { ACCOUNT_CHANGED, type DeletionView, type PlanSummary, fetchDeletion, fetchPlan } from "@/lib/plan-client";
import { ProfileError, type ProfileView, getProfile } from "@/lib/profile-client";
import { ROLES } from "@/lib/roles";
import { AccountBanners, AllowanceMini } from "./account-banners";
import { ProfileProvider } from "./profile-context";

// Capture has two tabs (Voice Inbox, Meeting Bot) that live at /voice and /capture; the nav item covers both.
const NAV: readonly { href: string; label: string; Icon: typeof Mic; also?: readonly string[] }[] = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/voice", label: "Capture", Icon: Mic, also: ["/capture"] },
  { href: "/library", label: "Library", Icon: Library, also: ["/captures"] },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
  { href: "/booking", label: "Booking", Icon: CalendarCheck },
];

function NavLink({ href, label, Icon, also = [], pathname, compact = false }: { href: string; label: string; Icon: typeof Mic; also?: readonly string[]; pathname: string; compact?: boolean }) {
  const active = [href, ...also].some((base) => pathname === base || pathname.startsWith(`${base}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm transition-colors ${compact ? "py-3" : "py-2"} ${
        active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"
      }`}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function UserCard({ profile }: { profile: ProfileView | null }) {
  const label = profile?.name?.trim() || profile?.email || "Not signed in";
  const sub = profile?.name?.trim() ? profile.email : ROLES.find((r) => r.id === profile?.role)?.label;
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold uppercase text-accent">
        {label[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={label}>
          {label}
        </p>
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </div>
      {profile && (
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <LogOut aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** The way into Library search from anywhere: type, press Enter, land on the results. */
function SearchEntry() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      aria-label="Search your library"
      onSubmit={(e) => {
        e.preventDefault();
        const text = q.trim();
        router.push(text ? `/library?q=${encodeURIComponent(text)}` : "/library");
        setQ("");
      }}
      className="relative"
    >
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={100}
        aria-label="Search your library"
        placeholder="Search library"
        className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted"
      />
    </form>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-accent-solid text-sm font-bold text-white">
        C
      </span>
      CalMasta
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
  const [state, setState] = useState<{ ready: boolean; profile: ProfileView | null }>({ ready: false, profile: null });

  useEffect(() => {
    let cancelled = false;
    getProfile().then(
      (profile) => {
        if (cancelled) return;
        if (!profile.onboarded) router.replace("/welcome");
        else setState({ ready: true, profile });
      },
      (err) => {
        if (cancelled) return;
        // No (or an expired) session: go and sign in, then come back to this page.
        if (err instanceof ProfileError && err.status === 401) {
          const here = window.location.pathname + window.location.search;
          router.replace(`/login?returnTo=${encodeURIComponent(here)}&reason=expired`);
          return;
        }
        setState({ ready: true, profile: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Plan and deletion status for the banners and the sidebar. Refreshed on every page change; failing to read it
  // never blocks the page, it just shows nothing.
  const [account, setAccount] = useState<{ plan: PlanSummary | null; deletion: DeletionView | null }>({ plan: null, deletion: null });
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
    Promise.all([fetchPlan().catch(() => null), fetchDeletion().catch(() => null)]).then(([plan, deletion]) => {
      if (!cancelled) setAccount({ plan, deletion });
    });
    return () => {
      cancelled = true;
    };
  }, [profileReady, pathname, accountTick]);

  return (
    <ProfileProvider value={{ profile: state.profile, setProfile: (profile) => setState((s) => ({ ...s, profile })) }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg">
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 p-4 md:sticky md:top-0 md:flex md:h-screen">
          <div className="px-3 py-2">
            <Brand />
          </div>
          <div className="mt-4">
            <SearchEntry />
          </div>
          <nav aria-label="Primary" className="mt-4 flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink key={n.href} {...n} pathname={pathname} />
            ))}
          </nav>
          <div className="mt-auto space-y-1 border-t border-border pt-3">
            <AllowanceMini plan={account.plan} />
            <NavLink href="/plan" label="Plan and usage" Icon={Gauge} pathname={pathname} />
            <NavLink href="/settings" label="Settings" Icon={Settings} pathname={pathname} />
            {state.profile?.isStaff && <NavLink href="/admin" label="Staff area" Icon={ShieldCheck} pathname={pathname} />}
            <UserCard profile={state.profile} />
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="border-b border-border md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <div className="flex items-center gap-2">
              <Link href="/library" aria-label="Search your library" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground">
                <Search aria-hidden className="h-4 w-4" />
              </Link>
              <Link href="/settings" aria-label="Settings" className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-sm font-semibold uppercase text-accent">
                {(state.profile?.name?.trim() || state.profile?.email || "?")[0]}
              </Link>
            </div>
          </div>
          <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((n) => (
              <NavLink key={n.href} {...n} pathname={pathname} compact />
            ))}
            <NavLink href="/plan" label="Plan" Icon={Gauge} pathname={pathname} compact />
            {state.profile?.isStaff && <NavLink href="/admin" label="Staff" Icon={ShieldCheck} pathname={pathname} compact />}
          </nav>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
            {/* The page is always rendered (Next validates every segment for instant navigation) but stays hidden until
                the profile is known, so nobody sees a page flash before the first-time redirect to /welcome. */}
            {!state.ready && (
              <p role="status" className="text-sm text-muted">
                Loading…
              </p>
            )}
            <div hidden={!state.ready}>
              <AccountBanners plan={account.plan} deletion={account.deletion} hide={pathname.startsWith("/plan/confirming") ? ["pending"] : []} />
              {children}
            </div>
          </div>
        </main>
      </div>
    </ProfileProvider>
  );
}
