import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { removeAvatar, uploadAvatar } from "./avatar-client";

const fetcher = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetcher.mockReset();
});

describe("avatar-client", () => {
  it("creates intent with SHA-256 and Idempotency-Key, PUTs without Content-Length or credentials, and completes", async () => {
    vi.stubGlobal("fetch", fetcher);
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const blob = new Blob([bytes], { type: "image/webp" });
    const expectedSha = createHash("sha256").update(Buffer.from(bytes)).digest("hex");

    fetcher
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "11111111-1111-4111-8111-111111111111",
            state: "awaiting_upload",
            expiresAt: "2026-10-28T17:20:00.000Z",
            upload: {
              url: "https://r2.example.invalid/avatars/pending/u1/11111111-1111-4111-8111-111111111111",
              headers: {
                "Content-Type": "image/webp",
                "Content-Length": String(bytes.byteLength),
                "x-amz-checksum-sha256": "base64checksum==",
                "If-None-Match": "*",
              },
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            avatarUrl: "https://r2.example.invalid/avatars/profiles/u1/11111111-1111-4111-8111-111111111111.webp",
            avatarExpiresAt: "2026-10-28T17:10:00.000Z",
            avatarVersion: 2,
          }),
          { status: 200 },
        ),
      );

    const res = await uploadAvatar(blob, 1, "idem-key-1");
    expect(res).toEqual({
      avatarUrl: "https://r2.example.invalid/avatars/profiles/u1/11111111-1111-4111-8111-111111111111.webp",
      avatarExpiresAt: "2026-10-28T17:10:00.000Z",
      avatarVersion: 2,
    });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][0]).toBe("/api/account/me/avatar");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-key-1",
      },
      body: JSON.stringify({
        contentType: "image/webp",
        sizeBytes: bytes.byteLength,
        sha256: expectedSha,
        expectedVersion: 1,
      }),
    });

    expect(fetcher.mock.calls[1][0]).toBe(
      "https://r2.example.invalid/avatars/pending/u1/11111111-1111-4111-8111-111111111111",
    );
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      headers: {
        "Content-Type": "image/webp",
        "x-amz-checksum-sha256": "base64checksum==",
        "If-None-Match": "*",
      },
      credentials: "omit",
    });
    expect((fetcher.mock.calls[1][1] as RequestInit).headers).not.toHaveProperty("Content-Length");

    expect(fetcher.mock.calls[2][0]).toBe("/api/account/me/avatar/complete");
    expect(fetcher.mock.calls[2][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" }),
    });
  });

  it("treats R2 412 immutable response as ready to complete and reuses intent on 503 complete retry", async () => {
    vi.stubGlobal("fetch", fetcher);
    const blob = new Blob([new Uint8Array([9, 8, 7])], { type: "image/png" });

    fetcher
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "22222222-2222-4222-8222-222222222222",
            state: "awaiting_upload",
            expiresAt: "2026-10-28T17:20:00.000Z",
            upload: {
              url: "https://r2.example.invalid/avatars/pending/u1/22222222-2222-4222-8222-222222222222",
              headers: { "Content-Type": "image/png", "If-None-Match": "*" },
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 412 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "storage_unavailable", message: "Unavailable" }), { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            avatarUrl: "https://r2.example.invalid/avatars/profiles/u1/22222222-2222-4222-8222-222222222222.webp",
            avatarExpiresAt: "2026-10-28T17:10:00.000Z",
            avatarVersion: 5,
          }),
          { status: 200 },
        ),
      );

    await expect(uploadAvatar(blob, 4)).rejects.toMatchObject({
      status: 503,
      code: "storage_unavailable",
    });

    // Retry with same blob should skip intent creation and R2 PUT and go straight to /complete
    const done = await uploadAvatar(blob, 4);
    expect(done.avatarVersion).toBe(5);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[3][0]).toBe("/api/account/me/avatar/complete");
  });

  it("sends expectedVersion in DELETE /api/account/me/avatar", async () => {
    vi.stubGlobal("fetch", fetcher);
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          avatarUrl: null,
          avatarExpiresAt: null,
          avatarVersion: 6,
        }),
        { status: 200 },
      ),
    );

    const res = await removeAvatar(5);
    expect(res).toEqual({
      avatarUrl: null,
      avatarExpiresAt: null,
      avatarVersion: 6,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/account/me/avatar",
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: 5 }),
      }),
    );
  });
});
