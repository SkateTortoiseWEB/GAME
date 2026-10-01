import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAnswerList, sanitizeList } from "@/lib/learned";
import { judgeAnswer } from "@/lib/judge";
import { getPrompt } from "@/lib/prompts";
import { NICHE_PROMPTS } from "@/data/prompts";

const reply = (answers: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answers }) } }] }));

describe("pre-generated answer lists", () => {
  beforeEach(() => { (globalThis as { __store?: unknown }).__store = undefined; process.env.LLM_API_KEY = "test"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.LLM_API_KEY; });

  it("sanitizes: trims, dedupes, drops junk and wrong-letter entries", () => {
    const p = getPrompt("cities:b")!;
    expect(sanitizeList(p, ["  Bruges ", "bruges", "Berlin", "Paris", "", "x".repeat(80), "Bern"])).toEqual(["Bruges", "Berlin", "Bern"]);
  });

  it("one generation call makes later answers instant and powers typo suggestions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(["Bruges", "Bilbao", "Bologna", "Bergen op Zoom", "Paris"]));
    vi.stubGlobal("fetch", fetchMock);
    const prompt = getPrompt("cities:b")!;

    await ensureAnswerList(prompt);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Accepted straight from the list: no further LLM call.
    expect(await judgeAnswer(prompt, "bruges")).toMatchObject({ status: "valid", canonical: "Bruges", source: "list" });
    expect(await judgeAnswer(prompt, "Bilbao")).toMatchObject({ status: "valid" });
    // A typo is suggested from the list, never accepted.
    expect(await judgeAnswer(prompt, "Bolonga")).toEqual({ status: "suggest", canonical: "Bologna" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Calling again doesn't regenerate.
    await ensureAnswerList(prompt);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("works for niche prompts and survives a failed generation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("down", { status: 500 }))
      .mockResolvedValueOnce(reply(["Fire truck", "Tomato"]));
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
});
