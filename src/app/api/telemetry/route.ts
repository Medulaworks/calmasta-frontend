import { connection } from "next/server";

// Bounded, same-origin browser telemetry ingress: rate-limited, scrubbed, never blocks UI
const seen = new Map<string, number>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const last = seen.get(key) ?? 0;
  if (now - last < 1000) return true;
  seen.set(key, now);
  // prune
  if (seen.size > 1000) for (const [k, v] of seen) if (now - v > 60000) seen.delete(k);
  return false;
}
function scrub(s: string): string {
  return s.slice(0, 400).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]").replace(/token=[^&\s]+/gi, "token=[redacted]");
}
export async function POST(req: Request) {
  await connection();
  // same-origin only
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && !origin.endsWith(`://${host}`) && origin !== `https://${host}` && origin !== `http://${host}`) {
    return Response.json({ ok: false, reason: "cross_origin_rejected" }, { status: 403 });
  }
  const body = await req.text();
  if (body.length > 4096) return Response.json({ ok: false, reason: "payload_too_large" }, { status: 413 });
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  const kind = typeof data.kind === "string" ? data.kind : "";
  if (!["error", "unhandledrejection", "fetch_error", "fetch_exception"].includes(kind)) {
    return Response.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
  }
  const key = `${kind}:${scrub(String(data.message ?? data.url ?? ""))}`.slice(0, 200);
  if (rateLimited(key)) return Response.json({ ok: true, rate_limited: true });
  // Forward to collector if configured, otherwise just log sensibly (never exposes raw meeting data)
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (endpoint) {
    // Fire-and-forget, bounded timeout, no credentials exposed to browser
    void fetch(`${endpoint.replace(/\/$/, "")}/v1/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceLogs: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: "calmasta-browser" } }] }, scopeLogs: [{ scope: { name: "browser" }, logRecords: [{ timeUnixNano: String(Date.now() * 1e6), body: { stringValue: scrub(JSON.stringify(data)) }, attributes: [{ key: "kind", value: { stringValue: kind } }] }] }] }] }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  } else {
    console.warn(JSON.stringify({ event: "browser_telemetry", kind, message: scrub(String(data.message ?? "")) }));
  }
  return Response.json({ ok: true });
}
