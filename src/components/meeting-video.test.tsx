import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MeetingVideo } from "./meeting-video";

it("storage outages are not described as a privacy deletion", () => {
  const html = renderToStaticMarkup(createElement(MeetingVideo, {
    cap: { recordVideo: true, video: null, videoStatus: "unavailable", videoFailure: null, status: "completed", videoPlaybackFailure: "storage_unavailable" },
  }));
  expect(html).toContain("temporarily unavailable");
  expect(html).not.toContain("It was removed");
});
