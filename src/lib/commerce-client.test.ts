import { afterEach, expect, it, vi } from "vitest";
import {
  CHECKOUT_RETURN_PATH,
  checkoutUnavailableMessage,
  commerceRequest,
  createCheckout,
  getCatalog,
  getCheckoutIntent,
  getPortal,
  isTrustedCheckoutUrl,
  newIdempotencyKey,
} from "./commerce-client";
import { ApiError } from "./upload-client";

const fetcher = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  fetcher.mockReset();
});

function setup() {
  vi.stubGlobal("fetch", fetcher);
}

it("keeps JSON Content-Type when the caller passes its own headers", async () => {
  setup();
  fetcher.mockResolvedValue(json({ ok: true }));
  await commerceRequest("/api/commerce/catalog", {
    headers: { "X-Custom": "yes" },
  });
  const headers = new Headers(fetcher.mock.calls[0][1].headers);
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(headers.get("X-Custom")).toBe("yes");
});

it("never lets caller headers silently discard the JSON Content-Type", async () => {
  setup();
  fetcher.mockResolvedValue(json({ ok: true }));
  await commerceRequest("/api/commerce/catalog", {
    headers: { "Content-Type": "text/plain" },
  });
  expect(new Headers(fetcher.mock.calls[0][1].headers).get("Content-Type")).toBe(
    "application/json",
  );
});

it("creates checkout with a relative return path and a UUID idempotency key", async () => {
  setup();
  fetcher.mockResolvedValue(
    json({ id: "intent-1", status: "pending", checkout_url: null }),
  );
  await createCheckout("calmasta-pack-1h");
  expect(fetcher.mock.calls[0][0]).toBe("/api/commerce/checkout");
  const init = fetcher.mock.calls[0][1];
  expect(JSON.parse(init.body)).toEqual({
    sku: "calmasta-pack-1h",
    returnUrl: "/billing/return",
  });
  expect(CHECKOUT_RETURN_PATH).toBe("/billing/return");
  const key = new Headers(init.headers).get("Idempotency-Key");
  expect(key).toMatch(/^[a-f0-9-]{36}$/i);
});

it("reuses a caller-supplied idempotency key for retries of the same attempt", async () => {
  setup();
  fetcher.mockResolvedValue(
    json({ id: "intent-1", status: "pending", checkout_url: null }),
  );
  await createCheckout("calmasta-pack-1h", "/billing/return", "stable-key-1");
  await createCheckout("calmasta-pack-1h", "/billing/return", "stable-key-1");
  const keys = fetcher.mock.calls.map(([, init]) =>
    new Headers(init.headers).get("Idempotency-Key"),
  );
  expect(keys).toEqual(["stable-key-1", "stable-key-1"]);
  expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
});

it("propagates backend error codes without inventing success", async () => {
  setup();
  fetcher.mockResolvedValueOnce(json({ error: "Unknown", code: "unknown_sku" }, 400));
  await expect(createCheckout("nope")).rejects.toMatchObject({
    status: 400,
    code: "unknown_sku",
  });
  fetcher.mockImplementation(() =>
    Promise.resolve(
      json({ error: "Conflict", code: "idempotency_conflict" }, 409),
    ),
  );
  await expect(getCatalog()).rejects.toBeInstanceOf(ApiError);
  await expect(getCatalog()).rejects.toMatchObject({
    status: 409,
    code: "idempotency_conflict",
  });
});

it("types checkout_url as nullable and returns null without redirecting", async () => {
  setup();
  fetcher.mockResolvedValue(
    json({ id: "intent-1", status: "pending", checkout_url: null }),
  );
  const created = await createCheckout("calmasta-pack-1h");
  expect(created.checkout_url).toBeNull();
  fetcher.mockResolvedValue(
    json({ id: "intent-1", status: "pending", checkout_url: null }),
  );
  const intent = await getCheckoutIntent(
    "e0a1b2c3-d4e5-4f60-87a1-2b3c4d5e6f7a1",
  );
  expect(intent.checkout_url).toBeNull();
  expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
    "/api/commerce/checkout/e0a1b2c3-d4e5-4f60-87a1-2b3c4d5e6f7a1",
  );
});

it("reads the billing portal url as nullable", async () => {
  setup();
  fetcher.mockResolvedValue(json({ url: null }));
  await expect(getPortal()).resolves.toEqual({ url: null });
});

it("only trusts https checkout destinations from server-published origins", () => {
  const origins = ["https://woocommerce-585.s6-tastewp.com"];
  expect(
    isTrustedCheckoutUrl(
      "https://woocommerce-585.s6-tastewp.com/checkout/order-pay/1",
      origins,
    ),
  ).toBe(true);
  expect(isTrustedCheckoutUrl("http://woocommerce-585.s6-tastewp.com/x", origins)).toBe(
    false,
  );
  expect(isTrustedCheckoutUrl("https://evil.example.com/x", origins)).toBe(false);
  expect(isTrustedCheckoutUrl("/billing/return", origins)).toBe(false);
  expect(isTrustedCheckoutUrl(null, origins)).toBe(false);
  expect(
    isTrustedCheckoutUrl("https://woocommerce-585.s6-tastewp.com/x", []),
  ).toBe(false);
  expect(
    isTrustedCheckoutUrl("https://woocommerce-585.s6-tastewp.com/x", null),
  ).toBe(false);
});

it("explains unavailable offers with actionable guidance", () => {
  expect(checkoutUnavailableMessage("subscriptions_unavailable")).toMatch(
    /subscription/i,
  );
  expect(checkoutUnavailableMessage("checkout_bridge_unavailable")).toMatch(
    /checkout|available/i,
  );
  expect(checkoutUnavailableMessage("busy")).toMatch(/busy|try again/i);
  expect(checkoutUnavailableMessage(null)).toMatch(/not available|unavailable/i);
});
