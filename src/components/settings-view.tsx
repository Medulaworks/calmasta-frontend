"use client";

import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { SecurityCard } from "@/components/security-card";
import { useProfile } from "@/components/shell/profile-context";
import { SoundSwitch } from "@/components/sound-switch";
import { Card, CardHeader } from "@/components/ui/card";
import { ConnectionsCard, DataPrivacyCard, DeleteAccountCard } from "@/components/settings-data";
import { ModeOptions, ThemeOptions } from "@/components/theme/theme-picker";

const PRIVACY = [
  "Recordings, transcripts and documents are private to you.",
  "Meeting assistants join as visible participants using the configured assistant name.",
  "You confirm you have the right to record every meeting. Nothing records automatically.",
  "Deleting a recording deletes its audio and transcript. Documents you made from it are kept.",
];

const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "sound", label: "Sound" },
  { id: "connections", label: "Connections" },
  { id: "security", label: "Sign-in and security" },
  { id: "privacy", label: "Data and privacy" },
  { id: "delete", label: "Delete account" },
] as const;

/** Which section is in view, so the list on the left can show where you are. */
function useActiveSection() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return [active, setActive] as const;
}

/**
 * Settings: a list of sections on the left (it follows you down the page) and the sections themselves on the right, each a card
 * with the same shape. Usage and your details are on your profile; this page is for how Jooba behaves.
 */
export function SettingsView() {
  const profile = useProfile();
  const [active, setActive] = useActiveSection();
  // Scrolls to a section and marks it, even the last ones that can never reach the top of a short page.
  function go(e: React.MouseEvent, id: string) {
    e.preventDefault();
    setActive(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }
  if (!profile) return <p className="text-sm text-muted">Sign in to see your settings.</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} onClick={(e) => go(e, s.id)} aria-current={active === s.id ? "true" : undefined} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${active === s.id ? "bg-accent-solid/10 font-medium text-foreground" : "text-muted hover:bg-surface hover:text-foreground"}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 space-y-5">
        <section id="appearance" className="scroll-mt-24">
          <Card>
            <CardHeader title="Appearance" />
            <div className="space-y-6 p-5">
              <div>
                <h3 className="text-sm font-medium">Mode</h3>
                <p className="mb-3 mt-1 text-sm text-muted">Light, dark, or follow your device.</p>
                <ModeOptions variant="page" />
              </div>
              <div>
                <h3 className="text-sm font-medium">Colour theme</h3>
                <p className="mb-3 mt-1 text-sm text-muted">Works in light and dark. Saved to your account across devices.</p>
                <ThemeOptions variant="page" />
              </div>
            </div>
          </Card>
        </section>

        <section id="sound" className="scroll-mt-24">
          <Card>
            <CardHeader title="Sound" />
            <div className="p-5"><SoundSwitch /></div>
          </Card>
        </section>

        <section id="connections" className="scroll-mt-24"><ConnectionsCard /></section>

        <section id="security" className="scroll-mt-24"><SecurityCard /></section>

        <section id="privacy" className="scroll-mt-24 space-y-5">
          <DataPrivacyCard />
          <Card>
            <CardHeader title="How Jooba handles recording" />
            <ul className="space-y-3 p-5 text-sm">
              {PRIVACY.map((line) => (
                <li key={line} className="flex gap-3">
                  <Shield aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section id="delete" className="scroll-mt-24"><DeleteAccountCard /></section>
      </div>
    </div>
  );
}
