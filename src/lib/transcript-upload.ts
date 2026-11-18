import { api } from "./upload-client";

export const MAX_TRANSCRIPT_LENGTH = 100000;
export const MAX_TRANSCRIPT_FILE_BYTES = 1048576;
export type TranscriptLimits={maxTranscriptCharacters:number;maxTranscriptBytes:number};
export const DEFAULT_TRANSCRIPT_LIMITS:TranscriptLimits={maxTranscriptCharacters:MAX_TRANSCRIPT_LENGTH,maxTranscriptBytes:MAX_TRANSCRIPT_FILE_BYTES};
export function transcriptByteLabel(bytes:number){return bytes>=1048576?`${Number((bytes/1048576).toFixed(2))} MiB`:`${bytes.toLocaleString()} bytes`;}
export function validateTranscript(text: string,limits:TranscriptLimits=DEFAULT_TRANSCRIPT_LIMITS): void {
  if (!text.trim()) throw new Error("Add some transcript text first.");
  if (text.length > limits.maxTranscriptCharacters) throw new Error(`Use at most ${limits.maxTranscriptCharacters.toLocaleString()} characters of transcript text.`);
  if(new TextEncoder().encode(text).byteLength>limits.maxTranscriptBytes)throw new Error(`Use at most ${transcriptByteLabel(limits.maxTranscriptBytes)} of UTF-8 transcript text.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) || !text.isWellFormed()) throw new Error("Use plain text without binary or invalid characters.");
}
export async function readTranscriptFile(file: File,limits:TranscriptLimits=DEFAULT_TRANSCRIPT_LIMITS): Promise<string> {
  if (!/\.txt$/i.test(file.name)) throw new Error("Choose a UTF-8 .txt file.");
  if (file.size > limits.maxTranscriptBytes) throw new Error(`Choose a .txt file of at most ${transcriptByteLabel(limits.maxTranscriptBytes)}.`);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error("This file is not valid UTF-8 text. Save it as UTF-8 and try again."); }
  validateTranscript(text,limits);
  return text;
}

/** One private in-memory operation, retained across uncertain responses and double clicks. */
export function createTranscriptImport(input: { text: string; title?: string; consent: boolean },limits:TranscriptLimits=DEFAULT_TRANSCRIPT_LIMITS) {
  validateTranscript(input.text,limits);
  if (!input.consent) throw new Error("Confirm that you have the right to save and process this transcript.");
  const title = input.title?.trim();
  if (title && (title.length > 200 || /[\u0000-\u001f\u007f]/.test(title))) throw new Error("Use a title of up to 200 characters without control characters.");
  const body = JSON.stringify({ text: input.text, ...(title ? { title } : {}), consent: true });
  const key = crypto.randomUUID();
  let pending: Promise<string> | undefined, saved: string | undefined;
  return {
    save(): Promise<string> {
      if (saved) return Promise.resolve(saved);
      if (pending) return pending;
      pending = api<{ id: string; captureId: string; state: string; transcriptVersion: number }>("/api/captures/transcripts", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body,
      }).then(result => {
        if (typeof result.captureId !== "string" || !result.captureId || result.id !== result.captureId || result.state !== "completed" || result.transcriptVersion !== 1) throw new Error("The save could not be confirmed. Retry to check the same transcript safely.");
        saved = result.captureId;
        return saved;
      }).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
