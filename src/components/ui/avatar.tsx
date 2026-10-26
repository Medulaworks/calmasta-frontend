"use client";

import { useState } from "react";

/** A person's picture, or their initial if they haven't set one (or it can't load). */
export function Avatar({ name, src, size = 40, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (src && failed !== src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" aria-hidden width={size} height={size} onError={() => setFailed(src)} style={style} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span aria-hidden style={style} className={`grid shrink-0 place-items-center rounded-full bg-accent-solid font-semibold text-on-accent ${className}`}>
      {initial}
    </span>
  );
}
