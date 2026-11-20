import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { MeetingQuestions } from "./meeting-questions";
import type { QuestionsResult } from "../../lib/meeting-insights-client";

function render(result: QuestionsResult) {
  const html = renderToStaticMarkup(createElement(MeetingQuestions, { result, audioAvailable: true, onSeek: vi.fn() }));
  return html;
}

it("never shows the partial banner, even when coverage is partial_ai_extraction", () => {
  const html = render({ coverage: "partial_ai_extraction", questions: [{ text: "Q?", sources: [{ segmentId: "s", startMs: 0, endMs: 1000, speakerId: null }] }], rejectedQuestionCount: 1 });
  expect(html).toContain("Q?");
  expect(html).not.toContain("Partial output");
});

it("never shows the partial banner, even when rejected counts are present", () => {
  const html = render({ coverage: "ai_extraction_not_guaranteed_exhaustive", questions: [], rejectedAnswerCount: 2, failedExtractionRequestCount: 1 });
  expect(html).not.toContain("Partial output");
  expect(html).not.toContain("rejected");
});

it("does not show partial banner for exhaustive coverage with zero counts", () => {
  const html = render({ coverage: "ai_extraction_not_guaranteed_exhaustive", questions: [] });
  expect(html).not.toContain("Partial output");
});
