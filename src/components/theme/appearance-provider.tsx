"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { type ProfileView, saveProfile } from "@/lib/profile-client";
import { type Mode, type ThemeId, setAppearance } from "@/lib/theme";
import { DEFAULT_MODE, DEFAULT_THEME } from "@/lib/theme-boot";

type AppearancePatch = { theme?: ThemeId; mode?: Mode };
const AppearanceContext = createContext({
  saving: false,
  ready: false,
  error: null as string | null,
  failedField: null as "theme" | "mode" | null,
  choose: async (_patch: AppearancePatch): Promise<void> => { void _patch; },
});

export const useAppearancePreferences = () => useContext(AppearanceContext);

export function AppearanceProvider({ profile, onSaved, children }: {
  profile: ProfileView | null;
  onSaved: (profile: ProfileView) => void;
  children: React.ReactNode;
}) {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedField, setFailedField] = useState<"theme" | "mode" | null>(null);

  useEffect(() => {
    if (profile) setAppearance(profile.theme ?? DEFAULT_THEME, profile.mode ?? DEFAULT_MODE);
  }, [profile]);

  async function choose(patch: AppearancePatch) {
    if (!profile || busy.current) return;
    const previous = { theme: profile.theme ?? DEFAULT_THEME, mode: profile.mode ?? DEFAULT_MODE };
    busy.current = true;
    setSaving(true);
    setError(null);
    setFailedField(patch.theme ? "theme" : "mode");
    setAppearance(patch.theme ?? previous.theme, patch.mode ?? previous.mode);
    try {
      const saved = await saveProfile(patch);
      onSaved(saved);
      setAppearance(saved.theme ?? DEFAULT_THEME, saved.mode ?? DEFAULT_MODE);
    } catch {
      setAppearance(previous.theme, previous.mode);
      setError("Couldn't save your appearance preference. Please try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <AppearanceContext.Provider value={{ ready: Boolean(profile), saving, error, failedField, choose }}>{children}</AppearanceContext.Provider>;
}
