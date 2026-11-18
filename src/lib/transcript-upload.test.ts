import { afterEach, expect, it, vi } from "vitest";
import { createTranscriptImport, readTranscriptFile, validateTranscript } from "./transcript-upload";
import { getCapture, listCaptures } from "./upload-client";
afterEach(() => vi.unstubAllGlobals());
it("reads a UTF-8 txt file without inventing timestamps and rejects invalid files", async () => {
 expect(await readTranscriptFile(new File(["Café\nNext step"], "notes.TXT"))).toBe("Café\nNext step");
 for (const file of [new File(["x"], "notes.pdf"), new File([new Uint8Array([0xff])], "bad.txt"), new File([new Uint8Array(1048577)], "large.txt"), new File(["a\0b"], "binary.txt"), new File([" "], "blank.txt")]) await expect(readTranscriptFile(file)).rejects.toThrow();
});
it("bounds pasted text and title and requires consent before any request", () => {
 vi.stubGlobal("fetch", vi.fn());
 for (const text of ["", " \n\t", "x".repeat(100001), "a\u0001b", "a\ud800b"]) expect(() => validateTranscript(text)).toThrow();
 expect(() => createTranscriptImport({ text: "valid", title: "x".repeat(201), consent: true })).toThrow();
 expect(() => createTranscriptImport({ text: "valid", consent: false })).toThrow();
 expect(fetch).not.toHaveBeenCalled();
 expect(validateTranscript("x".repeat(100000))).toBeUndefined();
});
it("imports privately with consent and a stable operation key across uncertain retries and duplicate clicks", async () => {
 let finish!: (value: Response) => void;
 const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("connection lost")).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
 vi.stubGlobal("fetch", fetcher);
 const attempt = createTranscriptImport({ text: "A private note", title: " Review ", consent: true });
 await expect(attempt.save()).rejects.toThrow("connection lost");
 const first = attempt.save(), second = attempt.save();
 expect(fetcher).toHaveBeenCalledTimes(2);
 finish(Response.json({ id: "saved", captureId: "saved", state: "completed", transcriptVersion: 1 }, { status: 201 }));
 await expect(first).resolves.toBe("saved"); await expect(second).resolves.toBe("saved");
 await expect(attempt.save()).resolves.toBe("saved"); expect(fetcher).toHaveBeenCalledTimes(2);
 const calls = fetcher.mock.calls;
 expect(calls[0][0]).toBe("/api/captures/transcripts");
 expect(new Headers(calls[0][1].headers).get("Idempotency-Key")).toBe(new Headers(calls[1][1].headers).get("Idempotency-Key"));
 expect(JSON.parse(calls[0][1].body)).toEqual({ text: "A private note", title: "Review", consent: true });
});
it("does not claim persistence from malformed success or error responses", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ state: "completed" })).mockResolvedValueOnce(Response.json({ code: "invalid_transcript" }, { status: 400 })));
 const attempt = createTranscriptImport({ text: "Note", consent: true });
 await expect(attempt.save()).rejects.toThrow(); await expect(attempt.save()).rejects.toThrow();
});
it("maps imported capture source in detail and recording lists", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ id: "text", source: "transcript", state: "completed" })).mockResolvedValueOnce(Response.json({ results: [{ id: "text", source: "transcript", state: "completed" }] })));
 expect((await getCapture("text")).source).toBe("transcript_upload"); expect((await listCaptures(25, "recordings"))[0].source).toBe("transcript_upload");
});

it("uses configured character and UTF-8 file byte limits", async () => {
 const limits={maxTranscriptCharacters:5,maxTranscriptBytes:8};
 expect(()=>validateTranscript("abcdef",limits)).toThrow();
 expect(()=>validateTranscript("界界界",limits)).toThrow();
 await expect(readTranscriptFile(new File(["abcdef"],"notes.txt"),limits)).rejects.toThrow();
 expect(()=>validateTranscript("abcde",limits)).not.toThrow();
});
