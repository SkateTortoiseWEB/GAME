import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { judgeWithLlm } from "@/lib/llm";

const ok = (valid: boolean, canonical: string | null) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ valid, canonical }) } }] }));

describe("judgeWithLlm retries", () => {
  beforeEach(() => { process.env.LLM_API_KEY = "test"; vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env.LLM_API_KEY; });

  it("retries once after a timeout and succeeds", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }))
      .mockResolvedValueOnce(ok(true, "Berlin"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await judgeWithLlm("Cities", "berlin")).toEqual({ ok: true, verdict: { valid: true, canonical: "Berlin" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second failure and reports the reason", async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await judgeWithLlm("Cities", "berlin");
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a rejected request (bad key, bad model)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await judgeWithLlm("Cities", "berlin");
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 503 from the provider", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(ok(false, null));
    vi.stubGlobal("fetch", fetchMock);
    expect(await judgeWithLlm("Cities", "xyz")).toEqual({ ok: true, verdict: { valid: false, canonical: null } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
