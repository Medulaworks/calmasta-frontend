"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { MODES, type Mode, THEMES, useThemeChoice } from "@/lib/theme";
import { useAppearancePreferences } from "./appearance-provider";

const MODE_ICON = { light: Sun, dark: Moon, system: Monitor } as const;
export { MODE_ICON };

// "menu" is for inside the account menu; "page" is for the Settings page, where the same choices are radio buttons.
type Variant = "menu" | "page";
const role = (v: Variant) => (v === "menu" ? "menuitemradio" : "radio");
const optionRow = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface";

/** Light, dark, or follow the device. Separate from the colour theme: any theme works in any mode. */
export function ModeOptions({ variant = "menu" }: { variant?: Variant }) {
  const { mode } = useThemeChoice();
  const { ready, saving, error, failedField, choose } = useAppearancePreferences();
  if (variant === "page") {
    return (
      <div>
        <div role="radiogroup" aria-label="Mode" className="grid grid-cols-3 gap-3">
          {MODES.map((m) => {
            const Icon = MODE_ICON[m.id as Mode];
            const on = mode === m.id;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={on} disabled={!ready || saving} onClick={() => void choose({ mode: m.id })} className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-50 ${on ? "border-accent-solid bg-accent-solid/10 ring-1 ring-accent-solid" : "border-border hover:bg-surface"}`}>
                <Icon aria-hidden className={`size-5 ${on ? "text-accent" : "text-muted"}`} />
                {m.label}
                {on && <Check aria-hidden className="absolute right-2 top-2 size-4 text-accent" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        {error && failedField === "mode" && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div role={variant === "menu" ? "group" : "radiogroup"} aria-label="Mode" className={variant === "menu" ? "px-1 pb-2 pt-1" : "space-y-1"}>
      {MODES.map((m) => {
        const Icon = MODE_ICON[m.id as Mode];
        return (
          <button key={m.id} type="button" role={role(variant)} aria-checked={mode === m.id} disabled={!ready || saving} onClick={() => void choose({ mode: m.id })} className={`${optionRow} disabled:opacity-50 disabled:cursor-wait`}>
            <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted" />
            <span className="flex-1 font-medium">{m.label}</span>
            {m.id === "system" && <span className="text-xs text-muted">Match this device</span>}
            {mode === m.id && <Check aria-hidden className="h-4 w-4 shrink-0 text-accent" />}
          </button>
        );
      })}
      {error && failedField === "mode" && <p role="alert" className="px-3 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** The five colour themes. */
export function ThemeOptions({ variant = "menu" }: { variant?: Variant }) {
  const { theme } = useThemeChoice();
  const { ready, saving, error, failedField, choose } = useAppearancePreferences();
  if (variant === "page") {
    return (
      <div>
        <div role="radiogroup" aria-label="Colour theme" className="grid gap-3 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2">
          {THEMES.map((t) => {
            const on = theme === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} disabled={!ready || saving} onClick={() => void choose({ theme: t.id })} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-wait disabled:opacity-50 ${on ? "border-accent-solid bg-accent-solid/10 ring-1 ring-accent-solid" : "border-border hover:bg-surface"}`}>
                <span aria-hidden className="flex shrink-0">
                  <span className="size-8 rounded-full border border-border" style={{ background: t.anchor }} />
                  <span className="-ml-3 size-8 rounded-full border border-border" style={{ background: t.hero }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.label}</span>
                  <span className="block truncate text-xs text-muted">{t.note}</span>
                </span>
                {on && <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-solid text-on-accent"><Check className="size-3" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
        {error && failedField === "theme" && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div role={variant === "menu" ? "group" : "radiogroup"} aria-label="Colour theme" className={variant === "menu" ? "px-1 pb-2 pt-1" : "space-y-1"}>
      {THEMES.map((t) => (
        <button key={t.id} type="button" role={role(variant)} aria-checked={theme === t.id} disabled={!ready || saving} onClick={() => void choose({ theme: t.id })} className={`${optionRow} disabled:opacity-50 disabled:cursor-wait`}>
          <span aria-hidden className="flex shrink-0">
            <span className="h-5 w-5 rounded-full border border-border" style={{ background: t.anchor }} />
            <span className="-ml-2 h-5 w-5 rounded-full border border-border" style={{ background: t.hero }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{t.label}</span>
            <span className="block truncate text-xs text-muted">{t.note}</span>
          </span>
          {theme === t.id && <Check aria-hidden className="h-4 w-4 shrink-0 text-accent" />}
        </button>
      ))}
      {error && failedField === "theme" && <p role="alert" className="px-3 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** A label that appears above a control on hover or keyboard focus, for controls that are only an icon. */
function Tip({ text, end = false }: { text: string; end?: boolean }) {
  // The last control in a row lines its tooltip up with its right edge, so it never pokes out of the menu and makes it scroll sideways.
  return <span aria-hidden className={`pointer-events-none absolute -top-9 z-10 whitespace-nowrap ${end ? "right-0" : "left-1/2 -translate-x-1/2"} rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100`}>{text}</span>;
}

/** Light, dark and system as three icons in one pill, each with a tooltip. For the account menu. */
export function ModeIcons() {
  const { mode } = useThemeChoice();
  const { ready, saving, choose } = useAppearancePreferences();
  return (
    <div role="group" aria-label="Mode" className="flex gap-1 rounded-lg bg-surface p-1 ring-1 ring-border">
      {MODES.map((m, i) => {
        const Icon = MODE_ICON[m.id as Mode];
        const on = mode === m.id;
        const label = m.id === "system" ? "System (match this device)" : m.label;
        return (
          <button key={m.id} type="button" role="menuitemradio" aria-checked={on} aria-label={label} disabled={!ready || saving} onClick={() => void choose({ mode: m.id })} className={`group relative grid size-8 place-items-center rounded-md transition-colors disabled:cursor-wait disabled:opacity-50 ${on ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}>
            <Icon aria-hidden className="size-4" />
            <Tip text={label} end={i === MODES.length - 1} />
          </button>
        );
      })}
    </div>
  );
}

/** The colour themes as small two-tone swatches, each with a tooltip. For the account menu. */
export function ThemeSwatches() {
  const { theme } = useThemeChoice();
  const { ready, saving, choose } = useAppearancePreferences();
  return (
    <div role="group" aria-label="Colour theme" className="flex items-center gap-2">
      {THEMES.map((t, i) => {
        const on = theme === t.id;
        return (
          <button key={t.id} type="button" role="menuitemradio" aria-checked={on} aria-label={`${t.label}. ${t.note}`} disabled={!ready || saving} onClick={() => void choose({ theme: t.id })} className={`group relative size-6 rounded-full border border-border transition-transform hover:scale-110 disabled:cursor-wait disabled:opacity-50 ${on ? "ring-2 ring-accent-solid ring-offset-2 ring-offset-background" : ""}`} style={{ background: `linear-gradient(135deg, ${t.anchor} 50%, ${t.hero} 50%)` }}>
            <Tip text={t.label} end={i === THEMES.length - 1} />
          </button>
        );
      })}
    </div>
  );
}
