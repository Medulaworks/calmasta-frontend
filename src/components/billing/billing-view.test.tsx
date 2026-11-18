import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BillingView } from "./billing-view";
import type { CatalogResponse } from "@/lib/commerce-client";

const clients: QueryClient[] = [];

function render(catalog: CatalogResponse) {
  const qc = new QueryClient();
  clients.push(qc);
  qc.setQueryData(["commerce-catalog"], catalog);
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client: qc }, createElement(BillingView)),
  );
  return html;
}

const base: CatalogResponse = {
  available: true,
  checkoutEnabled: true,
  checkoutOrigins: ["https://woocommerce-585.s6-tastewp.com"],
  items: [],
  reason: null,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  clients.forEach((q) => q.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});

it("disables subscription offers and explains why without redirecting", () => {
  const html = render({
    ...base,
    items: [
      {
        sku: "calmasta-pack-1h",
        plan: "pack_1h",
        amount_cents: 900,
        currency: "usd",
        credits_seconds: 3600,
        is_subscription: false,
        checkoutEnabled: true,
        reason: null,
      },
      {
        sku: "calmasta-plan-pro",
        plan: "plan_pro",
        amount_cents: 2900,
        currency: "usd",
        credits_seconds: 7200,
        is_subscription: true,
        checkoutEnabled: false,
        reason: "subscriptions_unavailable",
      },
    ],
  });
  expect(html).toContain("calmasta-pack-1h");
  expect(html).toContain("Checkout");
  expect(html).toContain("Not available");
  expect(html).toMatch(/subscription/i);
  expect(fetch).not.toHaveBeenCalled();
});

it("shows an expired session instead of a generic failure", async () => {
  const { catalogErrorMessage } = await import("./billing-view");
  const { ApiError } = await import("@/lib/upload-client");
  expect(catalogErrorMessage(new ApiError(401, "Signed out", "unauthorized"))).toBe(
    "Your session ended. Please sign in again.",
  );
  expect(catalogErrorMessage(new ApiError(503, "Down"))).toBe("We couldn’t load the plans. Please try again.");
  expect(catalogErrorMessage(new Error("boom"))).toBe("We couldn’t load the plans. Please try again.");
});
