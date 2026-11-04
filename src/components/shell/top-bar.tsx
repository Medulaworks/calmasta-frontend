"use client";

import { dashboardPath } from "@/lib/app-routes";

import {
  Bell,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  CircleAlert,
  Gauge,
  Info,
  LogOut,
  LoaderCircle,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Brand } from "@/components/ui/brand";
import { useDismiss } from "@/components/ui/use-dismiss";
import { CaptureMenu } from "./capture-menu";
import { HeaderSearch } from "./header-search";
import { signOut } from "@/lib/auth-client";
import { setSidebarCollapsed, useSidebarCollapsed } from "@/lib/sidebar";
import { MODES, THEMES, useThemeChoice } from "@/lib/theme";
import {
  MODE_ICON,
  ModeOptions,
  ThemeOptions,
} from "@/components/theme/theme-picker";
import { Avatar } from "@/components/ui/avatar";
import { DUMMY_PLAN, type PlanSummary, formatDate } from "@/lib/plan-client";
import { PLAN_LABEL, isPaidPlan } from "@/lib/plan-types";
import { type NotificationItem } from "@/lib/notifications-client";
import { useMarkNotificationsRead } from "@/lib/mutations";
import { notificationsQuery } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import type { ProfileView } from "@/lib/profile-client";
import { formatMinutes, timeAgo } from "@/lib/status";

const TONE_ICON = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;
const TONE_COLOR = {
  success: "text-success",
  info: "text-accent",
  warning: "text-warning",
  danger: "text-danger",
} as const;

