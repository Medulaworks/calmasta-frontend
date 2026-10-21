/** Wraps each case-insensitive occurrence of `query` in <mark>. Plain text in, plain text out: nothing is parsed as HTML. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i} className="rounded bg-accent/20 px-0.5 text-foreground">{part}</mark> : part))}
    </>
  );
}
