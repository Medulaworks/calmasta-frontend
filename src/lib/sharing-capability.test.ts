import { describe, it, expect, vi, afterEach } from "vitest";
import { getSharing, createLink, getPublicNotes } from "./sharing-client";
import { fixtureSharingState, fixturePublicNotes } from "./sharing-types";

afterEach(() => vi.unstubAllGlobals());

function jf(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("sharing — owned snapshots, once-only links, BFF 503 and no media", () => {
  it("owner opening dialog does not auto-create link or publication", async () => {
    vi.stubGlobal("fetch", jf(200, fixtureSharingState));
    const state = await getSharing("00000000-0000-4000-8000-000000000011");
    expect(state.publication).toBeDefined();
    expect(state.link).toBeNull();
    expect(state.linkUrl).toBeNull();
  });

  it("createLink once-only URL held in volatile memory, alreadyIssued without URL", async () => {
    vi.stubGlobal("fetch", jf(200, { ...fixtureSharingState, linkUrl: null, alreadyIssued: true }));
    const res = await createLink("00000000-0000-4000-8000-000000000011", { publicationId: "00000000-0000-4000-8000-000000000010", expiresAt: null }, "k-1");
    expect(res.alreadyIssued).toBe(true);
    expect(res.linkUrl).toBeFalsy();
  });

  it("snapshot excludes media and participant roster — only selected notes and optional transcript", async () => {
    expect((fixturePublicNotes as unknown as Record<string, unknown>).media).toBeUndefined();
    expect((fixturePublicNotes as unknown as Record<string, unknown>).participants).toBeUndefined();
    expect(fixturePublicNotes.notes.length).toBe(1);
    expect(fixturePublicNotes.transcript?.text.length).toBeGreaterThan(0);
  });

  it("respects 503 capability_unavailable for sharing", async () => {
    vi.stubGlobal("fetch", jf(503, { code: "capability_unavailable", error: "Unavailable" }));
    await expect(getSharing("00000000-0000-4000-8000-000000000011")).rejects.toMatchObject({ status: 503 });
  });

  it("public notes 404 generic for revoked/expired without enumeration", async () => {
    vi.stubGlobal("fetch", jf(404, { code: "not_found", error: "Not found" }));
    await expect(getPublicNotes("invalid-token-123")).rejects.toMatchObject({ status: 404 });
  });

  it("abortable sharing fetch", async () => {
    const c = new AbortController();
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(JSON.stringify(fixtureSharingState), { status: 200 });
    });
    vi.stubGlobal("fetch", spy as unknown as typeof fetch);
    c.abort();
    await expect(getSharing("00000000-0000-4000-8000-000000000011", c.signal)).rejects.toThrow();
  });
});
