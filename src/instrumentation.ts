// @ts-nocheck
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OTEL_SDK_DISABLED === "true" || process.env.TELEMETRY_ENABLED !== "true") return;
  try {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!endpoint) return;
    // Lazy: only import if endpoint configured, never blocks startup
    const { NodeSDK } = await import("@opentelemetry/sdk-node" as unknown as string).catch(()=>({NodeSDK: null})) as unknown as {NodeSDK: unknown};
    if (!NodeSDK) return;
  } catch {}
}
