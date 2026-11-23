import { notFound } from "next/navigation";
import { NotesRenderer } from "@/components/sharing/shared-notes-view";
import type { PublicNotes } from "@/lib/sharing-types";

export const metadata = { title: "Shared notes preview", robots: { index: false, follow: false } };

// Dummy notes so the shared page can be looked at without a real share link. Only exists while developing.
const SAMPLE = {
  publicationVersion: 1,
  title: "Sample notes (dummy data)",
  publishedAt: "2026-11-20T14:59:00Z",
  notes: [
    {
      kind: "enhanced",
      templateLabel: "Enhanced",
      content: {
        topics: [
          { title: "Backend status and sign-in migration", items: [
            { text: "The sign-in service migration is complete.", details: ["No downtime during the move.", "Token checks are about 30% faster."] },
            { text: "The billing retry queue is still pending.", details: ["Waiting on a memory increase for the staging worker.", "Load tests can start once that is done."] },
          ] },
          { title: "Frontend and onboarding", items: [
            { text: "Frontend work is mostly unblocked.", details: ["New dashboard hooks are finished.", "End-to-end tests can begin after the API switch."] },
          ] },
        ],
      },
    },
  ],
  transcript: { text: "Speaker 1: Thanks everyone for joining.\nSpeaker 2: Happy to share the update." },
  media: null,
} as unknown as PublicNotes;

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <NotesRenderer data={SAMPLE} />;
}
