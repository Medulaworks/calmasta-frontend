"use client";
const seen = new Set<string>();
const queue: Array<Record<string, unknown>> = [];
let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, 20);
  fetch("/api/telemetry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch[0]), keepalive: true }).catch(() => {});
}
function enqueue(ev: Record<string, unknown>) {
  const key = JSON.stringify(ev);
  if (seen.has(key)) return;
  seen.add(key);
  if (seen.size > 100) seen.clear();
  queue.push(ev);
  if (queue.length > 20) queue.shift();
  if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 2000);
}
export function initTelemetry() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => enqueue({ type: "error", message: String(e.message).slice(0, 500) }));
  window.addEventListener("unhandledrejection", (e) => enqueue({ type: "error", message: String((e.reason as Error)?.message ?? e.reason).slice(0, 500) }));
}
export function trackApiInteraction(path: string, status: number) {
  enqueue({ type: "api_interaction", message: `${path}:${status}`.slice(0, 200) });
}
