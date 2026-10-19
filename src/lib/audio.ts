// Audio input rules shared by the browser (fast feedback) and, later, the API
// (authoritative). The server must still validate real content, size and
// duration — a client-side check is only a convenience (blueprint §8).

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 2 * 60 * 60;

const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
]);

const ALLOWED_EXTENSIONS = new Set(["mp3", "m4a", "mp4", "aac", "wav", "webm", "ogg", "flac"]);

export type AudioCheck = { ok: true } | { ok: false; reason: string };

export function checkAudioFile(file: { name: string; type: string; size: number }): AudioCheck {
  if (file.size === 0) return { ok: false, reason: "This file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: `This file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    };
  }
  const baseType = file.type.split(";")[0].trim().toLowerCase();
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  // Some browsers report an empty type for m4a/flac; accept a known extension then.
  const typeOk = ALLOWED_TYPES.has(baseType) || (baseType === "" && ALLOWED_EXTENSIONS.has(ext));
  if (!typeOk) {
    return { ok: false, reason: "Unsupported file type. Use MP3, M4A, WAV, WebM, OGG, AAC or FLAC." };
  }
  return { ok: true };
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
