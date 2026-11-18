import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import {
  CheckoutStatusPanel,
  isIntentPointer,
  waitForActivation,
  type IntentOutcome,
} from "./checkout-status-view";
import { ApiError } from "@/lib/upload-client";
import type { CheckoutIntent } from "@/lib/commerce-client";

const ID = "e0a1b2c3-d4e5-4f60-87a1-2b3c4d5e6f7a";
const intent = (activationStatus: CheckoutIntent["activationStatus"]): CheckoutIntent => ({
  id: ID,
  sku: "calmasta-pack-1h",
  status: "confirmed",
  activationStatus,
  checkout_url: null,
});

it("accepts only well-formed intent pointers and never trusts status claims", () => {
  expect(isIntentPointer(ID)).toBe(true);
  expect(isIntentPointer("paid")).toBe(false);
  expect(isIntentPointer("?status=success")).toBe(false);
  expect(isIntentPointer("../../../etc/passwd")).toBe(false);
  expect(isIntentPointer(null)).toBe(false);
  expect(isIntentPointer(undefined)).toBe(false);
});

it("polls through pending until activation without creating orders", async () => {
  const load = vi
    .fn<() => Promise<CheckoutIntent>>()
    .mockResolvedValueOnce(intent("pending"))
    .mockResolvedValueOnce(intent("pending"))
    .mockResolvedValueOnce(intent("active"));
  const slept: number[] = [];
  const outcome = await waitForActivation(load, {
    intervalMs: 3000,
    timeoutMs: 60_000,
    now: (() => {
      const t = 0;
      return () => t;
    })(),
    sleep: async (ms) => {
      slept.push(ms);
    },
  });
  expect(outcome).toMatchObject({ kind: "active" });
  expect(load).toHaveBeenCalledTimes(3);
  expect(slept).toEqual([3000, 3000]);
});

it("reports blocked or failed verification with support guidance, not success", async () => {
  for (const activationStatus of ["blocked", "failed"] as const) {
    const outcome = await waitForActivation(async () => intent(activationStatus), {
      sleep: async () => {
        throw new Error("must not sleep on a terminal outcome");
      },
    });
    expect(outcome.kind).toBe("unavailable");
  }
});

it("maps expired sessions, foreign intents and expired checkouts distinctly", async () => {
  const noSleep = async () => {
    throw new Error("must not sleep");
  };
  await expect(
    waitForActivation(
      async () => {
        throw new ApiError(401, "Signed out", "unauthorized");
      },
      { sleep: noSleep },
    ),
  ).resolves.toMatchObject({ kind: "unauthorized" });
  await expect(
    waitForActivation(
      async () => {
        throw new ApiError(404, "Missing", "not_found");
      },
      { sleep: noSleep },
    ),
  ).resolves.toMatchObject({ kind: "foreign" });
  await expect(
    waitForActivation(async () => ({ ...intent("unpaid"), status: "expired" }), {
      sleep: noSleep,
    }),
  ).resolves.toMatchObject({ kind: "expired" });
});

it("gives up after the timeout and offers a manual refresh", async () => {
  let t = 0;
  const outcome = await waitForActivation(async () => intent("pending"), {
    intervalMs: 3000,
    timeoutMs: 60_000,
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
  });
  expect(outcome).toMatchObject({ kind: "timeout" });
});

function panel(outcome: IntentOutcome) {
  return renderToStaticMarkup(
    createElement(CheckoutStatusPanel, { outcome, onRetry: () => {} }),
  );
}

it("renders pending, success and blocked states without payment claims", () => {
  expect(panel({ kind: "pending" })).toContain("Waiting for the store");
  const active = panel({ kind: "active", intent: intent("active") });
  expect(active).toContain("Payment confirmed");
  expect(active).not.toContain("status=success");
  const blocked = panel({ kind: "unavailable", intent: intent("blocked") });
  expect(blocked).toContain("couldn’t confirm");
  expect(blocked).toContain("do not pay again");
});

it("renders invalid, expired, foreign, timeout and session states with next actions", () => {
  expect(panel({ kind: "invalid" })).toContain("incomplete");
  expect(panel({ kind: "expired" })).toContain("expired");
  expect(panel({ kind: "foreign" })).toContain("another workspace");
  const timeout = panel({ kind: "timeout" });
  expect(timeout).toContain("longer than usual");
  expect(timeout).toContain("Check again");
  const login = panel({ kind: "unauthorized", intentId: ID });
  expect(login).toContain("Sign in");
  expect(login).toContain(encodeURIComponent(`/billing/return?intent=${ID}`));
});
