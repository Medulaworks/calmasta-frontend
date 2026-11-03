import { afterEach, describe, expect, it, vi } from "vitest";

// The preview opens the staff screens with sample data, so the important tests are about when it can NOT be on.
const load = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) v === undefined ? vi.unstubAllEnvs() : vi.stubEnv(k, v);
  return import("./admin-preview");
};
afterEach(() => vi.unstubAllEnvs());

describe("admin preview switch", () => {
  it("is off by default", async () => {
    expect((await load({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_PREVIEW: "" })).ADMIN_PREVIEW).toBe(false);
  });
  it("is off in production even when the flag is set", async () => {
    expect((await load({ NODE_ENV: "production", NEXT_PUBLIC_ADMIN_PREVIEW: "1" })).ADMIN_PREVIEW).toBe(false);
  });
  it("only turns on in development with the flag exactly 1", async () => {
    expect((await load({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_PREVIEW: "true" })).ADMIN_PREVIEW).toBe(false);
    expect((await load({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_PREVIEW: "1" })).ADMIN_PREVIEW).toBe(true);
  });
});

describe("sample data", () => {
  it("answers every staff screen and filters like the real thing", async () => {
    const { previewGet } = await load({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_PREVIEW: "1" });
    expect((await previewGet<{ queue: unknown }>("/api/admin/overview")).queue).toBeTruthy();
    expect((await previewGet<{ users: unknown[]; nextCursor: string | null }>("/api/admin/customers?q=grace@example")).users).toHaveLength(1);
    const first = await previewGet<{ users: unknown[]; nextCursor: string | null; total: number }>("/api/admin/customers");
    expect(first.users).toHaveLength(10);
    expect(first.nextCursor).toBe("10");
    expect((await previewGet<{ users: unknown[] }>("/api/admin/customers?cursor=30")).users.length).toBeGreaterThan(0);
    expect((await previewGet<{ rows: unknown[] }>("/api/admin/webhooks?filter=attention")).rows).toHaveLength(1);
    expect((await previewGet<{ rows: { source: string }[] }>("/api/admin/registry?filter=staff")).rows.every((r) => r.source === "staff")).toBe(true);
  });
  it("refuses endpoints it has no sample for instead of inventing data", async () => {
    const { previewGet } = await load({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_PREVIEW: "1" });
    await expect(previewGet("/api/admin/nonsense")).rejects.toThrow(/no sample data/);
  });
  it("actions change the sample data in memory only", async () => {
    const { previewGet, previewPost } = await load({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_PREVIEW: "1" });
    await previewPost("/api/admin/controls/processing", { paused: true, reason: "test" });
    expect((await previewGet<{ paused: { paused: boolean } }>("/api/admin/usage")).paused.paused).toBe(true);
    await previewPost("/api/admin/controls/processing", { paused: false, reason: "test" });
    expect((await previewGet<{ paused: { paused: boolean } }>("/api/admin/usage")).paused.paused).toBe(false);
  });
});

