import { describe, expect, it } from "vitest";
import { brandText, defaultBotName } from "./brand";

describe("brand", () => {
  it("renames the old product name in any spelling", () => {
    expect(brandText("CalMasta Notetaker")).toBe("Jooba Notetaker");
    expect(brandText("calmasta bot")).toBe("Jooba bot");
    expect(brandText("Acme Notetaker")).toBe("Acme Notetaker");
  });
  it("only replaces a server default that uses the old name", () => {
    expect(defaultBotName("CalMasta Notetaker")).toBe("Jooba Notetaker");
    expect(defaultBotName("Acme Notetaker")).toBeNull();
    expect(defaultBotName(null)).toBeNull();
    expect(defaultBotName("  ")).toBeNull();
  });
});