function Notifications({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const markRead = useMarkNotificationsRead();
  // Keep a local copy so "New" marks persist until panel closes
  const [local, setLocal] = useState<{
    unread: number;
    items: NotificationItem[];
  } | null>(null);
  const q = useQuery({
    ...notificationsQuery,
    refetchInterval: 60_000,
  });
  // Sync server data to local when panel closed
  useEffect(() => {
    if (!q.data) return;
    if (open && local) return;
    setLocal(q.data);
  }, [q.data, open, local]);
  // Refetch on pathname change
  useEffect(() => {
    void q.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const list = local;
  const failed = !!q.error && !list;
  const close = useCallback(() => {
    setOpen(false);
    setLocal((l) =>
      l
        ? { unread: 0, items: l.items.map((i) => ({ ...i, unread: false })) }
        : l,
    );
  }, []);
  useDismiss(open, close, panel, trigger);

  const unread = list?.unread ?? 0;
  function toggle() {
    if (open) return close();
    setOpen(true);
    if (unread > 0) {
      const ids = list?.items.filter((i) => i.unread).map((i) => i.id) ?? [];
      void markRead.mutateAsync(ids).catch(() => undefined);
      setLocal((l) => (l ? { ...l, unread: 0 } : l));
    }
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifications, ${unread} new` : "Notifications"
        }
        className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground">
        <Bell aria-hidden className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger-solid px-1 text-[10px] font-medium leading-none text-white ring-2 ring-topbar">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <span className="text-xs text-muted">Last 14 days</span>
          </div>
          {failed && !list ? (
            <p role="alert" className="px-4 py-6 text-sm text-danger">
              Couldn&rsquo;t load notifications. They&rsquo;ll try again in a
              minute.
            </p>
          ) : !list ? (
            <p role="status" className="px-4 py-6 text-sm text-muted">
              Loading…
            </p>
          ) : list.items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">You&rsquo;re all caught up</p>
              <p className="mt-1 text-sm text-muted">
                Updates about your recordings, documents and bookings show up
                here.
              </p>
            </div>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">
              {list.items.map((n) => (
                <NotificationRow key={n.id} n={n} onNavigate={close} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  onNavigate,
}: {
  n: NotificationItem;
  onNavigate: () => void;
}) {
  const Icon = TONE_ICON[n.tone];
  return (
    <li>
      <Link
        href={dashboardPath(n.href)}
        onClick={onNavigate}
        className={`flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface ${n.unread ? "bg-accent/5" : ""}`}>
        <Icon
          aria-hidden
          className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_COLOR[n.tone]}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-medium">{n.title}</span>
            {n.unread && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-medium text-background">
                New
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-muted">{n.body}</span>
          <span className="mt-1 block text-xs text-muted">{timeAgo(n.at)}</span>
        </span>
      </Link>
    </li>
  );
}

function Bar({ pct, exhausted }: { pct: number; exhausted: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="Allowance used this month"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full ${exhausted ? "bg-danger-solid" : "bg-accent-solid"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Current plan, hours left and the way to upgrade, at the top of the account menu. */
function PlanCard({
  plan,
  onNavigate,
}: {
  plan: PlanSummary | null;
  onNavigate: () => void;
}) {
  const displayPlan = plan ?? DUMMY_PLAN;
  if (!displayPlan) {
    return (
      <div aria-hidden className="space-y-3 px-4 py-4">
        <div className="h-4 w-16 jb-skel rounded bg-surface" />
        <div className="h-2 jb-skel rounded-full bg-surface" />
        <div className="h-9 jb-skel rounded-lg bg-surface" />
      </div>
    );
  }
  const pro = isPaidPlan(displayPlan.plan.plan);
  const pct =
    displayPlan.allowanceMinutes > 0
      ? Math.min(
          100,
          Math.round((displayPlan.usedMinutes / displayPlan.allowanceMinutes) * 100),
        )
      : 100;
  const status =
    displayPlan.plan.status === "grace"
      ? "Payment needs attention"
      : displayPlan.plan.status === "pending_activation"
        ? "Waiting for payment"
        : pro && displayPlan.plan.renewsAt
          ? `Renews ${formatDate(displayPlan.plan.renewsAt, displayPlan.timezone)}`
          : pro
            ? "Active"
            : "No card needed";
  const external = !!displayPlan.checkoutUrl && !pro && !displayPlan.testCheckout;
  const cta =
    "mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90";
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-xl border border-border bg-gradient-to-br from-accent-solid/15 via-transparent to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-base font-semibold">
              {pro && <Sparkles aria-hidden className="h-4 w-4 text-accent" />}
              {PLAN_LABEL[displayPlan.plan.plan]}
            </p>
            <p className="text-xs text-muted">{status}</p>
          </div>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            Current plan
          </span>
        </div>
        <div className="mt-4">
          <Bar pct={pct} exhausted={displayPlan.exhausted} />
          <p className="mt-2 text-sm">
            <span className="font-medium tabular-nums">
              {formatMinutes(displayPlan.remainingMinutes)} left
            </span>
            <span className="text-muted">
              {" "}
              of {formatMinutes(displayPlan.allowanceMinutes + displayPlan.purchasedMinutes)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Resets {formatDate(displayPlan.resetsAt, displayPlan.timezone)}
            {displayPlan.purchasedMinutes > 0
              ? ` · includes ${formatMinutes(displayPlan.purchasedMinutes)} bought`
              : ""}
          </p>
        </div>
        {pro ? (
          <Link
            href="/dashboard/plan"
            role="menuitem"
            onClick={onNavigate}
            className={`${cta} border border-border bg-background`}>
            Manage plan
          </Link>
        ) : external ? (
          <a
            href={displayPlan.checkoutUrl!}
            role="menuitem"
            onClick={onNavigate}
            rel="noopener noreferrer"
            className={`${cta} bg-accent-solid text-on-accent`}>
            <Zap aria-hidden className="h-4 w-4" /> Upgrade
          </a>
        ) : (
          <Link
            href="/dashboard/plan"
            role="menuitem"
            onClick={onNavigate}
            className={`${cta} bg-accent-solid text-on-accent`}>
            <Zap aria-hidden className="h-4 w-4" /> Upgrade
          </Link>
        )}
      </div>
    </div>
  );
}

function ProfileMenu({
  profile,
  plan,
  loading,
}: {
  profile: ProfileView | null;
  plan: PlanSummary | null;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<null | "mode" | "theme">(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, panel, trigger);
  const { theme, mode } = useThemeChoice();

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
    } catch {
      setSigningOut(false);
      setSignOutError("Could not sign out. Please try again.");
    }
  }

  // Arrow keys move through the items; opening puts focus on the first.
  useEffect(() => {
    if (open)
      panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  function onKeyDown(e: React.KeyboardEvent) {
    if (
      e.key !== "ArrowDown" &&
      e.key !== "ArrowUp" &&
      e.key !== "Home" &&
      e.key !== "End"
    )
      return;
    const items = Array.from(
      panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : e.key === "ArrowDown"
            ? (i + 1) % items.length
            : (i - 1 + items.length) % items.length;
    items[next].focus();
  }

  if (loading)
    return (
      <span
        aria-hidden
        className="h-9 w-9 jb-skel rounded-full bg-surface"
      />
    );
  const name = profile?.name?.trim() || profile?.email || "Not signed in";
  const first = (profile?.name?.trim() || profile?.email || "").split(
    /[\s@]/,
  )[0];
  const item =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface";
  const themeLabel = THEMES.find((t) => t.id === theme)?.label ?? "";
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? "";
  const ModeIcon = MODE_ICON[mode];

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-topbar transition-shadow hover:ring-2 hover:ring-accent/30">
        <Avatar name={name} src={profile?.avatarUrl} size={32} />
      </button>
      {open && (
        <div
          ref={panel}
          role="menu"
          aria-label="Account"
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-40 mt-2 max-h-[calc(100vh-5rem)] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-border bg-background text-foreground shadow-xl">
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <Avatar name={name} src={profile?.avatarUrl} size={44} />
            <div className="min-w-0">
              <p
                className="truncate text-lg font-semibold leading-tight"
                title={name}>
                Hi {first}
              </p>
              {profile?.email && (
                <p
                  className="truncate text-sm text-muted"
                  title={profile.email}>
                  {profile.email}
                </p>
              )}
            </div>
          </div>
          <div role="separator" className="border-t border-border" />
          <PlanCard plan={plan} onNavigate={close} />
          <div role="separator" className="border-t border-border" />
          <div className="p-2">
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={close}
              className={item}>
              <User aria-hidden className="h-4 w-4 text-muted" /> Your profile
            </Link>
            <Link
              href="/dashboard/settings"
              role="menuitem"
              onClick={close}
              className={item}>
              <Settings aria-hidden className="h-4 w-4 text-muted" /> Settings
            </Link>
            <Link
              href="/dashboard/plan"
              role="menuitem"
              onClick={close}
              className={item}>
              <Gauge aria-hidden className="h-4 w-4 text-muted" /> Plan and
              usage
            </Link>
            {profile?.isStaff && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={close}
                className={item}>
                <ShieldCheck aria-hidden className="h-4 w-4 text-muted" /> Staff
                area
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              aria-expanded={section === "mode"}
              onClick={() => setSection((v) => (v === "mode" ? null : "mode"))}
              className={item}>
              <ModeIcon aria-hidden className="h-4 w-4 text-muted" />
              <span className="flex-1">Mode</span>
              <span className="truncate text-xs text-muted">{modeLabel}</span>
              <ChevronDown
                aria-hidden
                className={`h-4 w-4 shrink-0 text-muted transition-transform ${section === "mode" ? "rotate-180" : ""}`}
              />
            </button>
            {section === "mode" && <ModeOptions />}
            <button
              type="button"
              role="menuitem"
              aria-expanded={section === "theme"}
              onClick={() =>
                setSection((v) => (v === "theme" ? null : "theme"))
              }
              className={item}>
              <Palette aria-hidden className="h-4 w-4 text-muted" />
              <span className="flex-1">Theme</span>
              <span className="truncate text-xs text-muted">{themeLabel}</span>
              <ChevronDown
                aria-hidden
                className={`h-4 w-4 shrink-0 text-muted transition-transform ${section === "theme" ? "rotate-180" : ""}`}
              />
            </button>
            {section === "theme" && <ThemeOptions />}
          </div>
          <div role="separator" className="border-t border-border" />
          <div className="p-2">
            {signOutError && (
              <p role="alert" className="px-3 py-2 text-sm text-danger">
                {signOutError}
              </p>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-busy={signingOut}
              className={`${item} disabled:cursor-wait disabled:opacity-70`}>
              {signingOut ? (
                <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut aria-hidden className="h-4 w-4 text-muted" />
              )}
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              title="Temporarily unavailable"
              className={`${item} text-muted disabled:pointer-events-none disabled:opacity-50`}>
              <LogOut aria-hidden className="h-4 w-4" /> Sign out of all devices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The bar across the top of every signed-in page: search on the left, then notifications and the account menu on the
 * right. On a phone the sidebar is hidden, so the logo takes the left side and search is an icon.
 */
export function TopBar({
  profile,
  plan,
  loading = false,
}: {
  profile: ProfileView | null;
  plan: PlanSummary | null;
  loading?: boolean;
}) {
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-topbar px-4 text-topbar-fg sm:px-6 md:px-8">
      <Link
        href="/dashboard"
        aria-label="Jooba home"
        className="text-lg text-topbar-fg md:hidden">
        <Brand size={28} />
      </Link>
      <button
        type="button"
        onClick={() => setSidebarCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        aria-controls="sidebar"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground md:grid">
        {collapsed ? (
          <PanelLeftOpen aria-hidden className="h-[18px] w-[18px]" />
        ) : (
          <PanelLeftClose aria-hidden className="h-[18px] w-[18px]" />
        )}
      </button>
      <div className="hidden min-w-0 flex-1 md:block">
        <HeaderSearch />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <div className="md:hidden">
          <HeaderSearch compact />
        </div>
        <Notifications pathname={pathname} />
        <div className="mx-1">
          <CaptureMenu />
        </div>
        <ProfileMenu profile={profile} plan={plan} loading={loading} />
      </div>
    </header>
  );
}
