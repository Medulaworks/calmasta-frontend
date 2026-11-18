"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCapturePreferences, patchCapturePreferences, type CapturePreferences } from "@/lib/capture-preferences-client";
import { ApiError } from "@/lib/upload-client";

export function BotNamePreferenceDialog({ onReady }: { onReady?: (prefs: CapturePreferences) => void }) {
  const [prefs, setPrefs] = useState<CapturePreferences | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCapturePreferences()
      .then((p) => {
        if (cancelled) return;
        setPrefs(p);
        onReady?.(p);
        if (p.promptState === "unset") {
          setName(p.effectiveBotName ?? p.adminDefaultBotName ?? "");
          setOpen(true);
        }
      })
      .catch(() => {
        // Truthful unavailable: keep form usable with server default, don't block.
      });
    return () => { cancelled = true; };
  }, [onReady]);

  async function save(promptState: "saved" | "skipped") {
    if (!prefs) return;
    const botName = promptState === "saved" ? (name.trim() || null) : null;
    if (promptState === "saved" && botName && (botName.length > 100 || /[\u0000-\u001f\u007f]/.test(botName))) {
      setError("Choose a name of up to 100 characters without control characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await patchCapturePreferences({ expectedVersion: prefs.version, botName: promptState === "skipped" ? null : botName, promptState });
      setPrefs(next);
      onReady?.(next);
      setOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "version_conflict") {
        setError("Someone else updated preferences. Please try again.");
        try { const p = await getCapturePreferences(); setPrefs(p); } catch {}
      } else setError(e instanceof Error ? e.message : "We couldn’t save. Please try again.");
    } finally { setSaving(false); }
  }

  if (!open || !prefs) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bot-pref-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg">
        <h2 id="bot-pref-title" className="text-lg font-semibold">What should your meeting assistant be called?</h2>
        <p className="mt-2 text-sm text-muted">This name is shown when it joins. You can change it any time.</p>
        <label htmlFor="bot-pref-name" className="mt-4 block text-sm font-medium">Assistant name</label>
        <input id="bot-pref-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={prefs.adminDefaultBotName} className="mt-2 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" disabled={saving} onClick={() => void save("skipped")}>Skip</Button>
          <Button variant="primary" disabled={saving} onClick={() => void save("saved")}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}
