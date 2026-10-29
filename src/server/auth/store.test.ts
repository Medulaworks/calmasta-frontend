import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createHash,randomUUID } from "node:crypto";
import { ApiAuthStore, type SessionData } from "./store";
import { hashId, unseal } from "./security";

const secret = "c".repeat(64);
const expectedBffSecret = createHash("sha256").update(`calmasta-bff-store:${secret}`).digest("hex");

interface TxRow { encryptedData: string; expiresAt: number }
interface SessionRow { leaseToken?:string;subject: string; encryptedData: string; expiresAt: number }

let server: Server;
let origin = "";
let store: ApiAuthStore;
const transactions = new Map<string, TxRow>();
const sessions = new Map<string, SessionRow>();

const fixture = (subject = "first"): SessionData => ({
  subject,
  accessToken: "secret-access",
  idToken: "secret-id",
  refreshToken: "secret-refresh",
  accessExpiresAt: 0,
  email: "fixture@example.invalid",
  emailVerified: true,
  identityName: null,
});

describe("API-backed session persistence and encryption", () => {
  beforeAll(async () => {
    server = createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.headers["x-bff-secret"] !== expectedBffSecret) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: "unauthorized_bff" }));
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const path = new URL(req.url!, "http://127.0.0.1").pathname;

      if (path === "/internal/auth/transactions" && req.method === "POST") {
        transactions.set(body.hash, { encryptedData: body.encryptedData, expiresAt: Date.now() + 600_000 });
        return res.end(JSON.stringify({ ok: true }));
      }
      if (path === "/internal/auth/transactions/consume" && req.method === "POST") {
        const row = transactions.get(body.hash);
        transactions.delete(body.hash);
        if (!row) return res.end(JSON.stringify({ encryptedData: null, expiresAt: null }));
        return res.end(JSON.stringify({ encryptedData: row.encryptedData, expiresAt: new Date(row.expiresAt).toISOString() }));
      }
      if (path === "/internal/auth/sessions" && req.method === "POST") {
        sessions.set(body.hash, {
          subject: body.subject,
          encryptedData: body.encryptedData,
          expiresAt: Number(body.expiresAt),
        });
        return res.end(JSON.stringify({ ok: true }));
      }
      if (path === "/internal/auth/sessions/get" && req.method === "POST") {
        const row = sessions.get(body.hash);
        if (!row || row.expiresAt <= Date.now()) return res.end(JSON.stringify({ encryptedData: null }));
        if(row.leaseToken)return res.end(JSON.stringify({busy:true,encryptedData:null}));
        row.leaseToken=randomUUID();return res.end(JSON.stringify({ encryptedData: row.encryptedData,leaseToken:row.leaseToken }));
      }
      if (path === "/internal/auth/sessions" && req.method === "PATCH") {
        const row = sessions.get(body.hash);
        if(!row||row.leaseToken!==body.leaseToken)return res.end(JSON.stringify({ok:false}));
        if (row.expiresAt > Date.now()) row.encryptedData = body.encryptedData;
        row.leaseToken=undefined;
        return res.end(JSON.stringify({ ok: true }));
      }
      if (path === "/internal/auth/sessions/revoke" && req.method === "POST") {
        if (body.all) {
          const current = sessions.get(body.hash);
          if (!current || current.expiresAt <= Date.now()) return res.end(JSON.stringify({ rows: [] }));
          const removed: Array<{ hash: string; encryptedData: string }> = [];
          for (const [k, v] of sessions.entries()) {
            if (v.subject === current.subject) {
              removed.push({ hash: k, encryptedData: v.encryptedData });
              sessions.delete(k);
            }
          }
          removed.sort((a, b) => Number(b.hash === body.hash) - Number(a.hash === body.hash));
          return res.end(JSON.stringify({ rows: removed.map((r) => ({ encryptedData: r.encryptedData })) }));
        }
        const row = sessions.get(body.hash);
        sessions.delete(body.hash);
        return res.end(JSON.stringify({ rows: row ? [{ encryptedData: row.encryptedData }] : [] }));
      }
      res.statusCode = 404;
      return res.end("{}");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    store = new ApiAuthStore(origin, secret);
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("authenticates with X-Bff-Secret and consumes encrypted login transactions once", async () => {
    const id = hashId("transaction");
    const transaction = { state: "state", nonce: "nonce", verifier: "private-verifier", returnTo: "/dashboard/library" };
    await store.putTransaction(id, transaction);
    const raw = transactions.get(id)!.encryptedData;
    expect(raw).not.toContain("private-verifier");
    const results = await Promise.all([store.consumeTransaction(id), store.consumeTransaction(id)]);
    expect(results.filter(Boolean)).toEqual([transaction]);

    await store.putTransaction(id, transaction);
    transactions.get(id)!.expiresAt = Date.now() - 1000;
    expect(await store.consumeTransaction(id)).toBeNull();
  });

  it("persists across store instances, updates refreshed tokens, and keeps tokens encrypted", async () => {
    const id = hashId("persistent");
    await store.putSession(id, fixture(), Date.now() + 60_000);
    const refresh = async (data: SessionData) => {
      if (data.accessExpiresAt > Date.now()) return data;
      return { ...data, accessExpiresAt: Date.now() + 60_000, refreshToken: "rotated" };
    };
    const otherInstance = new ApiAuthStore(origin, secret);
    const updated = await otherInstance.session(id, refresh);
    expect(updated?.refreshToken).toBe("rotated");
    const raw = sessions.get(id)!.encryptedData;
    expect(raw).not.toContain("secret-access");
    expect(unseal<SessionData>(raw, secret).refreshToken).toBe("rotated");
  });

  it("revokes every session for one subject without touching another or using expired sessions", async () => {
    const first = hashId("first");
    const second = hashId("other-device");
    const unrelated = hashId("unrelated");
    await store.putSession(first, fixture(), Date.now() + 60_000);
    await store.putSession(second, fixture(), Date.now() + 60_000);
    await store.putSession(unrelated, fixture("second"), Date.now() + 60_000);
    await store.revoke(first, true);
    expect(await store.session(second, async (data) => data)).toBeNull();
    expect((await store.session(unrelated, async (data) => data))?.subject).toBe("second");

    const expired = hashId("expired");
    const active = hashId("active");
    await store.putSession(expired, fixture(), Date.now() - 1000);
    await store.putSession(active, fixture(), Date.now() + 60_000);
    await store.revoke(expired, true);
    expect(await store.session(active, async (data) => data)).not.toBeNull();
  });

it("serializes refresh callbacks across store instances and releases leases on transient failure",async()=>{
 const id=hashId("concurrent-refresh");await store.putSession(id,fixture(),Date.now()+60000);
 let count=0;const refresh=async(v:SessionData)=>{if(v.refreshToken==="rotated-once")return v;count++;await new Promise(r=>setTimeout(r,30));return {...v,refreshToken:"rotated-once"};};
 const results=await Promise.all([store.session(id,refresh),new ApiAuthStore(origin,secret).session(id,refresh)]);expect(count).toBe(1);expect(results.every(x=>x?.refreshToken==="rotated-once")).toBe(true);
 await expect(store.session(id,async()=>{throw Error("temporary failure");})).rejects.toThrow("temporary failure");
 expect((await store.session(id,async v=>v))?.refreshToken).toBe("rotated-once");
});

});
