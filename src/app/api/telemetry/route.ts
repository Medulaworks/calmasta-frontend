import { connection } from "next/server";
const ALLOWED = new Set(["error", "api_interaction"]);
export async function POST(request: Request) {
  await connection();
  if (process.env.TELEMETRY_ENABLED !== "true") return Response.json({ ok: false, reason: "telemetry_not_configured" }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  const ev = body as { type?: string; message?: string };
  if (!ev.type || !ALLOWED.has(ev.type)) return Response.json({ error: "invalid_request" }, { status: 400 });
  // Sanitize: drop raw transcripts, DOM text, URLs, cookies, bodies
  const sanitized = { type: ev.type, message: typeof ev.message === "string" ? ev.message.slice(0, 500) : undefined, at: new Date().toISOString() };
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return Response.json({ ok: false, reason: "collector_not_configured" }, { status: 503 });
  try {
    await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.OTEL_EXPORTER_OTLP_HEADERS ? { Authorization: process.env.OTEL_EXPORTER_OTLP_HEADERS } : {}) }, body: JSON.stringify(sanitized), signal: AbortSignal.timeout(3000) });
  } catch { /* quiet collector failure */ }
  return Response.json({ ok: true });
}
