import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAnswerList, sanitizeList } from "@/lib/learned";
import { judgeAnswer } from "@/lib/judge";
import { getPrompt } from "@/lib/prompts";
import { NICHE_PROMPTS } from "@/data/prompts";

const reply = (tiers: { common?: string[]; rare?: string[]; ultra?: string[]; insane?: string[] }) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(tiers) } }] }));

describe("pre-generated answer lists", () => {
  beforeEach(() => { (globalThis as { __store?: unknown }).__store = undefined; process.env.LLM_API_KEY = "test"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.LLM_API_KEY; });

  it("sanitizes: trims, dedupes, drops junk and wrong-letter entries", () => {
    const p = getPrompt("cities:b")!;
    expect(sanitizeList(p, [
      { name: "  Bruges ", rarity: 1 }, { name: "bruges", rarity: 3 }, { name: "Berlin", rarity: 0 }, { name: "Paris", rarity: 0 },
      { name: "", rarity: 0 }, { name: "x".repeat(80), rarity: 0 }, { name: "Bern", rarity: 9 }, "Bonn",
    ])).toEqual([
      { name: "Bruges", rarity: 1 }, // listed twice: the first (lowest) tier is kept
      { name: "Berlin", rarity: 0 },
      { name: "Bern", rarity: 3 }, // clamped
      { name: "Bonn", rarity: 0 }, // older plain-string lists still load
    ]);
  });

  it("one generation call makes later answers instant and powers typo suggestions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ common: ["Bilbao", "Bologna", "Paris"], rare: ["Bruges"], ultra: ["Bergen op Zoom"], insane: ["Bydgoszcz"] }));
    vi.stubGlobal("fetch", fetchMock);
    const prompt = getPrompt("cities:b")!;

    await ensureAnswerList(prompt);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Accepted straight from the list: no further LLM call.
    expect(await judgeAnswer(prompt, "bruges")).toMatchObject({ status: "valid", canonical: "Bruges", source: "list", rarity: 1 });
    expect(await judgeAnswer(prompt, "Bilbao")).toMatchObject({ status: "valid", rarity: 0 });
    expect(await judgeAnswer(prompt, "bergen op zoom")).toMatchObject({ rarity: 2 });
    expect(await judgeAnswer(prompt, "Bydgoszcz")).toMatchObject({ rarity: 3 });
    // A typo is suggested from the list, never accepted.
    expect(await judgeAnswer(prompt, "Bolonga")).toEqual({ status: "suggest", canonical: "Bologna" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Calling again doesn't regenerate.
    await ensureAnswerList(prompt);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("works for niche prompts and survives a failed generation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("down", { status: 500 }))
      .mockResolvedValueOnce(reply({ common: ["Fire truck", "Tomato"] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const red = NICHE_PROMPTS.find((p) => p.id === "red-things")!;

    await ensureAnswerList(red); // fails quietly
    expect(await judgeAnswer(red, "tomato")).toMatchObject({ status: "error" }); // no list, falls back (mock exhausted -> error)
    fetchMock.mockClear();
    await ensureAnswerList(red); // retried on the next call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an off-list answer judged by the LLM carries its rarity grade and is cached with it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply({ common: ["Warsaw", "Wellington", "Windhoek", "Washington", "Wien"] })) // the list
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ valid: true, canonical: "Wolverhampton", rarity: 3 }) } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const prompt = getPrompt("cities:w")!; // its own prompt id, because the list cache outlives a single test
    await ensureAnswerList(prompt);
    expect(await judgeAnswer(prompt, "wolverhampton")).toMatchObject({ status: "valid", canonical: "Wolverhampton", rarity: 3, source: "llm" });
    expect(await judgeAnswer(prompt, "Wolverhampton")).toMatchObject({ status: "valid", rarity: 3, source: "cache" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