describe("staff console data", () => {
  const preview = () => load({ NODE_ENV: "development", NEXT_PUBLIC_ADMIN_PREVIEW: "1" });

  it("filters the user directory and pages it", async () => {
    const { previewGet } = await preview();
    const pro = await previewGet<{ users: { plan: string }[]; total: number }>("/api/admin/customers?plan=pro");
    expect(pro.users.length).toBeGreaterThan(0);
    expect(pro.users.every((u) => u.plan === "pro")).toBe(true);
    const none = await previewGet<{ users: unknown[]; total: number }>("/api/admin/customers?q=zzzz-no-such-person");
    expect(none.users).toHaveLength(0);
    expect(none.total).toBe(0);
  });

  it("rejects a settings change made against an old version", async () => {
    const { previewGet, previewPost } = await preview();
    const s = await previewGet<{ version: number }>("/api/admin/settings");
    await expect(previewPost("/api/admin/settings", { version: s.version - 1, changes: { RECALL_BOT_NAME: "X" }, reason: "stale edit" }, "PATCH")).rejects.toMatchObject({ code: "version_conflict" });
    await expect(previewPost("/api/admin/settings", { version: s.version, changes: { GLOBAL_SPEND_GUARD_USD_PER_DAY: 10 }, reason: "not editable" }, "PATCH")).rejects.toMatchObject({ code: "not_editable" });
  });

  it("never returns a stored secret", async () => {
    const { previewGet } = await preview();
    const list = await previewGet<{ fields: { kind: string; value?: string }[] }[]>("/api/admin/integrations");
    for (const i of list) for (const f of i.fields) if (f.kind === "secret") expect(f.value).toBeUndefined();
  });

  it("rate-limits repeated recovery emails and records actions in the audit log", async () => {
    const { previewGet, previewPost } = await preview();
    const id = (await previewGet<{ users: { id: string }[] }>("/api/admin/customers")).users[0].id;
    await previewPost(`/api/admin/customers/${id}/actions`, { action: "send_recovery", reason: "user locked out" });
    await expect(previewPost(`/api/admin/customers/${id}/actions`, { action: "send_recovery", reason: "user locked out" })).rejects.toMatchObject({ status: 429 });
    const audit = await previewGet<{ entries: { action: string }[] }>("/api/admin/audit");
    expect(audit.entries[0].action).toBe("Sent a password reset email");
  });
});

describe("capabilities", () => {
  it("blocks staff actions with a reason when neither preview nor the API is on", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_PREVIEW", "");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_API", "");
    const { capability } = await import("./admin-capabilities");
    expect(capability("settings_edit")).toMatchObject({ allowed: false });
    expect(capability("settings_edit").reason).toMatch(/Not available yet/);
    expect(capability("user_staff_role").allowed).toBe(false);
  });
  it("never allows staff-role changes or audit export, even in preview", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_PREVIEW", "1");
    const { capability } = await import("./admin-capabilities");
    expect(capability("user_suspend").allowed).toBe(true);
    expect(capability("user_staff_role").allowed).toBe(false);
    expect(capability("export_audit").allowed).toBe(false);
  });
});

