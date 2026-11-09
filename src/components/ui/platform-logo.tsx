import { FileText, Mic, Video } from "lucide-react";
import Image from "next/image";

export type MeetingPlatform = "google_meet" | "microsoft_teams" | "zoom";

const ALIASES: Record<string, MeetingPlatform> = {
  google_meet: "google_meet", meet: "google_meet", googlemeet: "google_meet", "google meet": "google_meet",
  microsoft_teams: "microsoft_teams", teams: "microsoft_teams", msteams: "microsoft_teams", "microsoft teams": "microsoft_teams",
  zoom: "zoom",
};

/** "google_meet", "Teams" or a call link or title that names the app -> which platform it is, or null when we can't tell. */
export function platformKey(raw?: string | null, hint?: string | null): MeetingPlatform | null {
  const k = raw?.trim().toLowerCase();
  if (k && ALIASES[k]) return ALIASES[k];
  const h = `${hint ?? ""}`.toLowerCase();
  if (/meet\.google\.com|google meet/.test(h)) return "google_meet";
  if (/teams\.microsoft\.com|teams\.live\.com|microsoft teams/.test(h)) return "microsoft_teams";
  if (/zoom\.(us|com)|zoomgov|\bzoom\b/.test(h)) return "zoom";
  return null;
}

/**
 * The platform of a meeting capture. When the server doesn't say, the app treats it as Google Meet, the same assumption the
 * recording page and the Meet history already make, so every list agrees.
 */
export const meetingPlatform = (raw?: string | null, hint?: string | null): MeetingPlatform => platformKey(raw, hint) ?? "google_meet";

export const PLATFORM_NAME: Record<MeetingPlatform, string> = { google_meet: "Google Meet", microsoft_teams: "Microsoft Teams", zoom: "Zoom" };
const FILE: Record<MeetingPlatform, string> = { google_meet: "/icons/icons8-google-meet-96.png", microsoft_teams: "/icons/icons8-teams-96.png", zoom: "/icons/icons8-zoom-96.png" };

/**
 * A meeting app's logo on a soft rounded tile: the leading mark of a meeting row. The name is read aloud; with no platform
 * it shows a neutral video icon rather than guessing.
 */
export function PlatformLogo({ platform, size = 40, className = "" }: { platform: MeetingPlatform | null; size?: number; className?: string }) {
  const inner = Math.round(size * 0.6);
  return (
    <span
      role={platform ? "img" : undefined}
      aria-label={platform ? PLATFORM_NAME[platform] : undefined}
      aria-hidden={platform ? undefined : true}
      className={`inline-grid shrink-0 place-items-center rounded-xl border border-border bg-background shadow-sm ${className}`}
      style={{ width: size, height: size }}>
      {platform ? <Image src={FILE[platform]} alt="" width={inner} height={inner} className="shrink-0" style={{ width: inner, height: inner }} /> : <Video className="size-5 text-muted" />}
    </span>
  );
}

type TileKind = "meeting" | "recording" | "document";

/**
 * The leading tile of any capture row, so every list looks the same: a meeting shows its platform's logo, a recording a
 * microphone, a document a page.
 */
export function CaptureTile({ kind, platform, hint, size = 40 }: { kind: TileKind; platform?: string | null; hint?: string | null; size?: number }) {
  if (kind === "meeting") return <PlatformLogo platform={meetingPlatform(platform, hint)} size={size} />;
  const Icon = kind === "document" ? FileText : Mic;
  return (
    <span aria-hidden className="inline-grid shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted" style={{ width: size, height: size }}>
      <Icon className="size-5" />
    </span>
  );
}
