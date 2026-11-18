import { useSyncExternalStore } from "react";

// Mode = light, dark, or follow the device: a personal choice kept in the account backend, with a browser cache applied
// before first paint (see app/layout.tsx).

// There is one colour palette (maroon and orange). Mode is the only appearance choice: light, dark, or follow the device.
// The theme id stays "a" so older saved values and the account backend keep working; anything else is ignored.

/** The one palette. Kept as a type so saved profiles that still carry a theme id keep working. */
export type ThemeId = "a";
export type Mode = "light" | "dark" | "system";

export const MODES: readonly { id: Mode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

import { DEFAULT_MODE, DEFAULT_THEME, MODE_KEY, THEME_KEY } from "./theme-boot";

const EVENT = "MyJooba:theme-changed";

const isTheme = (v: unknown): v is ThemeId => v === "a";
const isMode = (v: unknown): v is Mode =>
  v === "light" || v === "dark" || v === "system";

function read(): { theme: ThemeId; mode: Mode } {
  try {
    const t = localStorage.getItem(THEME_KEY);
    const m = localStorage.getItem(MODE_KEY);
    return {
      theme: isTheme(t) ? t : DEFAULT_THEME,
      mode: isMode(m) ? m : DEFAULT_MODE,
    };
  } catch {
    return { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
  }
}

export const resolveMode = (mode: Mode): "light" | "dark" =>
  mode === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : mode;

/** Puts the current choice on <html>. Safe to call any time. */
export function applyTheme(
  theme: ThemeId = read().theme,
  mode: Mode = read().mode,
) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = resolveMode(mode);
}

export function setTheme(theme: ThemeId) {
  setAppearance(theme, read().mode);
}

export function setAppearance(theme: ThemeId, mode: Mode) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private window: the choice lasts until the page is closed */
  }
  applyTheme(theme, mode);
  window.dispatchEvent(new Event(EVENT));
}

export function setMode(mode: Mode) {
  setAppearance(read().theme, mode);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // another tab changed it
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
const snapshot = () => {
  const { theme, mode } = read();
  return `${theme}|${mode}`;
};

/** The current choice, kept in step across tabs. On the server (and the first paint) it reports the defaults. */
export function useThemeChoice(): { theme: ThemeId; mode: Mode } {
  const s = useSyncExternalStore(
    subscribe,
    snapshot,
    () => `${DEFAULT_THEME}|${DEFAULT_MODE}`,
  );
  const [theme, mode] = s.split("|") as [ThemeId, Mode];
  return { theme, mode };
}
