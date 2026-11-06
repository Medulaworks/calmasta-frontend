import { connection } from "next/server";

/** Keep browser ingestion unavailable until bounded, sanitized OTLP ingestion exists. */
export async function POST() {
  await connection();
  return Response.json(
    { ok: false, reason: "frontend_telemetry_not_configured" },
    { status: 503 },
  );
}
