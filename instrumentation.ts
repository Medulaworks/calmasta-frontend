export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.TELEMETRY_ENABLED === "true") {
    try {
      // @ts-ignore optional dep
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      // @ts-ignore optional dep
      const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
      const sdk = new NodeSDK({
        serviceName: process.env.OTEL_SERVICE_NAME ?? "calmasta-frontend-server",
        instrumentations: [getNodeAutoInstrumentations({ enabled: true })],
      });
      sdk.start();
    } catch {
      // OTEL not installed or not configured; remain unavailable honestly
    }
  }
}
