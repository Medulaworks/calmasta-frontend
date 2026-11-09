// Soft interface sounds, made in the browser with the Web Audio API, so there are no files to load and nothing to license.
// Each sound is a few quiet, rounded notes (sine and triangle waves through a gentle low-pass filter and a short echo).
// They play only after the person has interacted with the page, only while the tab is visible, and never when switched off.
// The switch is stored on this device (localStorage), and sounds are ON by default.

export type SoundName = "recordStart" | "recordStop" | "pause" | "resume" | "success" | "done" | "sent" | "error" | "notify";

interface Note {
  /** Frequency in hertz. */
  f: number;
  /** Seconds after the sound starts. */
  at: number;
  /** How long the note rings, in seconds. */
  len: number;
  /** 0 to 1, relative loudness. */
  gain?: number;
  wave?: OscillatorType;
}

// Notes come from a calm major pentatonic scale (C5 = 523 Hz) so any order sounds pleasant. Rising means "go", falling means "stop".
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, A4 = 440, E4 = 329.63;

export const SOUNDS: Record<SoundName, Note[]> = {
  recordStart: [{ f: G5, at: 0, len: 0.22 }, { f: C6, at: 0.1, len: 0.34, gain: 1 }],
  recordStop: [{ f: C6, at: 0, len: 0.2 }, { f: G5, at: 0.1, len: 0.34 }],
  pause: [{ f: E5, at: 0, len: 0.2, gain: 0.8 }],
  resume: [{ f: E5, at: 0, len: 0.16, gain: 0.8 }, { f: A5, at: 0.09, len: 0.24, gain: 0.9 }],
  success: [{ f: C5, at: 0, len: 0.3 }, { f: E5, at: 0.11, len: 0.3 }, { f: G5, at: 0.22, len: 0.3 }, { f: C6, at: 0.33, len: 0.6, gain: 1 }],
  done: [{ f: A5, at: 0, len: 0.12, gain: 0.8, wave: "triangle" }, { f: E6, at: 0.07, len: 0.3, gain: 0.7 }],
  sent: [{ f: D5, at: 0, len: 0.16 }, { f: A5, at: 0.09, len: 0.4, gain: 0.9 }],
  error: [{ f: A4, at: 0, len: 0.22, gain: 0.8, wave: "triangle" }, { f: E4, at: 0.14, len: 0.4, gain: 0.8, wave: "triangle" }],
  notify: [{ f: E6, at: 0, len: 0.18, gain: 0.6 }, { f: C6, at: 0.12, len: 0.34, gain: 0.55 }],
};

const KEY = "jooba:sounds";
const MASTER = 0.16;

let enabled: boolean | null = null;
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;
let touched = false;

export function soundsEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = localStorage.getItem(KEY) !== "off";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function setSoundsEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private window: the choice just lasts until the page closes */
  }
  listeners.forEach((l) => l());
  if (on) playSound("notify");
}

/** For useSyncExternalStore: re-render when the switch changes. */
export function onSoundsChange(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// Browsers only allow audio after the person has clicked, tapped or pressed a key. Wait for that, never try before.
if (typeof window !== "undefined") {
  const mark = () => { touched = true; };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, mark, { once: true, passive: true });
}

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Plays a sound if sounds are on, the person has used the page, and the tab is in front. Never throws. */
export function playSound(name: SoundName) {
  try {
    if (!soundsEnabled() || !touched || typeof document === "undefined" || document.visibilityState === "hidden") return;
    const ac = context();
    if (!ac) return;
    const t0 = ac.currentTime + 0.02;
    const out = ac.createGain();
    out.gain.value = MASTER;
    const tone = ac.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3400;
    // A short, soft echo gives the notes a little room without sounding like an effect.
    const echo = ac.createDelay(0.4);
    echo.delayTime.value = 0.13;
    const echoGain = ac.createGain();
    echoGain.gain.value = 0.22;
    out.connect(tone);
    tone.connect(ac.destination);
    tone.connect(echo);
    echo.connect(echoGain);
    echoGain.connect(ac.destination);

    for (const n of SOUNDS[name]) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = n.wave ?? "sine";
      osc.frequency.value = n.f;
      const peak = n.gain ?? 0.9;
      const start = t0 + n.at;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(peak, start + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0001, start + n.len);
      osc.connect(env);
      env.connect(out);
      osc.start(start);
      osc.stop(start + n.len + 0.05);
    }
  } catch {
    /* a sound is a nicety: never let it break the page */
  }
}
