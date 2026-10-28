import { createHash } from "node:crypto";
import { Pool } from "pg";
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
export class PgAuthStore implements AuthStore {
  constructor(private pool: Pool, private secret: string) {}
  async putTransaction(hash: string, value: LoginTransaction) {
    await this.pool.query("DELETE FROM web_auth_transactions WHERE expires_at<=now()");
    await this.pool.query("DELETE FROM web_sessions WHERE expires_at<=now()");
    await this.pool.query("INSERT INTO web_auth_transactions(id_hash,encrypted_data,expires_at) VALUES($1,$2,now()+interval '10 minutes')", [hash, seal(value,this.secret)]);
  }
  async consumeTransaction(hash: string) {
    try {
      const result = await this.pool.query("DELETE FROM web_auth_transactions WHERE id_hash=$1 RETURNING encrypted_data,expires_at",[hash]);
      const row=result.rows[0];
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
      try {
        return unseal<LoginTransaction>(row.encrypted_data,this.secret);
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }
  async putSession(hash: string, value: SessionData, expiresAt: number) {
    await this.pool.query("INSERT INTO web_sessions(id_hash,subject,encrypted_data,expires_at) VALUES($1,$2,$3,$4)",[hash,value.subject,seal(value,this.secret),new Date(expiresAt)]);
  }
  async session(hash: string, refresh: (value: SessionData) => Promise<SessionData | null>) {
    const connection=await this.pool.connect();
    try {
      await connection.query("BEGIN");
      // Cross-process lock prevents concurrent refresh-token rotation races.
      const row=(await connection.query("SELECT encrypted_data FROM web_sessions WHERE id_hash=$1 AND expires_at>now() FOR UPDATE",[hash])).rows[0];
      if(!row) { await connection.query("COMMIT"); return null; }
      let previous: SessionData;
      try {
        previous = unseal<SessionData>(row.encrypted_data, this.secret);
      } catch {
        await connection.query("DELETE FROM web_sessions WHERE id_hash=$1", [hash]);
        await connection.query("COMMIT");
        return null;
      }
      const value = await refresh(previous);
      if(!value) await connection.query("DELETE FROM web_sessions WHERE id_hash=$1",[hash]);
      else if(value!==previous) await connection.query("UPDATE web_sessions SET encrypted_data=$2 WHERE id_hash=$1",[hash,seal(value,this.secret)]);
      await connection.query("COMMIT");return value;
    } catch(error) { await connection.query("ROLLBACK");throw error; }
    finally { connection.release(); }
  }
  async revoke(hash: string, all: boolean) {
    // All-device revocation requires a current, unexpired session.
    const result=await this.pool.query(all
      ? "DELETE FROM web_sessions WHERE subject=(SELECT subject FROM web_sessions WHERE id_hash=$1 AND expires_at>now()) RETURNING id_hash,encrypted_data"
      : "DELETE FROM web_sessions WHERE id_hash=$1 RETURNING id_hash,encrypted_data",[hash]);
    return result.rows.sort((a,b)=>Number(b.id_hash===hash)-Number(a.id_hash===hash)).map(row=>unseal<SessionData>(row.encrypted_data,this.secret));
  }
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
