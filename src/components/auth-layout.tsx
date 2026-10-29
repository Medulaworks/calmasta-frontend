import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";

/** Shared presentation for the sign-in and email verification screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 text-xl"><Brand size={36} /></div>
          {children}
        </div>
      </main>
      <aside
        aria-hidden
        className="hidden items-center justify-center bg-surface p-12 md:flex">
        <ul className="max-w-sm space-y-4 text-sm">
          {[
            [
              "Capture",
              "Meetings and voice notes, with a visible assistant and your consent.",
            ],
            ["Transcribe", "A transcript you can read, search and correct."],
            ["Write", "Briefs, minutes and follow-ups you can edit freely."],
          ].map(([t, b]) => (
            <li
              key={t}
              className="rounded-xl border border-border bg-background p-5">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
