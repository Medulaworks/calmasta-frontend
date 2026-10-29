import { describe, expect, it } from "vitest";
import { safeReturnTo, sameOrigin, seal, unseal, readCookie, readJson } from "./security";

describe("authentication boundaries", () => {
  it("rejects external and encoded redirect paths", () => {
    for (const path of ["//evil.invalid", "https://evil.invalid", "/\\evil", "/%2f%2fevil.invalid", "/api/auth/login", "/auth/login", "/%0aevil"]) expect(safeReturnTo(path)).toBe("/dashboard");
    expect(safeReturnTo("/dashboard/library?filter=mine")).toBe("/dashboard/library?filter=mine");
  });
  it("requires the configured origin for cookie-authenticated writes", () => {
    expect(sameOrigin(new Request("https://app.invalid/api/me", { headers: { origin: "https://app.invalid" } }), "https://app.invalid")).toBe(true);
    for (const origin of ["https://evil.invalid", "null", ""]) expect(sameOrigin(new Request("https://app.invalid/api/me", { headers: { origin } }), "https://app.invalid")).toBe(false);
  });
  it("keeps token contents confidential and rejects tampering/wrong keys", () => {
    const secret="a".repeat(64), encoded=seal({ accessToken:"private-token" },secret);
    expect(encoded).not.toContain("private-token");expect(unseal(encoded,secret)).toEqual({accessToken:"private-token"});
    expect(()=>unseal(encoded,"b".repeat(64))).toThrow();
    expect(()=>unseal(encoded.slice(0,-6)+"AAAAAA",secret)).toThrow();
  });
  it("rejects duplicate/malformed authentication cookies", () => {
    expect(readCookie(new Request("https://app.invalid",{headers:{cookie:"sid=one; sid=two"}}),"sid")).toBeNull();
    expect(readCookie(new Request("https://app.invalid",{headers:{cookie:"sid=abc_123"}}),"sid")).toBe("abc_123");
  });
  it("bounds JSON bodies and rejects nonobjects", async()=>{
    await expect(readJson(new Request("https://app.invalid",{method:"POST",headers:{"content-type":"application/json"},body:"[]"}))).rejects.toThrow();
    await expect(readJson(new Request("https://app.invalid",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({x:"a".repeat(17000)})}))).rejects.toThrow();
  });
});

it("permits bounded transcript edit bodies only with an explicit larger limit",async()=>{
 const req=(length:number)=>new Request("https://app.invalid",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({text:"x".repeat(length)})});
 await expect(readJson(req(17000))).rejects.toMatchObject({status:413});
 expect((await readJson(req(17000),262144)).text).toHaveLength(17000);
 await expect(readJson(req(262144),262144)).rejects.toMatchObject({status:413});
});
