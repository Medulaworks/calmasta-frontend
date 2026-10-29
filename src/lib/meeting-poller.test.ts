import { afterEach, expect, it, vi } from "vitest";
import { createMeetingPoller } from "./meeting-poller";

afterEach(() => vi.useRealTimers());
function setup(load = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)) {
  vi.useFakeTimers();
  const visibility = new EventTarget() as EventTarget & { hidden: boolean };
  visibility.hidden = false;
  const poller = createMeetingPoller(load, visibility);
  return { load, visibility, poller };
}
it("polls active meetings every 15 seconds and stops for terminal meetings", async () => {
  const { load, poller } = setup();
  await vi.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(14999);
  expect(load).toHaveBeenCalledTimes(1);
  load.mockResolvedValue(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(load).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60000);
  expect(load).toHaveBeenCalledTimes(2);
  poller.stop();
});
it("pauses in hidden tabs and resumes when visible", async () => {
  const { load, visibility, poller } = setup();
  await vi.advanceTimersByTimeAsync(0);
  visibility.hidden = true;
  visibility.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(60000);
  expect(load).toHaveBeenCalledTimes(1);
  visibility.hidden = false;
  visibility.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(15000);
  expect(load).toHaveBeenCalledTimes(2);
  poller.stop();
});
it("backs off failures up to two minutes and resets after success", async () => {
  const { load, poller } = setup(vi.fn<() => Promise<boolean>>().mockRejectedValue(new Error("offline")));
  await vi.advanceTimersByTimeAsync(0);
  for (const delay of [30000, 60000, 120000, 120000]) {
    const count = load.mock.calls.length;
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(load).toHaveBeenCalledTimes(count);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(count + 1);
  }
  load.mockResolvedValue(true);
  await vi.advanceTimersByTimeAsync(120000);
  const count = load.mock.calls.length;
  await vi.advanceTimersByTimeAsync(15000);
  expect(load).toHaveBeenCalledTimes(count + 1);
  poller.stop();
});
it("refreshes immediately without overlapping requests and cleans up on stop", async () => {
  let finish!: (active: boolean) => void;
  const load = vi.fn<() => Promise<boolean>>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(true);
  const { poller, visibility } = setup(load);
  poller.refresh();
  await vi.advanceTimersByTimeAsync(60000);
  expect(load).toHaveBeenCalledTimes(1);
  finish(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(2);
  poller.refresh();
  await vi.advanceTimersByTimeAsync(0);
  expect(load).toHaveBeenCalledTimes(3);
  poller.stop();
  visibility.dispatchEvent(new Event("visibilitychange"));
  poller.refresh();
  await vi.advanceTimersByTimeAsync(120000);
  expect(load).toHaveBeenCalledTimes(3);
});
