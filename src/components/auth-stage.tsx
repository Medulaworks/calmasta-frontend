"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * Scales a fixed-size illustration (`width` x `height`) to fit whatever space its container has, so the sign-in
 * showcase always fits the window instead of scrolling. It never scales above `max`.
 */
export function FitStage({ width, height, max = 1.3, className = "flex-1", children }: { width: number; height: number; max?: number; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.max(0.4, Math.min(el.clientWidth / width, el.clientHeight / height, max)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, max]);

  return (
    <div ref={box} className={`relative min-h-0 w-full ${className}`}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
