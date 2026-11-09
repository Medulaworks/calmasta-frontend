"use client";

import { useEffect, useRef } from "react";

const BARS = 28;

/**
 * A live waveform for a microphone stream: the bars rise and fall with the voice, so the person can see they are being
 * heard. It reads the level straight from the browser's audio analyser and moves the bars directly (no re-rendering), and it
 * quietly shows flat bars if audio analysis isn't available.
 */
export function LiveWaveform({ stream }: { stream: MediaStream | null }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!stream) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try {
      ctx = new AC();
    } catch {
      return;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      // The lower half of the spectrum is where speech lives; spread it across the bars, mirrored from the middle.
      for (let i = 0; i < BARS; i++) {
        const mid = Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const idx = Math.min(data.length - 1, Math.floor((1 - mid) * (data.length * 0.5)));
        const level = data[idx] / 255;
        const el = bars.current[i];
        if (el) el.style.transform = `scaleY(${Math.max(0.12, Math.min(1, level * 1.25))})`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void ctx.close().catch(() => undefined);
    };
  }, [stream]);

  return (
    <div aria-hidden className="flex h-12 items-center justify-center gap-1 rounded-2xl bg-surface px-4">
      {Array.from({ length: BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className="h-full w-1 origin-center rounded-full bg-accent-solid transition-transform duration-75"
          style={{ transform: "scaleY(0.12)" }}
        />
      ))}
    </div>
  );
}
