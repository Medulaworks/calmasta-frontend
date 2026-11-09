"use client";

/** An on/off switch. Give it a visible label somewhere and point `labelledBy` at it. */
export function Switch({ checked, onChange, labelledBy, disabled = false }: { checked: boolean; onChange: (next: boolean) => void; labelledBy: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60 ${checked ? "bg-accent-solid" : "bg-border"}`}>
      <span className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}
