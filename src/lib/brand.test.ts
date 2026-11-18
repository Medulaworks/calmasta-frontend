import { describe, expect, it } from "vitest";
import { brandText, defaultBotName } from "./brand";

describe("brand", () => {
  it("renames the older product names in any spelling", () => {
    expect(brandText("CalMasta Notetaker")).toBe("Joobah Notetaker");
    expect(brandText("calmasta bot")).toBe("Joobah bot");
    expect(brandText("MyJooba Notetaker")).toBe("Joobah Notetaker");
    expect(brandText("Jooba Notetaker")).toBe("Joobah Notetaker");
    expect(brandText("Joobah Notetaker")).toBe("Joobah Notetaker");
    expect(brandText("Acme Notetaker")).toBe("Acme Notetaker");
  });
  it("only replaces a server default that uses an older name", () => {
    expect(defaultBotName("CalMasta Notetaker")).toBe("Joobah Notetaker");
    expect(defaultBotName("Jooba Notetaker")).toBe("Joobah Notetaker");
    expect(defaultBotName("Joobah Notetaker")).toBeNull();
    expect(defaultBotName("Acme Notetaker")).toBeNull();
    expect(defaultBotName(null)).toBeNull();
    expect(defaultBotName("  ")).toBeNull();
  });
});
