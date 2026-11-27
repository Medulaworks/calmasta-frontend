import { describe, expect, it } from "vitest";
import { SECTIONS, sectionFor, tabActive } from "./admin-nav";

describe("Admin Navigation - Email Templates Tab", () => {
  it("includes the Email templates tab under settings section", () => {
    const settings = SECTIONS.find((s) => s.id === "settings");
    expect(settings).toBeDefined();
    const emailTab = settings?.tabs.find((t) => t.href.endsWith("/emails"));
    expect(emailTab).toBeDefined();
    expect(emailTab?.label).toBe("Email templates");
    expect(emailTab?.hint).toBe("Subjects, body copy, and button text");
  });

  it("resolves /admin/emails to the settings section", () => {
    const section = sectionFor("/admin/emails");
    expect(section?.id).toBe("settings");
  });

  it("marks /admin/emails active when on the emails page", () => {
    const tab = { href: "/admin/emails", label: "Email templates" };
    expect(tabActive("/admin/emails", tab)).toBe(true);
    expect(tabActive("/admin/plans", tab)).toBe(false);
  });
});
