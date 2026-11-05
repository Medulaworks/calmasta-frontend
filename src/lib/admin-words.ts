// What the staff area calls the work Jooba does in the background. The server says "video_ingest"; a person reads
// "Importing a video". One list, so every screen uses the same plain words.

const NAMES: Record<string, string> = {
  video_ingest: "Importing a video",
  transcription: "Making a transcript",
  meeting_capture: "Recording a meeting",
  document: "Writing a document",
  document_generation: "Writing a document",
  action_items: "Finding action items",
};

/** "video_ingest" or "Video ingest" -> "Importing a video". Anything unknown reads as a sentence, never as a code. */
export function taskName(kind: string): string {
  const key = kind.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (NAMES[key]) return NAMES[key];
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
