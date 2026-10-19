import { describe, expect, it } from "vitest";
import { ROLES, defaultTemplateFor, isRole } from "./roles";
import { TEMPLATES } from "../server/domain/templates";

describe("roles", () => {
  it("every role maps to a real template", () => {
    for (const r of ROLES) expect(TEMPLATES.map((t) => t.id), r.id).toContain(r.template);
  });
  it("does not offer regulated fields yet", () => {
    expect(ROLES.map((r) => r.id)).not.toContain("healthcare");
    expect(ROLES.map((r) => r.id)).not.toContain("legal");
  });
  it("validates role ids", () => {
    expect(isRole("consultant")).toBe(true);
    for (const bad of ["healthcare", "", null, undefined, 3, "CONSULTANT"]) expect(isRole(bad), String(bad)).toBe(false);
  });
  it("falls back to a general template when the role is unknown or unset", () => {
    expect(defaultTemplateFor(null)).toBe("summary_and_actions");
    expect(defaultTemplateFor("nonsense")).toBe("summary_and_actions");
    expect(defaultTemplateFor("consultant")).toBe("consultant_brief");
  });
});
