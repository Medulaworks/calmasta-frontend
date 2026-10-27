import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PgAuthStore, type SessionData } from "./store";
import { hashId, unseal } from "./security";

const schema="auth_test_"+randomUUID().replaceAll("-","");
const role="auth_role_"+randomUUID().replaceAll("-","");
const enabled=Boolean(process.env.TEST_DATABASE_URL);
const secret="c".repeat(64);
let owner:Pool, runtime:Pool, store:PgAuthStore;
const fixture=(subject="first"):SessionData=>({subject,accessToken:"secret-access",idToken:"secret-id",refreshToken:"secret-refresh",accessExpiresAt:0,email:"fixture@example.invalid",emailVerified:true,identityName:null});
describe.skipIf(!enabled)("PostgreSQL session persistence and concurrency",()=>{
 beforeAll(async()=>{
  owner=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema},public`});
  await owner.query(`CREATE SCHEMA ${schema}`);
  const directory=process.env.AUTH_MIGRATIONS_DIR??resolve(process.cwd(),"../calmasta-api/migrations");
  for(const file of ["001_foundation.sql","002_identity_sessions.sql"])await owner.query(await readFile(resolve(directory,file),"utf8"));
  await owner.query("INSERT INTO users(id,subject) VALUES($1,'first'),($2,'second')",[randomUUID(),randomUUID()]);
  await owner.query(`CREATE ROLE ${role} LOGIN`);
  await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
  await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`);
  const url=new URL(process.env.TEST_DATABASE_URL!);url.username=role;
  runtime=new Pool({connectionString:url.href,options:`-c search_path=${schema},public`});
  store=new PgAuthStore(runtime,secret);
 });
 afterAll(async()=>{await runtime?.end();if(owner){await owner.query(`DROP SCHEMA ${schema} CASCADE`);await owner.query(`DROP ROLE ${role}`);await owner.end();}});
 it("works with a restricted DML role and consumes encrypted login transactions once",async()=>{
  await expect(runtime.query(`CREATE TABLE ${schema}.forbidden(id integer)`)).rejects.toThrow();
  const id=hashId("transaction"),transaction={state:"state",nonce:"nonce",verifier:"private-verifier",returnTo:"/library"};
  await store.putTransaction(id,transaction);
  const raw=(await owner.query("SELECT encrypted_data FROM web_auth_transactions WHERE id_hash=$1",[id])).rows[0].encrypted_data;
  expect(raw).not.toContain("private-verifier");
  const results=await Promise.all([store.consumeTransaction(id),store.consumeTransaction(id)]);
  expect(results.filter(Boolean)).toEqual([transaction]);
  await store.putTransaction(id,transaction);await owner.query("UPDATE web_auth_transactions SET expires_at=now()-interval '1 second' WHERE id_hash=$1",[id]);
  expect(await store.consumeTransaction(id)).toBeNull();
 });
 it("persists across store instances, serializes refresh and keeps tokens encrypted",async()=>{
  const id=hashId("persistent");await store.putSession(id,fixture(),Date.now()+60000);
  let refreshes=0;
  const refresh=async(data:SessionData)=>{if(data.accessExpiresAt>Date.now())return data;refreshes++;await new Promise(resolve=>setTimeout(resolve,25));return {...data,accessExpiresAt:Date.now()+60000,refreshToken:"rotated"};};
  const otherInstance=new PgAuthStore(runtime,secret);
  const result=await Promise.all([store.session(id,refresh),otherInstance.session(id,refresh)]);
  expect(refreshes).toBe(1);expect(result.every(x=>x?.refreshToken==="rotated")).toBe(true);
  const raw=(await owner.query("SELECT encrypted_data FROM web_sessions WHERE id_hash=$1",[id])).rows[0].encrypted_data;
  expect(raw).not.toContain("secret-access");expect(unseal<SessionData>(raw,secret).refreshToken).toBe("rotated");
 });
 it("revokes every session for one subject without touching another or resurrecting rows",async()=>{
  const first=hashId("first"),second=hashId("other-device"),unrelated=hashId("unrelated");
  await store.putSession(first,fixture(),Date.now()+60000);await store.putSession(second,fixture(),Date.now()+60000);
  await store.putSession(unrelated,fixture("second"),Date.now()+60000);
  await store.revoke(first,true);
  expect(await store.session(second,async data=>data)).toBeNull();
  expect((await store.session(unrelated,async data=>data))?.subject).toBe("second");
  expect(await store.session(first,async data=>({...data,accessToken:"new"}))).toBeNull();
 });
 it("does not use an expired session to revoke other active sessions",async()=>{
  const expired=hashId("expired"),active=hashId("active");
  await store.putSession(expired,fixture(),Date.now()-1000);await store.putSession(active,fixture(),Date.now()+60000);
  await store.revoke(expired,true);expect(await store.session(active,async data=>data)).not.toBeNull();
 });
});
