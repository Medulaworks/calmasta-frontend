// Turns a document (the editor's own JSON structure) into Markdown or plain text for download or copy.
// Works from structure, not HTML, so it needs no browser and what goes out is exactly what is in the editor.
// Export is private: it happens in the user's browser and nothing is shared or uploaded.

export interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string }>;
  content?: DocNode[];
}

const kids = (n: DocNode) => n.content ?? [];

/** Characters that would turn plain words into Markdown formatting. */
const escapeMd = (s: string) => s.replace(/([\\`*_[\]])/g, "\\$1");

function inlineMd(nodes: DocNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      let t = escapeMd(n.text ?? "");
      if (!t) return "";
      const marks = new Set((n.marks ?? []).map((m) => m.type));
      if (marks.has("code")) return `\`${(n.text ?? "").replace(/`/g, "'")}\``;
      if (marks.has("bold")) t = `**${t}**`;
      if (marks.has("italic")) t = `*${t}*`;
      if (marks.has("strike")) t = `~~${t}~~`;
      return t;
    })
    .join("");
}

function inlineText(nodes: DocNode[]): string {
  return nodes.map((n) => (n.type === "hardBreak" ? "\n" : (n.text ?? ""))).join("");
}

const indent = (s: string, pad: string) => s.split("\n").map((l, i) => (i === 0 || l === "" ? l : pad + l)).join("\n");

function blockMd(n: DocNode): string {
  switch (n.type) {
    case "heading":
      return `${"#".repeat(Math.min(3, Math.max(1, Number(n.attrs?.level ?? 1))))} ${inlineMd(kids(n))}`;
    case "paragraph": {
      const t = inlineMd(kids(n));
      // A line that starts like Markdown syntax must be escaped to stay a paragraph.
      return t.replace(/^(\s*)(#{1,6}\s|>|[-+]\s|\d+\.\s)/, "$1\\$2");
    }
    case "bulletList":
      return kids(n).map((li) => `- ${indent(listItemMd(li), "  ")}`).join("\n");
    case "orderedList": {
      const start = Number(n.attrs?.start ?? 1);
      return kids(n).map((li, i) => `${start + i}. ${indent(listItemMd(li), "   ")}`).join("\n");
    }
    case "blockquote":
      return kids(n).map(blockMd).join("\n\n").split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
    case "codeBlock":
      return "```\n" + inlineText(kids(n)).replace(/```/g, "'''") + "\n```";
    case "horizontalRule":
      return "---";
    default:
      return inlineMd(kids(n));
  }
}
const listItemMd = (li: DocNode) => kids(li).map(blockMd).join("\n");

/** Markdown for the whole document. Blocks are separated by a blank line. */
export function docToMarkdown(doc: DocNode): string {
  return kids(doc).map(blockMd).filter((b) => b !== "").join("\n\n") + "\n";
}

function blockText(n: DocNode): string {
  switch (n.type) {
    case "bulletList":
      return kids(n).map((li) => `• ${indent(kids(li).map(blockText).join("\n"), "  ")}`).join("\n");
    case "orderedList": {
      const start = Number(n.attrs?.start ?? 1);
      return kids(n).map((li, i) => `${start + i}. ${indent(kids(li).map(blockText).join("\n"), "   ")}`).join("\n");
    }
    case "blockquote":
      return kids(n).map(blockText).join("\n\n").split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
    case "horizontalRule":
      return "---";
    default:
      return inlineText(kids(n));
  }
}

/** Plain text for the whole document: no formatting characters, lists marked with • and numbers. */
export function docToText(doc: DocNode): string {
  return kids(doc).map(blockText).filter((b) => b !== "").join("\n\n") + "\n";
}

/** A safe file name from a title: no path characters, never empty, never absurdly long. */
export function exportFileName(title: string, ext: "md" | "txt"): string {
  const base = title.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\s+/g, " ").replace(/^[.\s]+/, "").trim().slice(0, 80);
  return `${base || "document"}.${ext}`;
}
