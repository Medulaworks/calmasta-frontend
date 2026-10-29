import { useSyncExternalStore } from "react";

// Theme = which colours (five palettes). Mode = light, dark, or follow the device. Both are a personal choice kept in
// the account backend, with a browser cache applied before first paint (see app/layout.tsx).

export type ThemeId = "a" | "b" | "d" | "e" | "f";
export type Mode = "light" | "dark" | "system";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  note: string;
  /** The two colours shown on its swatch. */
  hero: string;
  anchor: string;
}

export const THEMES: readonly ThemeInfo[] = [
  {
    id: "a",
    label: "Orange + Plum",
    note: "Warm and professional",
    hero: "#FFAC34",
    anchor: "#3E2833",
  },
  {
    id: "b",
    label: "Orange + Slate",
    note: "Calm and technical",
    hero: "#FFAC34",
    anchor: "#283642",
  },
  {
    id: "d",
    label: "Maroon + Silver",
    note: "Premium and editorial",
    hero: "#B9BDC4",
    anchor: "#5B0D35",
  },
  {
    id: "e",
    label: "Orange + Forest",
    note: "Fresh and bold",
    hero: "#FFAC34",
    anchor: "#1E5B40",
  },
  {
    id: "f",
    label: "Gold + Pine",
    note: "Heritage and trusted",
    hero: "#C9A227",
    anchor: "#143C26",
  },
];

export const MODES: readonly { id: Mode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

import { DEFAULT_MODE, DEFAULT_THEME, MODE_KEY, THEME_KEY } from "./theme-boot";

const EVENT = "MyJooba:theme-changed";

const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);
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
