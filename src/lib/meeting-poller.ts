type Visibility = Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;

/** Completion-based polling: never overlap requests or poll a hidden tab. */
export function createMeetingPoller(load: () => Promise<boolean>, visibility: Visibility) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let running = false;
  let pending = false;
  let active = true;
  let failures = 0;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const delay = () => Math.min(15000 * 2 ** Math.min(failures, 3), 120000);
  const schedule = () => {
    clear();
    if (!stopped && !visibility.hidden && !running && (active || pending)) {
      timer = setTimeout(() => void run(), pending ? 0 : delay());
    }
  };
  async function run() {
    if (stopped || running || visibility.hidden) return;
    clear();
    running = true;
    pending = false;
    try {
      active = await load();
      failures = 0;
    } catch {
      failures = Math.min(failures + 1, 3);
    } finally {
      running = false;
      schedule();
    }
  }
  const onVisibility = () => {
    if (visibility.hidden) clear();
    else schedule();
  };
  visibility.addEventListener("visibilitychange", onVisibility);
  void run();
  return {
    refresh() {
      if (stopped) return;
      pending = true;
      if (!running) void run();
    },
    stop() {
      stopped = true;
      clear();
      visibility.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
