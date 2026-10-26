import type { CSSProperties } from "react";

const leaf = (src: string, color: string): CSSProperties => ({
  position: "absolute",
  inset: 0,
  backgroundColor: color,
  WebkitMaskImage: `url(${src})`,
  maskImage: `url(${src})`,
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
});

/**
 * The Mojooba mark, drawn as two masks so each theme can re-ink the leaves (--leaf-a, --leaf-b).
 * `tile="paper"` always sits it on a light tile (for dark sidebars); `"auto"` only does in dark mode, where the dark
 * leaves would otherwise vanish.
 */
export function BrandMark({ size = 28, tile = "auto" }: { size?: number; tile?: "paper" | "auto" }) {
  const pad = Math.max(2, Math.round(size * 0.08));
  return (
    <span aria-hidden className={`inline-block shrink-0 rounded-lg ${tile === "paper" ? "bg-[#f7f5f1]" : "dark:bg-[#f7f5f1]"}`} style={{ width: size, height: size, padding: pad }}>
      <span className="relative block h-full w-full">
        <span style={leaf("/mojooba-leaf-a.png", "var(--leaf-a)")} />
        <span style={leaf("/mojooba-leaf-b.png", "var(--leaf-b)")} />
      </span>
    </span>
  );
}

/** Mark plus the name, set in lower case like the logo. The name is real text, so it scales and is read aloud. */
export function Brand({ size = 28, tile = "auto", className = "", labelClassName = "" }: { size?: number; tile?: "paper" | "auto"; className?: string; labelClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <BrandMark size={size} tile={tile} />
      <span aria-label="Mojooba" className={labelClassName}>mojooba</span>
    </span>
  );
}
