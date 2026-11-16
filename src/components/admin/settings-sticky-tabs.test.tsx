import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingsStickyTabs } from "./settings-view";

describe("SettingsStickyTabs", () => {
  it("renders horizontal navigation with 3 tabs in server rendering", () => {
    const html = renderToStaticMarkup(createElement(SettingsStickyTabs));
    expect(html).toContain("Recording");
    expect(html).toContain("Sharing");
    expect(html).toContain("Pause new work");
    expect(html).toContain('aria-label="Settings sections"');
    expect(html).toContain("sticky top-0");
  });
});
