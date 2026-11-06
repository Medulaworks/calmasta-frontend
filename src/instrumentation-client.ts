"use client";
// Lightweight browser error/fetch telemetry: sampled, scrubbed, same-origin only
let installed = false;
function scrub(msg: string): string {
  return msg.slice(0, 400).replace(/[0-9a-f]{8,}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]").replace(/token=[^&\s]+/gi, "token=[redacted]");
}
function send(event: Record<string, unknown>) {
  if (Math.random() > 0.1) return; // 10% sample
  const body = JSON.stringify({ ...event, ts: Date.now() });
  if (body.length > 4096) return;
  navigator.sendBeacon?.("/api/telemetry", body) ?? fetch("/api/telemetry", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true } as RequestInit).catch(() => {});
}
export function registerBrowserTelemetry() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => send({ kind: "error", message: scrub(e.message || "error"), file: scrub(e.filename || "") }));
  window.addEventListener("unhandledrejection", (e) => send({ kind: "unhandledrejection", message: scrub(String((e as PromiseRejectionEvent).reason || "")) }));
  const origFetch = window.fetch;
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
    if (!sameOrigin || !url.startsWith("/api/")) return origFetch(input as RequestInfo, init);
    const start = performance.now();
    try {
      const res = await origFetch(input as RequestInfo, init);
      if (!res.ok) send({ kind: "fetch_error", url: scrub(url), status: res.status, duration: Math.round(performance.now() - start) });
      return res;
    } catch (err) {
      send({ kind: "fetch_exception", url: scrub(url), message: scrub(String(err)) });
      throw err;
    }
  }) as typeof window.fetch;
}
if (typeof window !== "undefined") registerBrowserTelemetry();
