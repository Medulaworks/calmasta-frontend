/** Backend OTEL is available separately. Frontend SDK/exporter setup is pending. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.TELEMETRY_ENABLED === "true") {
    console.warn(JSON.stringify({ event: "frontend_telemetry_unavailable", reason: "frontend_exporter_not_configured" }));
  }
}
