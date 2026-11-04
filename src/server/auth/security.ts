import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { dashboardPath } from "../../lib/app-routes";

export function safeReturnTo(value: string | null, fallback = "/dashboard"): string {
  if (!value || value.length > 2048) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\x00-\x20]/.test(decoded)) return fallback;
    const path = new URL(decoded, "https://local.invalid");
    if (
      path.origin !== "https://local.invalid" ||
      path.pathname.startsWith("/login") ||
      path.pathname.startsWith("/auth/login") ||
      path.pathname.startsWith("/admin/auth/login") ||
      path.pathname.startsWith("/dashboard/admin/auth/login") ||
      path.pathname.startsWith("/api/")
    ) return fallback;
    return dashboardPath(path.pathname + path.search + path.hash);
  } catch { return fallback; }
}
export function sameOrigin(request: Request, origin: string): boolean {
  return request.headers.get("origin") === origin && !["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "");
}
export const opaqueId = () => randomBytes(32).toString("base64url");
export const hashId = (id: string) => createHash("sha256").update(id).digest("hex");
function key(secret: string) {
  if (!/^[a-f\d]{64}$/i.test(secret)) throw new Error("SESSION_SECRET must be 32 random bytes encoded as 64 hex characters");
  return Buffer.from(secret, "hex");
}
export function seal(value: unknown, secret: string): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString("base64url");
}
export function unseal<T>(value: string, secret: string): T {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29) throw new Error("Invalid encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString("utf8")) as T;
}
export function readCookie(request: Request, name: string): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map(p => p.trim()).filter(p => p.startsWith(name + "="));
  if (values.length !== 1) return null;
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z\d_-]{1,128}$/.test(value) ? value : null;
}
export function cookie(name: string, value: string, secure: boolean, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}${secure ? "; Secure" : ""}`;
}
export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export async function readJson(request: Request,maxBytes=16384): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new HttpError(415, "JSON content type required");
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>262144)throw new HttpError(400,"Invalid JSON limit");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "JSON body required");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, "Request too large"); }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("object expected");
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON object");
  } finally { reader.releaseLock(); }
}
