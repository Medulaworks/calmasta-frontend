import { afterEach, expect, it, vi } from "vitest";
import { createEmailVerifier } from "./email-verification";

afterEach(() => vi.unstubAllGlobals());

it("shares one verification request across repeated effect subscriptions", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const verify = createEmailVerifier();
  const first = verify("fixture-token");
  expect(verify("fixture-token")).toBe(first);
  await first;
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/auth/verify-email", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: "fixture-token" }),
  });
});

it("does not verify missing tokens and allows a new link to start a new request", async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ ok: true })));
  vi.stubGlobal("fetch", fetch);
  const verify = createEmailVerifier();
  await expect(verify("")).rejects.toThrow("Open the link");
  expect(fetch).not.toHaveBeenCalled();
  await verify("first-token");
  await verify("second-token");
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("reports expired links and network failures without exposing tokens or raw errors", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: "invalid_or_expired_token" }, { status: 400 })).mockRejectedValueOnce(new Error("private token"));
  vi.stubGlobal("fetch", fetch);
  const verify = createEmailVerifier();
  await expect(verify("expired-token")).rejects.toThrow("expired or has already been used");
  await expect(verify("another-token")).rejects.toThrow("We can’t connect right now. Check your connection and try again.");
});
