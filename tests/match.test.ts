import { describe, expect, it, vi } from "vitest";
import { matchList } from "@/lib/match";
import { normalize } from "@/lib/normalize";
import { promptsForDate, PROMPTS_PER_DAY } from "@/lib/daily";
import { eligibleLetters, getPrompt, MIN_LETTER_ANSWERS } from "@/lib/prompts";
import { CATEGORIES, NICHE_PROMPTS } from "@/data/prompts";
import { judgeAnswer } from "@/lib/judge";

const africaE = getPrompt("african-countries:e")!;
const countriesC = getPrompt("countries:c")!;
const dogsL = getPrompt("dog-breeds:l")!;

describe("normalize", () => {
  it("strips case, accents, punctuation, articles", () => {
    expect(normalize("  The  Gambia ")).toBe("gambia");
    expect(normalize("Côte d'Ivoire")).toBe("cote divoire");
    expect(normalize("C#")).toBe("c#");
  });
});

describe("matchList", () => {
  it("matches exact and alias forms to the canonical name", () => {
    expect(matchList(countriesC, "cote d'ivoire")).toEqual({ canonical: "Ivory Coast", exact: true });
    expect(matchList(dogsL, "lab")).toEqual({ canonical: "Labrador Retriever", exact: true });
  });
  it("flags typos as inexact so they are suggested, not accepted", () => {
    expect(matchList(africaE, "Ethiopa")).toEqual({ canonical: "Ethiopia", exact: false });
    expect(matchList(africaE, "Egipt")).toEqual({ canonical: "Egypt", exact: false });
    expect(matchList(africaE, "Eritrea")?.exact).toBe(true);
  });
  it("gives no typo leeway to very short answers", () => {
    expect(matchList(getPrompt("greek-letters")!, "Pie")).toBeNull();
  });
  it("only accepts forms starting with the letter", () => {
    expect(matchList(countriesC, "Canada")?.exact).toBe(true);
    expect(matchList(countriesC, "Ivory Coast")).toBeNull(); // the I-name doesn't count for C
    expect(matchList(africaE, "Ghana")).toBeNull();
  });
});

describe("prompts", () => {
  it("every offered letter has enough curated answers", () => {
    for (const cat of CATEGORIES) {
      expect(eligibleLetters(cat).length, cat.id).toBeGreaterThanOrEqual(3);
      for (const l of eligibleLetters(cat)) {
        expect(getPrompt(`${cat.id}:${l}`)!.answers.length).toBeGreaterThanOrEqual(MIN_LETTER_ANSWERS);
      }
    }
  });
  it("niche prompts have unique ids and non-empty answers", () => {
    expect(new Set(NICHE_PROMPTS.map((p) => p.id)).size).toBe(NICHE_PROMPTS.length);
    for (const p of NICHE_PROMPTS) expect(p.answers.length, p.id).toBeGreaterThanOrEqual(5);
  });
  it("is deterministic per date: 3 letter prompts + 2 niche, all different", () => {
    const a = promptsForDate("2026-10-01");
    expect(a.map((p) => p.id)).toEqual(promptsForDate("2026-10-01").map((p) => p.id));
    expect(a).toHaveLength(PROMPTS_PER_DAY);
    expect(a.filter((p) => p.letter)).toHaveLength(3);
    expect(new Set(a.map((p) => p.id.split(":")[0])).size).toBe(5);
    expect(a.map((p) => p.id)).not.toEqual(promptsForDate("2026-10-02").map((p) => p.id));
  });
});

describe("judgeAnswer (hybrid)", () => {
  it("accepts exact list hits, suggests typo fixes, and never calls the LLM for them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await judgeAnswer(africaE, "egypt")).toMatchObject({ status: "valid", canonical: "Egypt" });
    expect(await judgeAnswer(africaE, "Ethiopa")).toEqual({ status: "suggest", canonical: "Ethiopia" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rejects wrong-letter answers without spending an LLM call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.LLM_API_KEY = "test";
    expect((await judgeAnswer(africaE, "Zebra")).status).toBe("invalid");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });

  it("caches LLM verdicts; LLM spelling fixes are suggested then accepted on resubmit", async () => {
    const reply = (valid: boolean, canonical: string | null) =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ valid, canonical }) } }] }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(true, "Zalak"))
      .mockResolvedValueOnce(reply(true, "Zorbaberry"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.LLM_API_KEY = "test";
    const fruitsZ = getPrompt("fruits:z")!;

    expect(await judgeAnswer(fruitsZ, "zalack")).toEqual({ status: "suggest", canonical: "Zalak" });
    expect(await judgeAnswer(fruitsZ, "Zalack")).toEqual({ status: "suggest", canonical: "Zalak" }); // cached
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await judgeAnswer(fruitsZ, "Zalak")).toMatchObject({ status: "valid", canonical: "Zalak" }); // no 2nd call
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(await judgeAnswer(fruitsZ, "zorbaberry")).toMatchObject({ status: "valid", canonical: "Zorbaberry" });
    expect(await judgeAnswer(fruitsZ, "Fruits that start with Z")).toEqual({ status: "invalid" });
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });

  it("reports error (uncached) when no LLM is configured", async () => {
    expect((await judgeAnswer(getPrompt("fruits:z")!, "zqxyw")).status).toBe("error");
  });
});
