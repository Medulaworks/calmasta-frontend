export type CodePurpose = "verification" | "recovery";
type Step = "email" | "code" | "password" | "done";
interface CodeState { step: Step; busy: boolean; error: string; notice: string; resendAt: number; signedOut: boolean }
class CodeFlowError extends Error {}
type Send = (path: string, body: Record<string, unknown>) => Promise<Response>;
const post: Send = (path, body) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const codeSignupPayload = (email: string, password: string, name: string) => ({ email, password, name, delivery: "code" });
export const codeSecondsLeft = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));

/** Component-owned state. Reset grants stay in this closure, never in rendered snapshots or storage. */
export function createAuthCodeFlow(purpose: CodePurpose, send: Send = post, now = Date.now) {
  let state: CodeState = { step: purpose === "recovery" ? "email" : "code", busy: false, error: "", notice: "", resendAt: 0, signedOut: false };
  let email = "", resetToken = "";
  const listeners = new Set<() => void>();
  const update = (patch: Partial<CodeState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  async function request(path: string, body: Record<string, unknown>) {
    const res = await send(path, body);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = data.error;
      if (res.status === 401) update({ signedOut: true });
      if (res.status === 429) update({ resendAt: now() + 60000 });
      if (error === "invalid_or_expired_token" && purpose === "recovery") { resetToken = ""; update({ step: "email" }); }
      throw new CodeFlowError(res.status === 404 || res.status >= 500 ? "Email codes aren’t available right now. Please try again later."
        : res.status === 401 || error === "unauthorized" ? "Please sign in again to verify your email."
        : res.status === 429 || error === "too_many_attempts" || error === "too_many_auth_attempts" ? "Too many attempts. Wait a minute, then try again or ask for a new code."
        : error === "expired_code" ? "That code has expired. Request a new code."
        : error === "invalid_code" ? "That code isn’t right or has expired. Check it, or ask for a new one."
        : error === "invalid_or_expired_token" ? "This reset has expired or was already used. Ask for a new code."
        : "That didn’t work. Please try again.");
    }
    return data;
  }
  async function run(work: () => Promise<void>) {
    if (state.busy || state.step === "done") return;
    update({ busy: true, error: "", notice: "" });
    try { await work(); } catch (e) { update({ error: e instanceof CodeFlowError ? e.message : "We can’t connect right now. Check your connection and try again." }); }
    finally { update({ busy: false }); }
  }
  return {
    snapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    send: async (address?: string) => {
      if (state.busy || now() < state.resendAt || state.step === "done") return;
      if (purpose === "recovery" && !address && !email) return;
      await run(async () => {
        if (purpose === "recovery") email = address ?? email;
        await request(purpose === "recovery" ? "/api/auth/forgot-password" : "/api/auth/verify-email/resend", purpose === "recovery" ? { email, delivery: "code" } : { delivery: "code" });
        resetToken = "";
        update({ step: "code", resendAt: now() + 60000, notice: purpose === "recovery" ? "If there’s an account with that email, we’ve sent a code. Check your inbox (it can take a minute). Codes expire in 10 minutes." : "We’ve sent you a code. Check your inbox. It expires in 10 minutes." });
      });
    },
    verify: async (code: string) => {
      if (state.step !== "code") return;
      if (!/^[0-9]{6}$/.test(code)) { update({ error: "Enter the six-digit code." }); return; }
      await run(async () => {
        const data = await request(purpose === "recovery" ? "/api/auth/verify-reset-code" : "/api/auth/verify-email", purpose === "recovery" ? { email, code } : { code });
        if (purpose === "recovery") {
          if (typeof data.resetToken !== "string" || !/^[a-f0-9]{64}$/.test(data.resetToken)) throw new CodeFlowError("That didn’t work. Please try again.");
          resetToken = data.resetToken; update({ step: "password" });
        } else update({ step: "done", notice: "Your email is verified." });
      });
    },
    reset: async (password: string) => {
      if (state.step !== "password" || !resetToken) return;
      if (password.length < 8 || password.length > 128) { update({ error: "Use a password between 8 and 128 characters." }); return; }
      await run(async () => {
        await request("/api/auth/reset-password", { token: resetToken, password });
        resetToken = ""; update({ step: "done", notice: "Your password was updated. Sign in with your new password." });
      });
    },
    back: () => { if (state.busy) return; resetToken = ""; update({ step: purpose === "recovery" ? "email" : "code", error: "", notice: "" }); },
  };
}
