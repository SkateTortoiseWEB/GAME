import { describe, expect, it } from "vitest";
import { computeStreak } from "@/lib/streak";

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-10-01", "2026-09-30", "2026-09-29"], "2026-10-01")).toEqual({ current: 3, best: 3 });
  });
  it("stays alive if today isn't played yet but yesterday was", () => {
    expect(computeStreak(["2026-09-30", "2026-09-29"], "2026-10-01").current).toBe(2);
  });
  it("breaks after a missed day and remembers the best run", () => {
    expect(computeStreak(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-30"], "2026-10-01")).toEqual({ current: 1, best: 3 });
    expect(computeStreak(["2026-09-25"], "2026-10-01")).toEqual({ current: 0, best: 1 });
  });
  it("handles duplicates, month boundaries and empty input", () => {
    expect(computeStreak(["2026-09-30", "2026-09-30", "2026-10-01"], "2026-10-01").current).toBe(2);
    expect(computeStreak([], "2026-10-01")).toEqual({ current: 0, best: 0 });
  });
});
