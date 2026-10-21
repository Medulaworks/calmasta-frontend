import { describe, expect, it } from "vitest";
import { type DocNode, docToMarkdown, docToText, exportFileName } from "./export";

const t = (text: string, ...marks: string[]): DocNode => ({ type: "text", text, marks: marks.map((type) => ({ type })) });
const p = (...c: DocNode[]): DocNode => ({ type: "paragraph", content: c });
const h = (level: number, text: string): DocNode => ({ type: "heading", attrs: { level }, content: [t(text)] });
const li = (...c: DocNode[]): DocNode => ({ type: "listItem", content: c });

const DOC: DocNode = {
  type: "doc",
  content: [
    h(1, "Client brief"),
    p(t("We "), t("agreed", "bold"), t(" to "), t("meet", "italic"), t(" and drop "), t("the old plan", "strike"), t(".")),
    h(2, "Decisions"),
    { type: "bulletList", content: [li(p(t("Map the handoff"))), li(p(t("Pick one to fix")), { type: "bulletList", content: [li(p(t("which one: not specified")))] })] },
    { type: "orderedList", attrs: { start: 1 }, content: [li(p(t("First"))), li(p(t("Second")))] },
    { type: "blockquote", content: [p(t("Quoted text"))] },
    { type: "horizontalRule" },
  ],
};

describe("docToMarkdown", () => {
  it("writes headings, marks, nested lists, quotes and rules", () => {
    expect(docToMarkdown(DOC)).toBe(
      [
        "# Client brief",
        "We **agreed** to *meet* and drop ~~the old plan~~.",
        "## Decisions",
        "- Map the handoff\n- Pick one to fix\n  - which one: not specified",
        "1. First\n2. Second",
        "> Quoted text",
        "---",
      ].join("\n\n") + "\n",
    );
  });

  it("escapes characters that would become formatting, so the text stays the text", () => {
    const md = docToMarkdown({ type: "doc", content: [p(t("2 * 3 = 6, snake_case, [not a link], `tick`"))] });
    expect(md).toBe("2 \\* 3 = 6, snake\\_case, \\[not a link\\], \\`tick\\`\n");
  });

  it("does not let a sentence that starts like Markdown become a heading, quote or list", () => {
    for (const line of ["# not a heading", "> not a quote", "- not a list", "1. not a list"]) {
      const md = docToMarkdown({ type: "doc", content: [p(t(line))] });
      expect(md.startsWith("\\"), line).toBe(true);
    }
  });

  it("keeps a code block verbatim and cannot be broken out of with backticks", () => {
    const md = docToMarkdown({ type: "doc", content: [{ type: "codeBlock", content: [t("a ``` b")] }] });
    expect(md).toBe("```\na ''' b\n```\n");
  });

  it("an empty document is just a newline", () => {
    expect(docToMarkdown({ type: "doc", content: [] })).toBe("\n");
  });
});

describe("docToText", () => {
  it("has no formatting characters, marks lists, and keeps paragraphs apart", () => {
    expect(docToText(DOC)).toBe(
      ["Client brief", "We agreed to meet and drop the old plan.", "Decisions", "• Map the handoff\n• Pick one to fix\n  • which one: not specified", "1. First\n2. Second", "> Quoted text", "---"].join("\n\n") + "\n",
    );
  });
  it("keeps special characters as they are", () => {
    expect(docToText({ type: "doc", content: [p(t("2 * 3 [x] _y_"))] })).toBe("2 * 3 [x] _y_\n");
  });
});

describe("exportFileName", () => {
  it("is safe and never empty", () => {
    expect(exportFileName("Q4 plan: client/brief?", "md")).toBe("Q4 plan_ client_brief_.md");
    expect(exportFileName("../../etc/passwd", "txt")).toBe("_.._etc_passwd.txt");
    expect(exportFileName("   ", "md")).toBe("document.md");
    expect(exportFileName("x".repeat(300), "md").length).toBe(83);
    expect(exportFileName(".hidden", "md")).toBe("hidden.md");
  });
});
