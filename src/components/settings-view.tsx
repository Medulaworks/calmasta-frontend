"use client";

import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/shell/profile-context";
import { Card, CardHeader } from "@/components/ui/card";
import { ConnectionsCard, DataPrivacyCard, DeleteAccountCard } from "@/components/settings-data";
import { ModeOptions, ThemeOptions } from "@/components/theme/theme-picker";
import { type Dashboard, fetchDashboard } from "@/lib/dashboard-client";
import { formatMinutes } from "@/lib/status";

const PRIVACY = [
  "Recordings, transcripts and documents are private to you.",
  "Meeting assistants are always visible and join as “Mojooba Assistant”.",
  "You confirm you have the right to record every meeting. Nothing records automatically.",
  "Deleting a recording deletes its audio and transcript. Documents you made from it are kept.",
];

export function SettingsView() {
  const profile = useProfile();
  const [usage, setUsage] = useState<Dashboard["stats"] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then(
      (d) => !cancelled && setUsage(d.stats),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) return <p className="text-sm text-muted">Sign in to see your settings.</p>;
  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader title="Appearance" />
        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium">Mode</h3>
            <p className="mb-2 text-xs text-muted">Light, dark, or follow your device.</p>
            <ModeOptions variant="page" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Colour theme</h3>
            <p className="mb-2 text-xs text-muted">Works in light and dark. Remembered in this browser.</p>
            <ThemeOptions variant="page" />
          </div>
        </div>
      </Card>

      <ConnectionsCard />

      <DataPrivacyCard />

      <Card>
        <CardHeader title="This month" />
        <dl className="grid grid-cols-3 divide-x divide-border text-sm">
          {[
            ["Recordings", usage ? String(usage.recordingsThisMonth) : "–"],
            ["Transcribed", usage ? formatMinutes(usage.minutesTranscribedThisMonth) : "–"],
            ["Documents", usage ? String(usage.documents) : "–"],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-4">
              <dt className="text-muted">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title="Privacy and recording" />
        <ul className="space-y-3 p-5 text-sm">
          {PRIVACY.map((line) => (
            <li key={line} className="flex gap-3">
              <Shield aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {line}
            </li>
          ))}
        </ul>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}
