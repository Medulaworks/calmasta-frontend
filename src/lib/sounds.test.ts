import { describe, expect, it } from "vitest";
import { SOUNDS } from "./sounds";

describe("sounds", () => {
  it("every sound is a few short, quiet notes inside the audible range", () => {
    for (const [name, notes] of Object.entries(SOUNDS)) {
      expect(notes.length, name).toBeGreaterThan(0);
      expect(notes.length, name).toBeLessThanOrEqual(4);
      for (const n of notes) {
        expect(n.f).toBeGreaterThan(200);
        expect(n.f).toBeLessThan(2000);
        expect(n.at).toBeGreaterThanOrEqual(0);
        expect(n.len).toBeLessThanOrEqual(0.7);
        expect(n.gain ?? 1).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...notes.map((n) => n.at + n.len)), name).toBeLessThan(1);
    }
  });
  it("starting rises and stopping falls", () => {
    const first = (k: keyof typeof SOUNDS) => SOUNDS[k].map((n) => n.f);
    const [a, b] = first("recordStart");
    expect(b).toBeGreaterThan(a);
    const [c, d] = first("recordStop");
    expect(d).toBeLessThan(c);
  });
});
