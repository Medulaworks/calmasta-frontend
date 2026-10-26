"use client";

import { useEffect } from "react";
import { applyTheme, useThemeChoice } from "@/lib/theme";

/** Keeps "System" honest: when the device switches between light and dark, so does the app. Renders nothing. */
export function ThemeSync() {
  const { theme, mode } = useThemeChoice();
  useEffect(() => {
    applyTheme(theme, mode);
    if (mode !== "system") return;
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme(theme, "system");
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [theme, mode]);
  return null;
}
