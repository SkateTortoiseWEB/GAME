import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { judgeWithLlm } from "@/lib/llm";

const ok = (valid: boolean, canonical: string | null, rarity?: number) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ valid, canonical, rarity }) } }] }));

describe("judgeWithLlm retries", () => {
  beforeEach(() => { process.env.LLM_API_KEY = "test"; vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env.LLM_API_KEY; });

  it("retries once after a timeout and succeeds", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }))
      .mockResolvedValueOnce(ok(true, "Berlin"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await judgeWithLlm("Cities", "berlin")).toEqual({ ok: true, verdict: { valid: true, canonical: "Berlin", rarity: 0 } });
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
    expect(await judgeWithLlm("Cities", "xyz")).toEqual({ ok: true, verdict: { valid: false, canonical: null, rarity: 0 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads and clamps the rarity grade; invalid answers are always 0", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(true, "Bydgoszcz", 2))
      .mockResolvedValueOnce(ok(true, "Weird", 99))
      .mockResolvedValueOnce(ok(true, "Odd", -4))
      .mockResolvedValueOnce(ok(true, "Plain", undefined as unknown as number))
      .mockResolvedValueOnce(ok(false, null, 3));
    vi.stubGlobal("fetch", fetchMock);
    const rarity = async (a: string) => { const r = await judgeWithLlm("Cities", a); return r.ok ? r.verdict.rarity : -1; };
    expect([await rarity("a"), await rarity("b"), await rarity("c"), await rarity("d"), await rarity("e")]).toEqual([2, 3, 0, 0, 0]);
  });

  it("asks for stingy grading: common is the default and uncertainty rounds down", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(true, "Bruges", 0));
    vi.stubGlobal("fetch", fetchMock);
    await judgeWithLlm("Cities", "bruges");
    const sys = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content as string;
    expect(sys).toContain("when unsure choose the LOWER grade");
    expect(sys).not.toContain("rarely a 0");
  });
});
