"use client";

import { ArrowRight, CircleCheck, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/brand";
import { buttonClass } from "@/components/ui/button";
import { ADMIN_PREVIEW } from "@/lib/admin-preview";
import { type ProfileView, getProfile } from "@/lib/profile-client";
import { type InviteView, acceptInvite, getInvite } from "@/lib/staff-invite-client";
import { ApiError } from "@/lib/upload-client";
import { fmtUtc } from "@/lib/admin-client";
import { previewProfile } from "./staff-session";

type State =
  | { s: "loading" }
  | { s: "gone"; why: "unavailable" | "missing" }
  | { s: "ready"; invite: InviteView; me: ProfileView | null }
  | { s: "accepted" };

/**
 * Where the email link lands. It says who invited you and what being an admin means, and asks for one click.
 * Accepting needs you to be signed in as the invited email; anything else explains what to do instead.
 */
export function InviteAccept({ token }: { token: string }) {
  const [state, setState] = useState<State>({ s: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const invite = await getInvite(token);
        const me = ADMIN_PREVIEW ? previewProfile() : await getProfile().catch(() => null);
        if (!off) setState({ s: "ready", invite, me });
      } catch (err) {
        if (!off) setState({ s: "gone", why: err instanceof ApiError && err.code === "feature_unavailable" ? "unavailable" : "missing" });
      }
    })();
    return () => { off = true; };
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token);
      setState({ s: "accepted" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't accept the invite. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const here = `/staff-invite/${encodeURIComponent(token)}`;
  const signIn = `/auth/login?returnTo=${encodeURIComponent(here)}`;

  return (
    <main className="relative grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="mb-6 flex items-center justify-center gap-3 text-xl">
          <Brand size={36} />
          <span className="rounded-md bg-danger-solid px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white">Admin</span>
        </div>
        <div className="rounded-2xl border border-border bg-background p-7 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)]">
          {state.s === "loading" && <p role="status" className="flex items-center gap-2 text-sm text-muted"><LoaderCircle aria-hidden className="size-4 animate-spin" /> Checking your invite…</p>}

          {state.s === "gone" && (
            <Notice icon="warn" title={state.why === "unavailable" ? "Invites aren’t available yet" : "This invite link doesn’t work"}>
              {state.why === "unavailable" ? "Try again later." : "Ask the admin who invited you for a new one."}
            </Notice>
          )}

          {state.s === "accepted" && (
            <>
              <Notice icon="ok" title="You’re an admin now">Sign in with your Jooba email and password.</Notice>
              <Link href="/admin/login" className={`${buttonClass("primary", "mt-6 w-full", "lg")}`}>Go to admin sign-in <ArrowRight aria-hidden className="size-4" /></Link>
            </>
          )}

          {state.s === "ready" && <Ready state={state} busy={busy} error={error} accept={accept} signIn={signIn} />}
        </div>
      </div>
    </main>
  );
}

function Ready({ state, busy, error, accept, signIn }: { state: Extract<State, { s: "ready" }>; busy: boolean; error: string | null; accept: () => void; signIn: string }) {
  const { invite, me } = state;
  if (invite.status === "accepted") return <Notice icon="ok" title="This invite was already used">Sign in to continue.<Link href="/admin/login" className={`${buttonClass("primary", "mt-6 w-full", "lg")}`}>Go to admin sign-in</Link></Notice>;
  if (invite.status === "cancelled") return <Notice icon="warn" title="This invite was cancelled">Ask for a new invite.</Notice>;
  const expired = invite.status === "expired" || new Date(invite.expiresAt) < new Date();
  if (expired) return <Notice icon="warn" title="This invite has expired">Ask {invite.invitedBy} for a new one.</Notice>;

  const mine = me?.email.toLowerCase() === invite.email.toLowerCase();
  return (
    <>
      <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent"><ShieldCheck className="size-6" /></span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">You’re invited to be an admin</h1>
      <p className="mt-1.5 text-sm text-muted"><span className="text-foreground">{invite.invitedBy}</span> invited you to be an admin.</p>
      <p className="mt-3 text-xs text-muted">Expires {fmtUtc(invite.expiresAt)}.</p>

      {error && <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}

      {me && mine ? (
        <button type="button" onClick={accept} disabled={busy} className={`${buttonClass("primary", "mt-6 w-full", "lg")}`}>
          {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}{busy ? "Accepting…" : "Accept invite"}
        </button>
      ) : me ? (
        <div className="mt-6 space-y-3">
          <p role="note" className="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-warning">This invite is for <b className="font-medium">{invite.email}</b>, but you’re signed in as <b className="font-medium">{me.email}</b>.</p>
          <Link href={signIn} className={`${buttonClass("secondary", "w-full", "lg")}`}>Sign in with {invite.email}</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <Link href={signIn} className={`${buttonClass("primary", "w-full", "lg")}`}>Sign in to accept</Link>
          <p className="text-center text-xs text-muted">Use {invite.email}.</p>
        </div>
      )}
    </>
  );
}

function Notice({ icon, title, children }: { icon: "ok" | "warn"; title: string; children: React.ReactNode }) {
  const Icon = icon === "ok" ? CircleCheck : TriangleAlert;
  return (
    <div role={icon === "ok" ? "status" : "alert"}>
      <span aria-hidden className={`grid size-11 place-items-center rounded-xl ${icon === "ok" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}><Icon className="size-6" /></span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-1.5 text-sm text-muted">{children}</div>
    </div>
  );
}
