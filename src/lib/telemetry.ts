"use client";

// Compatibility entry points for callers. No browser payloads may be collected
// or sent while /api/telemetry reports browser_telemetry_unavailable.
export function initTelemetry(): void {}
export function trackApiInteraction(path: string, status: number): void {
  void path;
  void status;
}
