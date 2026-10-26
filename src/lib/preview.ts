// Plain-text previews of stored content, for small panels. Output is only ever rendered as text (React escapes it),
// never as HTML, so a preview can't carry markup into the page.

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** The words of a document's HTML, in order, with block boundaries as spaces, cut at a word end near `max` characters. */
export function plainPreview(html: string, max = 600): string {
  const text = html
    .replace(/<\/(p|h[1-6]|li|blockquote|div|tr)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(" ");
  return `${(end > max * 0.6 ? cut.slice(0, end) : cut).trimEnd()}…`;
}
