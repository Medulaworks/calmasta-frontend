import { afterEach, expect, it, vi } from "vitest";
import { cancelDeletion, fetchDeletion, fetchPlan, requestDeletion } from "./plan-client";

afterEach(() => vi.unstubAllGlobals());

it("unimplemented plan and deletion operations report unavailable without making requests", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const operation of [fetchPlan, fetchDeletion, () => requestDeletion("DELETE"), cancelDeletion]) {
    await expect(operation()).rejects.toMatchObject({ status: 503, code: "feature_unavailable" });
  }
  expect(fetch).not.toHaveBeenCalled();
});
