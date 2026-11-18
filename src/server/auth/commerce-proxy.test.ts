import { beforeEach, expect, it, vi } from "vitest";
import { AuthService } from "./service";
import type { AuthConfig } from "./config";
import type { AuthStore } from "./store";

class MemoryStore implements AuthStore {
  async putTransaction() {}
  async consumeTransaction() {
    return null;
  }
  async putSession() {}
  async session() {
    return null;
  }
  async revoke() {
    return [];
  }
}

const APP = "http://localhost:3006";
const API = "http://localhost:3009";
const cfg = (): AuthConfig => ({
  appOrigin: APP,
  apiOrigin: API,
  sessionSecret: "a".repeat(64),
  secure: false,
  callbackUrl: `${APP}/api/auth/callback`,
  sessionCookie: "sid",
  transactionCookie: "txn",
});

let auth: AuthService;

beforeEach(() => {
  auth = new AuthService(cfg(), new MemoryStore());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "not found" }, { status: 404 })),
  );
});

it("lets authenticated commerce BFF segments reach the session check", async () => {
  // Without a session the proxy must answer 401 (session required). 404
  // would mean the commerce path never reached the backend allowlist.
  const cases: Array<{ segments: string[]; method: string }> = [
    { segments: ["commerce", "catalog"], method: "GET" },
    { segments: ["commerce", "checkout"], method: "POST" },
    {
      segments: ["commerce", "checkout", "e0a1b2c3-d4e5-4f60-87a1-2b3c4d5e6f7a1"],
      method: "GET",
    },
    { segments: ["commerce", "portal"], method: "POST" },
  ];
  for (const { segments, method } of cases) {
    const res = await auth.proxy(
      new Request(`${APP}/api/${segments.join("/")}`, {
        method,
        headers: { Origin: APP, "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({}) : undefined,
      }),
      segments,
    );
    expect(res.status).toBe(401);
  }
});

it("still rejects unknown BFF segments with 404", async () => {
  const res = await auth.proxy(
    new Request(`${APP}/api/store/checkout`, { headers: { Origin: APP } }),
    ["store", "checkout"],
  );
  expect(res.status).toBe(404);
});
