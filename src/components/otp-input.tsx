"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A one-time-code field drawn as separate boxes. Typing moves forward, Backspace and the arrow keys move back and
 * forth, and pasting (or a phone's "from messages" suggestion) fills every box. `onComplete` fires once all boxes are
 * filled. To clear the boxes, give the component a new `key`; it focuses the first box when it appears.
 */
export function OtpInput({
  length = 6,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  label = "Verification code",
}: {
  length?: number;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [cells, setCells] = useState<string[]>(() => Array(length).fill(""));

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  useEffect(() => {
    focus(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(next: string[]) {
    setCells(next);
    const code = next.join("");
    onChange?.(code);
    if (next.every(Boolean)) onComplete?.(code);
  }

  /** Writes `digits` into the boxes from `start`, and returns the box to focus next. */
  function fill(start: number, digits: string) {
    const next = cells.slice();
    let i = start;
    for (const d of digits.slice(0, length - start)) next[i++] = d;
    commit(next);
    focus(Math.min(i, length - 1));
  }

  return (
    <div role="group" aria-label={label} className={`grid grid-cols-6 gap-2 sm:gap-3 ${invalid ? "jb-shake" : ""}`}>
      {cells.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={length}
          disabled={disabled}
          value={digit}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            if (!digits) {
              const next = cells.slice();
              next[i] = "";
              commit(next);
            } else if (digits.length > 1) {
              fill(digits.length >= length ? 0 : i, digits);
            } else {
              fill(i, digits);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !cells[i] && i > 0) {
              e.preventDefault();
              const next = cells.slice();
              next[i - 1] = "";
              commit(next);
              focus(i - 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              focus(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              focus(i + 1);
            }
          }}
          onPaste={(e) => {
            const digits = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!digits) return;
            e.preventDefault();
            fill(digits.length >= length ? 0 : i, digits);
          }}
          className={`h-[clamp(3rem,7.4vh,3.75rem)] w-full min-w-0 rounded-xl border bg-background text-center text-2xl font-semibold tabular-nums shadow-sm transition focus:outline-none focus:ring-4 disabled:opacity-60 ${
            invalid
              ? "border-danger focus:border-danger focus:ring-danger/20"
              : digit
                ? "border-accent/60 focus:border-accent focus:ring-accent-solid/20"
                : "border-border focus:border-accent focus:ring-accent-solid/20"
          }`}
        />
      ))}
    </div>
  );
}
