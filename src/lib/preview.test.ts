import { describe, expect, it } from "vitest";
import { plainPreview } from "./preview";

describe("plainPreview", () => {
  it("keeps the words, separates blocks, and drops tags", () => {
    expect(plainPreview("<h1>Summary</h1><p>We agreed the <strong>budget</strong>.</p><ul><li>One</li><li>Two</li></ul>")).toBe("Summary We agreed the budget. One Two");
  });
  it("decodes the few entities the editor writes, once", () => {
    expect(plainPreview("<p>R&amp;D &lt;b&gt; &amp;amp; ok</p>")).toBe("R&D <b> &amp; ok");
  });
  it("never returns markup, even from hostile input", () => {
    expect(plainPreview('<p onclick="x()">hi</p><script>alert(1)</script><img src=x onerror=y>')).not.toMatch(/<|onerror/);
  });
  it("cuts long text at a word end and says so", () => {
    const long = `<p>${"word ".repeat(200)}</p>`;
    const p = plainPreview(long, 50);
    expect(p.length).toBeLessThanOrEqual(51);
    expect(p.endsWith("…")).toBe(true);
    expect(p).not.toMatch(/wor…$/);
  });
  it("returns an empty string for empty content", () => {
    expect(plainPreview("")).toBe("");
    expect(plainPreview("<p> </p>")).toBe("");
  });
});
