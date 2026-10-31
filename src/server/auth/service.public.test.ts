import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./service";
import type { AuthConfig } from "./config";
import type { AuthStore, LoginTransaction, SessionData } from "./store";
import { hashId } from "./security";

class MemoryStore implements AuthStore {
  transactions = new Map<string, LoginTransaction>();
  sessions = new Map<string, SessionData>();
  async putTransaction(id: string, v: LoginTransaction) { this.transactions.set(id, v); }
  async consumeTransaction(id: string) { const v = this.transactions.get(id) ?? null; this.transactions.delete(id); return v; }
  async putSession(id: string, v: SessionData) { this.sessions.set(id, v); }
  async session(id: string, refresh: (v: SessionData) => Promise<SessionData | null>) {
    const v = this.sessions.get(id); if (!v) return null;
    const r = await refresh(v); if (r) this.sessions.set(id, r); else this.sessions.delete(id); return r;
  }
  async revoke(id: string, all: boolean) {
    const cur = this.sessions.get(id); const removed: SessionData[] = [];
    for (const [k, v] of this.sessions) if (k === id || (all && cur && v.subject === cur.subject)) { removed.push(v); this.sessions.delete(k); }
    return removed;
  }
}

const APP = "http://localhost:3006";
const API = "http://localhost:3009";
const SECRET = "a".repeat(64);
const cfg = (): AuthConfig => ({ appOrigin: APP, apiOrigin: API, sessionSecret: SECRET, secure: false, callbackUrl: `${APP}/api/auth/callback`, sessionCookie: "sid", transactionCookie: "txn" });

describe("public BFF proxy allowlist", () => {
  let store: MemoryStore;
  let auth: AuthService;
  let upstream: Array<{ path: string; auth: string | null }>;
  let origFetch: typeof fetch;

  beforeEach(() => {
    store = new MemoryStore();
    auth = new AuthService(cfg(), store);
    upstream = [];
    origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const u = new URL(href);
      const h = new Headers(init?.headers as HeadersInit);
      upstream.push({ path: u.pathname + u.search, auth: h.get("Authorization") });
      if (u.pathname.startsWith("/public/")) {
        if (u.pathname.includes("/slots")) return Response.json({ hostTimezone: "UTC", durationMin: 30, slots: [] });
        if (u.pathname.endsWith("/book")) return Response.json({ manageToken: "tok", booking: { status: "confirmed" } });
        return Response.json({ title: "Page", description: "", hostName: "Host", meetingTypes: [] });
      }
      if (u.pathname === "/account/me") return Response.json({ userId: "u1", subject: "u1", email: "a@b.c", emailVerified: true, profession: "consultant", role: "owner", onboarded: true });
      if (u.pathname === "/usage/summary") return Response.json({ usedSeconds: 10 });
      return Response.json({ error: "not found" }, { status: 404 });
    }) as unknown as typeof fetch;
  });

  it("allows unauthenticated GET /api/public/pages/:slug/slots without Authorization", async () => {
    const req = new Request(`${APP}/api/public/pages/my-page/slots?from=2026-01-01&to=2026-01-07`, { headers: { Origin: APP } });
    const res = await auth.proxy(req, ["public", "pages", "my-page", "slots"]);
    expect(res.status).toBe(200);
    expect(upstream[0].path).toBe("/public/pages/my-page/slots?from=2026-01-01&to=2026-01-07");
    expect(upstream[0].auth).toBeNull();
    globalThis.fetch = origFetch;
  });

  it("allows unauthenticated POST /api/public/pages/:slug/book", async () => {
    const req = new Request(`${APP}/api/public/pages/my-page/book`, {
      method: "POST", headers: { Origin: APP, "Content-Type": "application/json" },
      body: JSON.stringify({ typeId: "t1", start: "2026-01-01T09:00:00Z", guestName: "Jane", guestEmail: "jane@example.com", guestTimezone: "UTC", note: "" }),
    });
    const res = await auth.proxy(req, ["public", "pages", "my-page", "book"]);
    expect(res.status).toBe(200);
    expect(upstream[0].auth).toBeNull();
    globalThis.fetch = origFetch;
  });

  it("blocks unauthenticated non-public routes with 401", async () => {
    const req = new Request(`${APP}/api/usage/summary`, { headers: { Origin: APP } });
    const res = await auth.proxy(req, ["usage", "summary"]);
    expect(res.status).toBe(401);
    expect(upstream.length).toBe(0);
    globalThis.fetch = origFetch;
  });

  it("rejects unknown roots even without session", async () => {
    const req = new Request(`${APP}/api/evil/path`, { headers: { Origin: APP } });
    const res = await auth.proxy(req, ["evil", "path"]);
    expect(res.status).toBe(404);
    globalThis.fetch = origFetch;
  });
});

