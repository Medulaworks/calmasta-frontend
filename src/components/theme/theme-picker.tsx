"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { MODES, type Mode, THEMES, setMode, setTheme, useThemeChoice } from "@/lib/theme";

const MODE_ICON = { light: Sun, dark: Moon, system: Monitor } as const;
export { MODE_ICON };

// "menu" is for inside the account menu; "page" is for the Settings page, where the same choices are radio buttons.
type Variant = "menu" | "page";
const role = (v: Variant) => (v === "menu" ? "menuitemradio" : "radio");
const optionRow = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface";

/** Light, dark, or follow the device. Separate from the colour theme: any theme works in any mode. */
export function ModeOptions({ variant = "menu" }: { variant?: Variant }) {
  const { mode } = useThemeChoice();
  return (
    <div role={variant === "menu" ? "group" : "radiogroup"} aria-label="Mode" className={variant === "menu" ? "px-1 pb-2 pt-1" : "space-y-1"}>
      {MODES.map((m) => {
        const Icon = MODE_ICON[m.id as Mode];
        return (
          <button key={m.id} type="button" role={role(variant)} aria-checked={mode === m.id} onClick={() => setMode(m.id)} className={optionRow}>
            <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted" />
            <span className="flex-1 font-medium">{m.label}</span>
            {m.id === "system" && <span className="text-xs text-muted">Match this device</span>}
            {mode === m.id && <Check aria-hidden className="h-4 w-4 shrink-0 text-accent" />}
          </button>
        );
      })}
    </div>
  );
}

/** The five colour themes. */
export function ThemeOptions({ variant = "menu" }: { variant?: Variant }) {
  const { theme } = useThemeChoice();
  return (
    <div role={variant === "menu" ? "group" : "radiogroup"} aria-label="Colour theme" className={variant === "menu" ? "px-1 pb-2 pt-1" : "space-y-1"}>
      {THEMES.map((t) => (
        <button key={t.id} type="button" role={role(variant)} aria-checked={theme === t.id} onClick={() => setTheme(t.id)} className={optionRow}>
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
    </div>
  );
}
