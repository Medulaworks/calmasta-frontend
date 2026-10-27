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
    const result = await this.pool.query("DELETE FROM web_auth_transactions WHERE id_hash=$1 RETURNING encrypted_data,expires_at",[hash]);
    const row=result.rows[0];
    return row && new Date(row.expires_at).getTime()>Date.now() ? unseal<LoginTransaction>(row.encrypted_data,this.secret) : null;
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
      const previous=unseal<SessionData>(row.encrypted_data,this.secret), value=await refresh(previous);
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
