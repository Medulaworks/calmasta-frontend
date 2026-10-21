"use client";

import { useRef } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** A small count shown beside the label, e.g. how many documents. */
  count?: number;
}

/**
 * An accessible tab bar: arrow keys move between tabs, Home/End jump to the ends.
 * The panel it controls gets `id={tabPanelId(id)}` and `aria-labelledby={tabId(id)}`.
 */
export const tabId = (id: string) => `tab-${id}`;
export const tabPanelId = (id: string) => `tabpanel-${id}`;

export function Tabs<T extends string>({ label, items, active, onChange }: { label: string; items: readonly TabItem<T>[]; active: T; onChange: (id: T) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const last = items.length - 1;
    const next = e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    const id = items[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex gap-5 border-b border-border sm:gap-6">
      {items.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={tabId(t.id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={tabPanelId(t.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 text-sm transition-colors ${
              selected ? "border-accent-solid font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="text-xs text-muted">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
