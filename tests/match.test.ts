import { describe, expect, it, vi } from "vitest";
import { matchList } from "@/lib/match";
import { normalize } from "@/lib/normalize";
import { BONUS_SECONDS, promptsForDate, PROMPTS_PER_DAY, roundDeadline, START_SECONDS } from "@/lib/daily";
import { eligibleLetters, getPrompt, startsWithLetter } from "@/lib/prompts";
import { CATEGORIES, NICHE_PROMPTS } from "@/data/prompts";
import { judgeAnswer } from "@/lib/judge";

const animalsE = getPrompt("animals:e")!;
const citiesB = getPrompt("cities:b")!;

describe("normalize / letters", () => {
  it("strips case, accents, punctuation, articles", () => {
    expect(normalize("  The  Gambia ")).toBe("gambia");
    expect(normalize("Côte d'Ivoire")).toBe("cote divoire");
    expect(normalize("C#")).toBe("c#");
  });
  it("counts a title for the letter with or without its article", () => {
    expect(startsWithLetter("The Matrix", "m")).toBe(true);
    expect(startsWithLetter("The Matrix", "t")).toBe(true);
    expect(startsWithLetter("The Matrix", "x")).toBe(false);
  });
});

describe("matchList", () => {
  it("matches exact seed answers", () => {
    expect(matchList(animalsE, "elephant")).toEqual({ canonical: "Elephant", exact: true });
  });
  it("flags typos as inexact so they are suggested, not accepted", () => {
    expect(matchList(animalsE, "Elephnat")?.exact).toBe(false);
    expect(matchList(animalsE, "Elephent")).toEqual({ canonical: "Elephant", exact: false });
  });
  it("only accepts seed forms starting with the letter", () => {
    expect(matchList(citiesB, "Berlin")?.exact).toBe(true);
    expect(matchList(citiesB, "Paris")).toBeNull();
  });
});

describe("prompts", () => {
  it("every category offers plenty of letters and unique ids", () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) expect(eligibleLetters(c).length, c.id).toBeGreaterThanOrEqual(10);
    expect(new Set(NICHE_PROMPTS.map((p) => p.id)).size).toBe(NICHE_PROMPTS.length);
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

describe("round clock", () => {
  it("starts at 25s and adds 7s per accepted answer", () => {
    expect(START_SECONDS).toBe(25);
    expect(BONUS_SECONDS).toBe(7);
    expect(roundDeadline(1000, 0)).toBe(1000 + 25000);
    expect(roundDeadline(1000, 3)).toBe(1000 + 46000);
  });
});

describe("judgeAnswer (hybrid)", () => {
  it("accepts exact seed hits, suggests typo fixes, and never calls the LLM for them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await judgeAnswer(animalsE, "eagle")).toMatchObject({ status: "valid", canonical: "Eagle" });
    expect(await judgeAnswer(animalsE, "Elephent")).toEqual({ status: "suggest", canonical: "Elephant" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rejects wrong-letter answers without spending an LLM call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.LLM_API_KEY = "test";
    expect((await judgeAnswer(animalsE, "Zebra")).status).toBe("invalid");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });

  it("sends off-seed answers to the LLM once, caches the verdict, and suggests its spelling fixes", async () => {
    const reply = (valid: boolean, canonical: string | null) =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ valid, canonical }) } }] }));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply(true, "Echidna"))
      .mockResolvedValueOnce(reply(true, "Echidna"));
    vi.stubGlobal("fetch", fetchMock);
    process.env.LLM_API_KEY = "test";

    expect(await judgeAnswer(animalsE, "echidna")).toMatchObject({ status: "valid", canonical: "Echidna" });
    expect(await judgeAnswer(animalsE, "Echidna")).toMatchObject({ status: "valid" }); // cached
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A misspelling is suggested, never auto-accepted; resubmitting the fix costs no extra call.
    expect(await judgeAnswer(animalsE, "ecidna")).toEqual({ status: "suggest", canonical: "Echidna" });
    expect(await judgeAnswer(animalsE, "ecidna")).toEqual({ status: "suggest", canonical: "Echidna" }); // cached
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await judgeAnswer(animalsE, "Echidna")).toMatchObject({ status: "valid" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });

  it("reports error (uncached) when no LLM is configured", async () => {
    expect((await judgeAnswer(getPrompt("cities:z")!, "zqxyw")).status).toBe("error");
  });
});
