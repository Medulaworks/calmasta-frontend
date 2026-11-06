import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { MeetingQuestions } from "./meeting-questions";
import type { QuestionsResult } from "../../lib/meeting-insights-client";

function render(result: QuestionsResult) {
  const html = renderToStaticMarkup(createElement(MeetingQuestions, { result, audioAvailable: true, onSeek: vi.fn() }));
  return html;
}

it("shows partial banner when coverage is partial_ai_extraction", () => {
  const html = render({ coverage: "partial_ai_extraction", questions: [{ text: "Q?", sources: [{ segmentId: "s", startMs: 0, endMs: 1000, speakerId: null }] }], rejectedQuestionCount: 1 });
  expect(html).toContain("Partial output");
  expect(html).toContain("1 question(s) rejected");
});

it("shows partial banner when rejected counts present even with exhaustive coverage", () => {
  const html = render({ coverage: "ai_extraction_not_guaranteed_exhaustive", questions: [], rejectedAnswerCount: 2, failedExtractionRequestCount: 1 });
  expect(html).toContain("Partial output");
  expect(html).toContain("2 answer(s) rejected");
  expect(html).toContain("Some extraction requests failed");
});

it("does not show partial banner for exhaustive coverage with zero counts", () => {
  const html = render({ coverage: "ai_extraction_not_guaranteed_exhaustive", questions: [] });
  expect(html).not.toContain("Partial output");
});
