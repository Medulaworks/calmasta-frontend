import { ApiError } from "./upload-client";
import { adminGet } from "./admin-client";
import type { SharingState, PublicNotes, SharedNotesView } from "./sharing-types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const corr = res.headers.get("x-correlation-id") ?? (body as { correlationId?: string }).correlationId;
    const code = (body as { code?: string }).code ?? (res.status === 503 ? "capability_unavailable" : undefined);
    const msg = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? "Something went wrong.";
    throw new ApiError(res.status, msg, code ?? (corr ? `correlation:${corr}` : undefined), corr ?? undefined);
  }
  return body as T;
}

export async function getSharing(captureId: string, signal?: AbortSignal): Promise<SharingState> {
  const raw = await req<Record<string, unknown>>(`/api/captures/${encodeURIComponent(captureId)}/sharing`, { signal });
  if (!raw) return raw as unknown as SharingState;
  const version = Number(raw.sharingVersion ?? raw.version ?? 0);
  const rawPubs = Array.isArray(raw.publications) ? raw.publications : [];
  const publications = rawPubs.length > 0
    ? rawPubs.map((item) => {
        const p = item as Record<string, unknown>;
        return {
          id: String(p.id ?? ""),
          captureId,
          version: Number(p.publicationVersion ?? p.version ?? 1),
          displayTitle: (p.displayTitle as string | null) ?? null,
          insightIds: Array.isArray(p.insightIds) ? (p.insightIds as string[]) : [],
          includeTranscript: !!p.includeTranscript,
          mode: "restricted" as const,
          createdAt: String(p.publishedAt ?? p.createdAt ?? new Date().toISOString()),
          publishedAt: (p.publishedAt as string | null) ?? null,
        };
      })
    : raw.publication ? [raw.publication as import("./sharing-types").SharePublication] : [];
  const rawLinks = Array.isArray(raw.links) ? raw.links : [];
  const links = rawLinks.length > 0
    ? rawLinks.map((item) => {
        const l = item as Record<string, unknown>;
        return {
          id: String(l.id ?? ""),
          publicationId: String(l.publicationId ?? ""),
          expiresAt: (l.expiresAt as string | null) ?? null,
          revokedAt: (l.revokedAt as string | null) ?? null,
          createdAt: String(l.createdAt ?? ""),
        };
      })
    : raw.link ? [raw.link as import("./sharing-types").ShareLink] : [];
  const rawGrants = Array.isArray(raw.grants) ? raw.grants : [];
  const grants = rawGrants.map((item) => {
    const g = item as Record<string, unknown>;
    return {
      id: String(g.id ?? ""),
      email: String(g.email ?? ""),
      publicationId: String(g.publicationId ?? ""),
      createdAt: String(g.createdAt ?? ""),
      revokedAt: (g.revokedAt as string | null) ?? null,
    };
  });
  const activeLink = links.find((l) => !l.revokedAt) ?? links[0] ?? null;
  const latestPublication = publications[0] ?? (raw.publication as import("./sharing-types").SharePublication | null) ?? null;
  return {
    version,
    sharingVersion: version,
    owner: raw.owner as import("./sharing-types").SharingOwner | undefined,
    publication: latestPublication,
    publications,
    grants,
    link: activeLink,
    links,
    capabilities: (raw.capabilities as import("./sharing-types").SharingCapabilities | undefined) ?? {
      publicLinksEnabled: false,
      recipientGrantsEnabled: false,
      invitationsEnabled: false,
      maxExpiryDays: null,
    },
    linkUrl: (raw.linkUrl as string | undefined) ?? (raw.url as string | undefined) ?? null,
    alreadyIssued: !!raw.alreadyIssued,
  };
}

export const createPublication = (
  captureId: string,
  body: { expectedVersion: number; insightIds: string[]; includeTranscript: boolean; displayTitle?: string; expiresAt?: string | null },
  idempotencyKey: string,
) =>
  req<{ id: string; publicationVersion: number; expiresAt: string | null; sharingVersion: number } & Partial<SharingState>>(
    `/api/captures/${encodeURIComponent(captureId)}/sharing/publications`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );

export const createLink = async (
  captureId: string,
  body: { expectedVersion?: number; publicationId: string; replaceLinkId?: string; expiresAt?: string | null },
  idempotencyKey: string,
) => {
  const payload = {
    expectedVersion: body.expectedVersion ?? 0,
    publicationId: body.publicationId,
    ...(body.replaceLinkId ? { replaceLinkId: body.replaceLinkId } : {}),
    ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
  };
  const res = await req<{ id?: string; token?: string; url?: string; linkUrl?: string; alreadyIssued?: boolean; sharingVersion?: number; version?: number } & Partial<SharingState>>(
    `/api/captures/${encodeURIComponent(captureId)}/sharing/links`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    },
  );
  return {
    ...res,
    linkUrl: res.url ?? res.linkUrl ?? null,
    version: res.sharingVersion ?? res.version,
  };
};

export const revokeLink = (
  captureId: string,
  linkId: string,
  body: { expectedVersion: number; reason?: string },
) =>
  req<{ revoked: boolean; sharingVersion: number } & Partial<SharingState>>(
    `/api/captures/${encodeURIComponent(captureId)}/sharing/links/${encodeURIComponent(linkId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: body.expectedVersion,
        reason: ["owner_request", "rotation", "security", "republish"].includes(body.reason ?? "") ? body.reason : "owner_request",
      }),
    },
  );

export const createGrant = (
  captureId: string,
  body: { expectedVersion?: number; publicationId: string; email: string },
  idempotencyKey: string,
) =>
  req<{ accepted: boolean; delivery: string; sharingVersion: number } & Partial<SharingState>>(
    `/api/captures/${encodeURIComponent(captureId)}/sharing/grants`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        expectedVersion: body.expectedVersion ?? 0,
        publicationId: body.publicationId,
        email: body.email,
      }),
    },
  );

export const revokeGrant = (
  captureId: string,
  grantId: string,
  body: { expectedVersion: number; reason?: string },
) =>
  req<{ revoked: boolean; sharingVersion: number } & Partial<SharingState>>(
    `/api/captures/${encodeURIComponent(captureId)}/sharing/grants/${encodeURIComponent(grantId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: body.expectedVersion,
        reason: ["owner_request", "rotation", "security", "republish"].includes(body.reason ?? "") ? body.reason : "owner_request",
      }),
    },
  );

export const sendGrant = (
  captureId: string,
  grantId: string,
  body?: { expectedVersion?: number; reason?: string },
) =>
  req<{ ok?: boolean; accepted?: boolean; delivery?: string }>(
    `/api/captures/${encodeURIComponent(captureId)}/sharing/grants/${encodeURIComponent(grantId)}/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: body?.expectedVersion ?? 0,
        reason: ["owner_request", "rotation", "security", "republish"].includes(body?.reason ?? "") ? body!.reason : "owner_request",
      }),
    },
  );

export const getPublicNotes = (token: string, signal?: AbortSignal) => req<PublicNotes>(`/api/public/notes/${encodeURIComponent(token)}`, { signal });
export const getSharedNotes = (grantId: string, signal?: AbortSignal) => req<SharedNotesView>(`/api/shared-notes/${encodeURIComponent(grantId)}`, { signal });

// Admin helpers reusing admin client where staff endpoints live
export const adminListCaptures = () => adminGet("/api/admin/captures");
