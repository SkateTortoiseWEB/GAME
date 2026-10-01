import { describe, expect, it, vi } from "vitest";
import { getPrompt, matchList } from "@/lib/match";
import { normalize } from "@/lib/normalize";
import { promptsForDate } from "@/lib/daily";
import { judgeAnswer } from "@/lib/judge";

const africa = getPrompt("african-countries")!;
const dogs = getPrompt("dog-breeds")!;

describe("normalize", () => {
  it("strips case, accents, punctuation, articles", () => {
    expect(normalize("  The  Gambia ")).toBe("gambia");
    expect(normalize("Côte d'Ivoire")).toBe("cote divoire");
    expect(normalize("C#")).toBe("c#");
  });
});

describe("matchList", () => {
  it("matches exact and alias forms to the canonical name", () => {
    expect(matchList(africa, "ivory coast")).toBe("Ivory Coast");
    expect(matchList(africa, "Cote d'Ivoire")).toBe("Ivory Coast");
    expect(matchList(dogs, "lab")).toBe("Labrador Retriever");
  });
  it("tolerates small typos on longer words only", () => {
    expect(matchList(africa, "Ethiopa")).toBe("Ethiopia");
    expect(matchList(africa, "Mali")).toBe("Mali");
    expect(matchList(africa, "Maly")).toBeNull(); // too short for typo budget
  });
  it("rejects non-members", () => {
    expect(matchList(africa, "France")).toBeNull();
  });
});

describe("daily selection", () => {
  it("is deterministic per date and gives 5 distinct prompts", () => {
    const a = promptsForDate("2026-10-01").map((p) => p.id);
    expect(a).toEqual(promptsForDate("2026-10-01").map((p) => p.id));
    expect(new Set(a).size).toBe(5);
    expect(a).not.toEqual(promptsForDate("2026-10-02").map((p) => p.id));
  });
});

describe("judgeAnswer (hybrid)", () => {
  it("uses the list without calling the LLM, and caches LLM verdicts once", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ valid: true, canonical: "Tamale" }) } }],
    })));
    vi.stubGlobal("fetch", fetchMock);
    process.env.LLM_API_KEY = "test";
    const fruits = getPrompt("fruits")!;

    expect((await judgeAnswer(fruits, "banana")).status).toBe("valid");
    expect(fetchMock).not.toHaveBeenCalled();

    const first = await judgeAnswer(fruits, "salak");
    const second = await judgeAnswer(fruits, "Salak");
    expect(first.status).toBe("valid");
    expect(second.status).toBe("valid");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect((await judgeAnswer(fruits, "Fruits")).status).toBe("invalid"); // category name itself
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });
  it("reports error (uncached) when no LLM is configured", async () => {
    expect((await judgeAnswer(getPrompt("fruits")!, "zzqx unknown")).status).toBe("error");
  });
});