describe("Microsoft OAuth dispatch", () => {
  let store: MemoryStore;
  let auth: AuthService;
  let calls: Array<{ path: string; body?: unknown }>;
  let origFetch: typeof fetch;

  beforeEach(() => {
    store = new MemoryStore();
    auth = new AuthService(cfg(), store);
    calls = [];
    origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const u = new URL(href);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ path: u.pathname, body });
      if (u.pathname === "/auth/microsoft/url") return Response.json({ url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?state=ms-state", state: "ms-state" });
      if (u.pathname === "/auth/google/url") return Response.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=g-state", state: "g-state" });
      if (u.pathname === "/auth/microsoft/callback") return Response.json({ accessToken: "a", refreshToken: "r", expiresIn: 900, user: { id: "u1", email: "a@b.c", name: "N", emailVerified: true } });
      if (u.pathname === "/auth/google/callback") return Response.json({ accessToken: "a", refreshToken: "r", expiresIn: 900, user: { id: "u1", email: "a@b.c", name: "N", emailVerified: true } });
      if (u.pathname === "/account/me") return Response.json({ userId: "u1", subject: "u1", email: "a@b.c", emailVerified: true, profession: "consultant", role: "owner", onboarded: true });
      return Response.json({ ok: true });
    }) as unknown as typeof fetch;
  });

  it("login ?provider=microsoft hits /auth/microsoft/url and stores provider", async () => {
    const req = new Request(`${APP}/api/auth/login?provider=microsoft&returnTo=/dashboard`, { headers: { Origin: APP } });
    const res = await auth.login(req);
    expect(res.status).toBe(303);
    expect(calls[0].path).toBe("/auth/microsoft/url");
    expect(res.headers.get("Location")).toContain("login.microsoftonline.com");
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("txn="))!;
    const txn = store.transactions.get(hashId(cookie.split("=")[1].split(";")[0]))!;
    expect(txn.provider).toBe("microsoft");
    expect(txn.state).toBe("ms-state");
    globalThis.fetch = origFetch;
  });

  it("callback with microsoft txn posts to /auth/microsoft/callback", async () => {
    const loginRes = await auth.login(new Request(`${APP}/api/auth/login?provider=microsoft`, { headers: { Origin: APP } }));
    const cookie = loginRes.headers.getSetCookie().find((c) => c.startsWith("txn="))!.split(";")[0];
    calls = [];
    const cb = new Request(`${APP}/api/auth/callback?state=ms-state&code=ms-code`, { headers: { Cookie: cookie } });
    const res = await auth.callback(cb);
    expect(calls[0].path).toBe("/auth/microsoft/callback");
    expect(res.status).toBe(303);
    globalThis.fetch = origFetch;
  });

  it("login without provider defaults to Google and stores google", async () => {
    const req = new Request(`${APP}/api/auth/login`, { headers: { Origin: APP } });
    const res = await auth.login(req);
    expect(calls[0].path).toBe("/auth/google/url");
    expect(res.headers.get("Location")).toContain("accounts.google.com");
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("txn="))!;
    expect(store.transactions.get(hashId(cookie.split("=")[1].split(";")[0]))!.provider).toBe("google");
    globalThis.fetch = origFetch;
  });

  it("callback with google txn posts to /auth/google/callback", async () => {
    const loginRes = await auth.login(new Request(`${APP}/api/auth/login`, { headers: { Origin: APP } }));
    const cookie = loginRes.headers.getSetCookie().find((c) => c.startsWith("txn="))!.split(";")[0];
    calls = [];
    const cb = new Request(`${APP}/api/auth/callback?state=g-state&code=g-code`, { headers: { Cookie: cookie } });
    await auth.callback(cb);
    expect(calls[0].path).toBe("/auth/google/callback");
    globalThis.fetch = origFetch;
  });
});

describe("public booking client wiring", () => {
  it("getPublicPage and publicSlots hit BFF public paths", async () => {
    const orig = globalThis.fetch;
    const fetched: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      fetched.push(String(url));
      return Response.json({ title: "T", description: "", hostName: "H", meetingTypes: [{ id: "t1", name: "30m", description: "", durationMin: 30 }], hostTimezone: "UTC", durationMin: 30, slots: [], manageToken: "tok", booking: { status: "confirmed" } });
    }) as unknown as typeof fetch;
    const { getPublicPage, publicSlots, createPublicBooking } = await import("../../lib/booking-client");
    await getPublicPage("my-slug");
    expect(fetched[0]).toBe("/api/public/pages/my-slug");
    await publicSlots("my-slug", "t1", "2026-01-01", 7, "UTC");
    expect(fetched[1]).toContain("/api/public/pages/my-slug/slots");
    expect(fetched[1]).toContain("type=t1");
    await createPublicBooking("my-slug", { typeId: "t1", start: "2026-01-01T09:00:00Z", guestName: "Jane", guestEmail: "jane@example.com", guestTimezone: "UTC", note: "" });
    expect(fetched[2]).toBe("/api/public/pages/my-slug/book");
    globalThis.fetch = orig;
  });

  it("public-booking component fetches page and renders slot/book flow", async () => {
    const src = await import("node:fs").then((m) => m.readFileSync("src/components/booking/public-booking.tsx", "utf8"));
    expect(src).toContain("getPublicPage(slug)");
    expect(src).toContain("publicSlots(slug");
    expect(src).toContain("createPublicBooking(slug");
    expect(src).toContain('step === "time"');
    expect(src).toContain('step === "done"');
    const loginSrc = await import("node:fs").then((m) => m.readFileSync("src/components/login.tsx", "utf8"));
    expect(loginSrc).toContain("Continue with Microsoft");
    expect(loginSrc).toContain("/api/auth/microsoft/url");
    expect(loginSrc).toContain("Continue with Google");
  });
});
