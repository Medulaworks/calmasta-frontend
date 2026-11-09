"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { onSoundsChange, playSound, setSoundsEnabled, soundsEnabled } from "@/lib/sounds";

/** Turns the soft interface sounds on or off. The choice is kept on this device. */
export function SoundSwitch() {
  const on = useSyncExternalStore(onSoundsChange, soundsEnabled, () => true);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-accent-solid/15 text-accent">
          {on ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </span>
        <div>
          <p id="sound-label" className="text-sm font-medium">Interface sounds</p>
          <p className="text-sm text-muted">Soft sounds when recording starts, a meeting is sent, and your work is ready.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {on && <button type="button" onClick={() => playSound("success")} className="text-sm text-muted underline underline-offset-4 hover:text-foreground">Preview</button>}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="sound-label"
          onClick={() => setSoundsEnabled(!on)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-accent-solid" : "bg-border"}`}>
          <span className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? "translate-x-6" : ""}`} />
        </button>
      </div>
    </div>
  );
}
