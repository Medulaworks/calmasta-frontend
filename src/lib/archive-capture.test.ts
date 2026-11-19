import { describe, expect, it, vi, afterEach } from "vitest";
import { archiveCapture } from "./upload-client";

describe("archiveCapture", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts empty JSON to the archive endpoint and returns the receipt without calling DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "9fbc2e18-5d92-4063-b242-bfe103418d16",
        archived: true,
        archivedAt: "2026-11-18T19:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const receipt = await archiveCapture("9fbc2e18-5d92-4063-b242-bfe103418d16");
    expect(receipt).toEqual({
      id: "9fbc2e18-5d92-4063-b242-bfe103418d16",
      archived: true,
      archivedAt: "2026-11-18T19:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/captures/9fbc2e18-5d92-4063-b242-bfe103418d16/archive");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe("{}");
    expect(init?.method).not.toBe("DELETE");
  });

  it("propagates server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ code: "not_found" }, { status: 404 }),
      ),
    );
    await expect(archiveCapture("missing-id")).rejects.toThrow();
  });
});
