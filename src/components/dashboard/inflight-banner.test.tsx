import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InFlightBanner } from "./parts";
import type { DashboardItem } from "@/lib/dashboard-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/shell/use-display-title", () => ({ useDisplayTitle: () => (it: { title?: string | null }) => it.title ?? "Recording" }));

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("InFlightBanner", () => {
  it("returns null when items list is empty", () => {
    const out = html(createElement(InFlightBanner, { items: [] }));
    expect(out).toBe("");
  });

  it("renders active status for recently started recordings", () => {
    const item: DashboardItem = {
      id: "rec-1",
      kind: "recording",
      title: "Quick Thought",
      source: "voice_recording",
      state: "processing",
      status: "processing",
      failureReason: null,
      at: new Date().toISOString(),
      href: "/library/recordings/rec-1",
    };
    const out = html(createElement(InFlightBanner, { items: [item] }));
    expect(out).toContain("Transcribing");
    expect(out).toContain("Quick Thought");
    expect(out).toContain('aria-label="Dismiss in-flight status"');
  });

  it("displays 'Taking longer than usual' when recording has been processing for over 15 minutes", () => {
    const oldTimestamp = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    const item: DashboardItem = {
      id: "rec-old",
      kind: "recording",
      title: "Stalled Upload",
      source: "audio_upload",
      state: "processing",
      status: "processing",
      failureReason: null,
      at: oldTimestamp,
      href: "/library/recordings/rec-old",
    };
    const out = html(createElement(InFlightBanner, { items: [item] }));
    expect(out).toContain("Taking longer than usual");
    expect(out).toContain("Stalled Upload");
    expect(out).toContain('aria-label="Dismiss in-flight status"');
  });
});