describe("preview admins and invites", () => {
  const open = async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_PREVIEW", "1");
    return import("./admin-preview");
  };
  type M = Awaited<ReturnType<typeof open>>;
  type Staff = { admins: Array<{ id: string; email: string; you: boolean }>; invites: Array<{ id: string; email: string; expiresAt: string }> };
  const staff = (m: M) => m.previewGet<Staff>("/api/admin/staff");
  const invite = (m: M, body: Record<string, unknown>) => m.previewPost("/api/admin/staff/invites", body);

  it("invites by email without a password or typed reason, and records it", async () => {
    const m = await open();
    await invite(m, { email: " New.Person@Example.test ", note: "Welcome to support" });
    const { invites } = await staff(m);
    expect(invites[0].email).toBe("new.person@example.test");
    expect(new Date(invites[0].expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    const audit = await m.previewGet<{ entries: Array<{ action: string; reason: string | null }> }>("/api/admin/audit?action=Invited%20an%20admin");
    expect(audit.entries[0]).toMatchObject({ action: "Invited an admin", reason: "Note: Welcome to support" });
  });
  it("does not invite bad emails, current admins, or someone with an invite already waiting", async () => {
    const m = await open();
    await expect(invite(m, { email: "not-an-email" })).rejects.toMatchObject({ code: "invalid_email" });
    await expect(invite(m, { email: "kim@jooba.test" })).rejects.toMatchObject({ code: "already_admin" });
    await expect(invite(m, { email: "lena@example.test" })).rejects.toMatchObject({ code: "already_invited" });
  });
  it("replaces an expired invite instead of refusing it", async () => {
    const m = await open();
    await invite(m, { email: "noah.kim@example.test" });
    const { invites } = await staff(m);
    expect(invites.filter((i) => i.email === "noah.kim@example.test")).toHaveLength(1);
    expect(new Date(invites.find((i) => i.email === "noah.kim@example.test")!.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
  it("resends once a minute and can cancel", async () => {
    const m = await open();
    const id = (await staff(m)).invites[0].id;
    await m.previewPost(`/api/admin/staff/invites/${id}/resend`, {});
    await expect(m.previewPost(`/api/admin/staff/invites/${id}/resend`, {})).rejects.toMatchObject({ code: "too_many_requests" });
    await m.previewPost(`/api/admin/staff/invites/${id}/cancel`, {});
    expect((await staff(m)).invites.some((i) => i.id === id)).toBe(false);
  });
  it("removes another admin but never yourself or the last admin", async () => {
    const m = await open();
    const [me, kim, sam] = (await staff(m)).admins;
    expect(me.you).toBe(true);
    await expect(m.previewPost(`/api/admin/staff/${me.id}/remove`, {})).rejects.toMatchObject({ code: "cannot_remove_self" });
    await m.previewPost(`/api/admin/staff/${kim.id}/remove`, {});
    await m.previewPost(`/api/admin/staff/${sam.id}/remove`, {});
    expect((await staff(m)).admins.map((a) => a.email)).toEqual(["preview@jooba.test"]);
  });
});

describe("preview plans (the app's three plans, one yearly discount, extra-hours packs)", () => {
  const open = async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_PREVIEW", "1");
    return import("./admin-preview");
  };
  type M = Awaited<ReturnType<typeof open>>;
  type L = { plans: Array<{ id: string; monthlyCents: number; allowanceMinutes: number; checkoutMonthlyUrl: string | null }>; packs: Array<{ sku: string; label: string; minutes: number }>; annualDiscountPct: number; enterpriseUrl: string | null };
  const get = (m: M) => m.previewGet<L>("/api/admin/plans");
  const edit = (m: M, id: string, body: Record<string, unknown>) => m.previewPost(`/api/admin/plans/${id}`, body, "PATCH");

  it("lists exactly Free, Pro and Business", async () => {
    const m = await open();
    expect((await get(m)).plans.map((p) => p.id)).toEqual(["free", "pro", "business"]);
  });
  it("changes a plan's price, hours and checkout link, and records it", async () => {
    const m = await open();
    await edit(m, "pro", { tagline: "x", monthlyCents: 2100, allowanceMinutes: 900, checkoutMonthlyUrl: "https://shop.example.test/new", checkoutYearlyUrl: null });
    expect((await get(m)).plans.find((p) => p.id === "pro")).toMatchObject({ monthlyCents: 2100, allowanceMinutes: 900, checkoutMonthlyUrl: "https://shop.example.test/new" });
    const audit = await m.previewGet<{ entries: Array<{ action: string }> }>("/api/admin/audit?action=Changed%20a%20plan%27s%20price");
    expect(audit.entries[0].action).toBe("Changed a plan's price");
  });
  it("keeps Free free, requires a price on paid plans and only accepts https links", async () => {
    const m = await open();
    await expect(edit(m, "free", { tagline: "", monthlyCents: 500, allowanceMinutes: 120 })).rejects.toMatchObject({ code: "free_plan_locked" });
    await expect(edit(m, "pro", { tagline: "", monthlyCents: 0, allowanceMinutes: 600 })).rejects.toMatchObject({ code: "invalid_price" });
    await expect(edit(m, "pro", { tagline: "", monthlyCents: 1900.5, allowanceMinutes: 600 })).rejects.toMatchObject({ code: "invalid_price" });
    await expect(edit(m, "pro", { tagline: "", monthlyCents: 1900, allowanceMinutes: 600, checkoutMonthlyUrl: "http://insecure.test" })).rejects.toMatchObject({ code: "invalid_url" });
  });
  it("sets the one yearly discount for every paid plan", async () => {
    const m = await open();
    await m.previewPost("/api/admin/plans/pricing", { annualDiscountPct: 25, enterpriseUrl: "https://example.test/talk" }, "PATCH");
    expect(await get(m)).toMatchObject({ annualDiscountPct: 25, enterpriseUrl: "https://example.test/talk" });
    await expect(m.previewPost("/api/admin/plans/pricing", { annualDiscountPct: 120 }, "PATCH")).rejects.toMatchObject({ code: "invalid_discount" });
  });
  it("adds, edits and deletes extra-hours packs, one per size", async () => {
    const m = await open();
    await m.previewPost("/api/admin/plans/packs", { label: "10 hours", minutes: 600, checkoutUrl: null });
    expect((await get(m)).packs.map((k) => k.minutes)).toEqual([60, 300, 600, 1200]);
    await expect(m.previewPost("/api/admin/plans/packs", { label: "Again", minutes: 600 })).rejects.toMatchObject({ code: "duplicate_pack" });
    await m.previewPost("/api/admin/plans/packs/pack-600", { label: "Ten hours", minutes: 600, checkoutUrl: null }, "PATCH");
    await m.previewPost("/api/admin/plans/packs/pack-600/delete", {});
    expect((await get(m)).packs.map((k) => k.sku)).toEqual(["pack-60", "pack-300", "pack-1200"]);
  });
});

describe("preview business numbers", () => {
  type B = { period: { key: string; from: string | null; to: string }; newUsers: number; totalUsers: number; activeUsers: number; paidSubscribers: { total: number; pro: number; business: number }; revenue: { cents: number; previousCents: number | null }; meetings: { total: number; failed: number }; costCents: number; costTargetCents: number | null };
  const open = async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_PREVIEW", "1");
    return import("./admin-preview");
  };
  const get = async (q: string) => (await (await open()).previewGet<{ business: B }>(`/api/admin/overview${q}`)).business;

  it("monthly revenue agrees with the plans and their subscribers", async () => {
    const m = await open();
    const b = (await m.previewGet<{ business: B }>("/api/admin/overview?period=month")).business;
    const plans = (await m.previewGet<{ plans: Array<{ monthlyCents: number; subscribers: number }> }>("/api/admin/plans")).plans;
    expect(b.revenue.cents).toBe(plans.reduce((t, p) => t + p.monthlyCents * p.subscribers, 0));
    expect(b.paidSubscribers.total).toBe(b.paidSubscribers.pro + b.paidSubscribers.business);
    expect(b.revenue.previousCents!).toBeLessThan(b.revenue.cents);
    expect(b.totalUsers).toBeGreaterThan(b.paidSubscribers.total);
  });
  it("a longer period covers more, and all time covers everything", async () => {
    const [day, week, month, all] = await Promise.all(["?period=day", "?period=week", "?period=month", "?period=all"].map(get));
    expect(week.revenue.cents).toBeGreaterThan(day.revenue.cents);
    expect(month.meetings.total).toBeGreaterThan(week.meetings.total);
    expect(month.activeUsers).toBeGreaterThan(week.activeUsers);
    expect(all.newUsers).toBe(all.totalUsers);
    expect(all.revenue.previousCents).toBeNull();
    expect(week.revenue.previousCents).not.toBeNull();
  });
  it("a date range covers exactly its days, and is refused when it makes no sense", async () => {
    const one = await get("?period=range&from=2026-10-01&to=2026-10-01");
    const ten = await get("?period=range&from=2026-10-01&to=2026-10-10");
    expect(one.period).toMatchObject({ key: "range", from: "2026-10-01", to: "2026-10-01" });
    expect(ten.revenue.cents).toBeGreaterThan(one.revenue.cents * 9);
    const m = await open();
    for (const q of ["?period=range", "?period=range&from=2026-10-10&to=2026-10-01", "?period=range&from=2099-01-01&to=2099-01-02"]) await expect(m.previewGet(`/api/admin/overview${q}`), q).rejects.toMatchObject({ code: "invalid_range" });
  });
  it("the monthly cost target only appears for a month", async () => {
    expect((await get("?period=month")).costTargetCents).toBe(10000);
    expect((await get("?period=week")).costTargetCents).toBeNull();
  });
});
