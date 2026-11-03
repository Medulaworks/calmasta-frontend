// Helpers and fixtures shared by the staff-area preview data (see admin-preview.ts). Sample data only.

export const MIN = 60_000;
export const ago = (minutes: number) => new Date(Date.now() - minutes * MIN).toISOString();
export const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
export const wait = (ms = 280) => new Promise((r) => setTimeout(r, ms));

export const PEOPLE = [
  { id: "3f9a21c4-0b7e-4d3a-9c1e-5a8e0f2b7d11", email: "grace@example.test", name: "Grace Hopper", plan: "pro", planStatus: "active", created: 79 },
  { id: "b71d0e66-9a42-4f10-8d0c-2c61a4e9f3aa", email: "amara@example.test", name: "Amara Okafor", plan: "business", planStatus: "active", created: 58 },
  { id: "c5e83a17-1d6b-4b8e-a2f7-7e90b1d4c602", email: "daniel@example.test", name: "Daniel Reyes", plan: "pro", planStatus: "active", created: 31 },
  { id: "8d12f4b9-6c3a-47e1-9b05-e3a7c8d19f44", email: "priya@example.test", name: "Priya Nair", plan: "pro", planStatus: "grace", created: 96 },
  { id: "e90b7c25-3f18-4a6d-b4c2-1a5d6e8f0b73", email: "tom@example.test", name: "Tom Becker", plan: "free", planStatus: "active", created: 12 },
  { id: "27a6d0e3-8b94-4c15-a7f2-90c3e5b1d886", email: "lena@example.test", name: "Lena Fischer", plan: "free", planStatus: "active", created: 140 },
  { id: "5c0e9d71-2a86-4f3b-8e14-b7d3a90c6e25", email: "chloe@example.test", name: "Chloe Martin", plan: "free", planStatus: "active", created: 5 },
  { id: "a8f31b64-7d29-4e0c-9a53-c2e61f48d097", email: "jonas@example.test", name: "Jonas Weber", plan: "pro", planStatus: "active", created: 22 },
] as const;

/** The staff action history shared by every preview screen. Newest first. Lives in memory only. */
export const auditStore: Array<{ id: string; at: string; actor: string | null; action: string; target: string | null; customerId: string | null; reason: string | null; outcome: "success" | "denied" | "failed"; correlationId: string }> = [];
let counter = 0;
export const PREVIEW_ACTOR = "preview@jooba.test";
export const corr = () => `req_${Math.random().toString(16).slice(2, 10)}`;

export function note(action: string, target: string, reason: unknown, customerId: string | null = null, outcome: "success" | "denied" | "failed" = "success") {
  auditStore.unshift({ id: `a${++counter}`, at: new Date().toISOString(), actor: PREVIEW_ACTOR, action, target, customerId, reason: typeof reason === "string" && reason ? reason : null, outcome, correlationId: corr() });
}
