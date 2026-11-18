import { Fragment } from "react";

// The Joobah logo files live in /public/brand. The lockup (mark and wordmark) is 3.98 times as wide as it is tall.
const LOCKUP_RATIO = 395.73 / 99.46;

type Tone = "paper" | "auto";

/**
 * One logo file, in the right colours. Pass `tile="paper"` on a dark surface (the sidebar) to get the version whose burgundy
 * drops are white. With `"auto"` (a light surface) it uses the standard logo, and swaps to the on-dark one in dark mode.
 */
function Logo({ kind, height, tone }: { kind: "horizontal" | "mark"; height: number; tone: Tone }) {
  const width = kind === "horizontal" ? Math.round(height * LOCKUP_RATIO) : height;
  const base = `/brand/joobah-${kind}`;
  const common = { width, height, draggable: false as const, style: { height, width } };
  /* eslint-disable @next/next/no-img-element */
  return tone === "paper" ? (
    <img src={`${base}-on-dark.svg`} alt="Joobah" {...common} className="shrink-0" />
  ) : (
    <Fragment>
      <img src={`${base}.svg`} alt="Joobah" {...common} className="shrink-0 dark:hidden" />
      <img src={`${base}-on-dark.svg`} alt="" aria-hidden {...common} className="hidden shrink-0 dark:block" />
    </Fragment>
  );
  /* eslint-enable @next/next/no-img-element */
}

/** The Joobah mark on its own (the two drops). */
export function BrandMark({ size = 28, tile = "auto", className = "" }: { size?: number; tile?: Tone; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <Logo kind="mark" height={size} tone={tile} />
    </span>
  );
}

/**
 * The Joobah logo: mark and wordmark together. `size` is the height. With `collapsible`, the full logo gives way to just the mark
 * when the sidebar is narrowed to its icon rail.
 */
export function Brand({ size = 28, tile = "auto", className = "", labelClassName = "", collapsible = false }: { size?: number; tile?: Tone; className?: string; labelClassName?: string; collapsible?: boolean }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className={`inline-flex ${labelClassName}`}>
        <Logo kind="horizontal" height={size} tone={tile} />
      </span>
      {collapsible && (
        <span className="hidden sc:md:inline-flex">
          <Logo kind="mark" height={size} tone={tile} />
        </span>
      )}
    </span>
  );
}
