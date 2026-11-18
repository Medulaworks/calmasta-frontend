import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_BOOT_SCRIPT } from "./theme-boot";

// The palette, in both modes, must keep text readable (WCAG AA, 4.5:1). This reads the real stylesheet, so editing a
// colour in globals.css can't quietly break contrast.
const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");

function vars(selector: string): Record<string, string> {
  const esc = selector.replace(/[[\]"=().:]/g, "\\$&");
  const m = css.match(new RegExp(`${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no block for ${selector}`);
  return Object.fromEntries(
    [...m[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((x) => [
      x[1],
      x[2].trim(),
    ]),
  );
}
const channel = (hex: string, i: number) =>
  parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
const luminance = (hex: string) => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * f(channel(hex, 0)) +
    0.7152 * f(channel(hex, 1)) +
    0.0722 * f(channel(hex, 2))
  );
};
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Resolves a plain #hex or `color-mix(in srgb, #a N%, #b)`. */
function colour(v: string): string {
  const m = v.match(
    /color-mix\(in srgb,\s*(#[0-9a-fA-F]{6})\s+(\d+)%,\s*(#[0-9a-fA-F]{6})\)/,
  );
  if (!m) return v;
  const p = Number(m[2]) / 100;
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(channel(m[1], i) * p + channel(m[3], i) * (1 - p))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["muted", "background"],
  ["muted", "surface"],
  ["accent", "background"],
  ["accent", "surface"],
  ["on-accent", "accent-solid"],
  ["sidebar-fg", "sidebar"],
  ["sidebar-muted", "sidebar"],
  ["sidebar-active-fg", "sidebar-active"],
  ["topbar-fg", "topbar"],
  ["success", "background"],
  ["warning", "background"],
  ["danger", "background"],
];

describe("palette", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`maroon and orange (${mode}) keeps every text colour readable`, () => {
      const v = vars(mode === "dark" ? ':root[data-mode="dark"]' : ":root");
      for (const [fg, bg] of PAIRS)
        expect(ratio(colour(v[fg]), colour(v[bg])), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("is the Joobah brand: maroon #7A2438 and orange #FAA21B", () => {
    const light = vars(":root");
    expect(light["accent"].toLowerCase()).toBe("#7a2438");
    expect(light["accent-solid"].toLowerCase()).toBe("#faa21b");
    expect(light["sidebar"].toLowerCase()).toBe("#7a2438");
  });

  it("has no colour themes to choose between", () => {
    expect(css).not.toContain("data-theme");
  });

  it("white text on the danger fill stays readable", () => {
    expect(
      ratio("#ffffff", vars(":root")["danger-solid"]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("the boot script restores the sidebar state, and anything unexpected means expanded", () => {
    const side = (store: Record<string, string>) => {
      const root = { dataset: {} as Record<string, string> };
      new Function("document", "localStorage", "window", THEME_BOOT_SCRIPT)(
        { documentElement: root },
        { getItem: (k: string) => store[k] ?? null },
        { matchMedia: () => ({ matches: false }) },
      );
      return root.dataset.sidebar;
    };
    expect(side({})).toBe("expanded");
    expect(side({ "MyJooba-sidebar": "collapsed" })).toBe("collapsed");
    expect(side({ "MyJooba-sidebar": "<x>" })).toBe("expanded");
  });

  it("the boot script always uses the one palette and only accepts known modes", () => {
    const run = (store: Record<string, string>, dark: boolean) => {
      const root = { dataset: {} as Record<string, string> };
      new Function("document", "localStorage", "window", THEME_BOOT_SCRIPT)(
        { documentElement: root },
        { getItem: (k: string) => store[k] ?? null },
        { matchMedia: () => ({ matches: dark }) },
      );
      return `${root.dataset.theme}/${root.dataset.mode}`;
    };
    expect(run({}, false)).toBe("a/light"); // system mode follows the device
    expect(run({}, true)).toBe("a/dark");
    expect(run({ "MyJooba-mode": "dark" }, false)).toBe("a/dark");
    expect(run({ "MyJooba-mode": "light" }, true)).toBe("a/light");
    // an old saved colour theme is ignored
    expect(run({ "MyJooba-theme": "d", "MyJooba-mode": "dark" }, false)).toBe("a/dark");
    expect(run({ "MyJooba-theme": "<script>", "MyJooba-mode": "neon" }, false)).toBe("a/light");
  });
});
