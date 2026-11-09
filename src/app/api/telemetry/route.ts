import { connection } from "next/server";

// Browser error text, URLs and arbitrary attributes may contain meeting data or
// credentials. Until a reviewed browser schema and collection path exist, do not
// forward or log caller-controlled payloads or claim successful collection.
export async function POST(req: Request) {
  void req;
  await connection();
  return Response.json({ ok: false, reason: "browser_telemetry_unavailable" }, { status: 503 });
}
