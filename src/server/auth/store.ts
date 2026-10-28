import { createHash } from "node:crypto";
import { seal, unseal } from "./security";
export interface LoginTransaction { state: string; nonce: string; verifier: string; returnTo: string }
export interface SessionData {
  subject: string; accessToken: string; refreshToken?: string; idToken: string; accessExpiresAt: number;
  email: string; emailVerified: boolean; identityName: string | null;
}
export interface AuthStore {
  putTransaction(hash: string, value: LoginTransaction): Promise<void>;
  consumeTransaction(hash: string): Promise<LoginTransaction | null>;
  putSession(hash: string, value: SessionData, expiresAt: number): Promise<void>;
  session(hash: string, refresh: (value: SessionData) => Promise<SessionData | null>): Promise<SessionData | null>;
  revoke(hash: string, all: boolean): Promise<SessionData[]>;
}

export class ApiAuthStore implements AuthStore {
  private readonly bffSecret: string;
  constructor(private apiOrigin: string, private secret: string) {
    this.bffSecret = createHash("sha256").update(`calmasta-bff-store:${secret}`).digest("hex");
  }
  private async call<T>(path: string, method: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(new URL(path, this.apiOrigin), {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Bff-Secret": this.bffSecret,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Auth store request failed (${response.status})`);
    return (await response.json()) as T;
  }
  async putTransaction(hash: string, value: LoginTransaction) {
    await this.call("/internal/auth/transactions", "POST", { hash, encryptedData: seal(value, this.secret) });
  }
  async consumeTransaction(hash: string) {
    try {
      const res = await this.call<{ encryptedData: string | null; expiresAt: string | null }>(
        "/internal/auth/transactions/consume",
        "POST",
        { hash },
      );
      if (!res.encryptedData || !res.expiresAt || new Date(res.expiresAt).getTime() <= Date.now()) return null;
      return unseal<LoginTransaction>(res.encryptedData, this.secret);
    } catch {
      return null;
    }
  }
  async putSession(hash: string, value: SessionData, expiresAt: number) {
    await this.call("/internal/auth/sessions", "POST", {
      hash,
      subject: value.subject,
      encryptedData: seal(value, this.secret),
      expiresAt,
    });
  }
  async session(hash: string, refresh: (value: SessionData) => Promise<SessionData | null>) {
    const res = await this.call<{ encryptedData: string | null }>("/internal/auth/sessions/get", "POST", { hash });
    if (!res.encryptedData) return null;
    let previous: SessionData;
    try {
      previous = unseal<SessionData>(res.encryptedData, this.secret);
    } catch {
      await this.call("/internal/auth/sessions/revoke", "POST", { hash, all: false }).catch(() => undefined);
      return null;
    }
    const value = await refresh(previous);
    if (!value) {
      await this.call("/internal/auth/sessions/revoke", "POST", { hash, all: false }).catch(() => undefined);
      return null;
    }
    if (value !== previous) {
      await this.call("/internal/auth/sessions", "PATCH", { hash, encryptedData: seal(value, this.secret) });
    }
    return value;
  }
  async revoke(hash: string, all: boolean) {
    const res = await this.call<{ rows: Array<{ encryptedData: string }> }>(
      "/internal/auth/sessions/revoke",
      "POST",
      { hash, all },
    );
    const out: SessionData[] = [];
    for (const r of res.rows) {
      try {
        out.push(unseal<SessionData>(r.encryptedData, this.secret));
      } catch {
        // Ignore unseal errors on revoked rows
      }
    }
    return out;
  }
}
