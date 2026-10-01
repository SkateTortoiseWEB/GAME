import { beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES, NICHE_PROMPTS } from "@/data/prompts";
import { promptForDate } from "@/lib/daily";
import { GENRES, genreById, isGenre } from "@/lib/genres";
import { finalizeIfDead } from "@/lib/run";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { computeStreak } from "@/lib/streak";

describe("genre definitions", () => {
  it("only reference prompts and categories that exist, and use each at most once", () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    const niche = new Set(NICHE_PROMPTS.map((p) => p.id));
    const seen = new Set<string>();
    for (const g of GENRES) {
      expect(g.categories.length + g.niche.length, g.id).toBeGreaterThan(3);
      for (const c of g.categories) { expect(cats.has(c), `${g.id}:${c}`).toBe(true); expect(seen.has(c), c).toBe(false); seen.add(c); }
      for (const n of g.niche) { expect(niche.has(n), `${g.id}:${n}`).toBe(true); expect(seen.has(n), n).toBe(false); seen.add(n); }
    }
  });

  it("every category and niche prompt belongs to a genre, so none is wasted", () => {
    const used = new Set(GENRES.flatMap((g) => [...g.categories, ...g.niche]));
    for (const c of CATEGORIES) expect(used.has(c.id), c.id).toBe(true);
    for (const p of NICHE_PROMPTS) expect(used.has(p.id), p.id).toBe(true);
  });

  it("validates genre ids", () => {
    expect(isGenre("music")).toBe(true);
    expect(isGenre("games")).toBe(false);
    expect(isGenre("food")).toBe(false);
    expect(isGenre("nope")).toBe(false);
    expect(isGenre(undefined)).toBe(false);
    expect(genreById("places")?.name).toBe("Places");
  });
});

describe("one prompt per genre per day", () => {
  it("is stable, comes from the genre's own pool, and differs between genres", () => {
    const date = "2026-10-01";
    const ids = GENRES.map((g) => promptForDate(date, g.id).id);
    expect(GENRES.map((g) => promptForDate(date, g.id).id)).toEqual(ids);
    expect(new Set(ids).size).toBe(GENRES.length);
    for (const g of GENRES) {
      const p = promptForDate(date, g.id);
      const base = p.id.split(":")[0];
      expect([...g.categories, ...g.niche], `${g.id} -> ${p.id}`).toContain(base);
    }
  });

  it("every genre gives plenty of variety over a month", () => {
    for (const g of GENRES) {
      const seen = new Set(Array.from({ length: 30 }, (_, i) => promptForDate(`2026-11-${String(i + 1).padStart(2, "0")}`, g.id).id));
      expect(seen.size, g.id).toBeGreaterThan(8);
    }
  });

  it("rejects an unknown genre", () => {
    expect(() => promptForDate("2026-10-01", "nope")).toThrow();
  });
});

describe("runs, scores and rankings are per genre", () => {
  beforeEach(() => { (globalThis as { __store?: unknown }).__store = undefined; });
  const date = "2026-10-01";
  const dev = "g".repeat(20);

  it("a player can run every genre once a day, independently", async () => {
    const store = getStore();
    const a = await loadSession(date, "nature", dev);
    const b = await loadSession(date, "music", dev);
    a.startedAt = Date.now() - 10 * 60000; // long dead
    await store.saveSession(a);
    expect(await finalizeIfDead(a)).toMatchObject({ genre: "nature" });
    expect(await store.getScore(date, "nature", dev)).not.toBeNull();
    expect(await store.getScore(date, "music", dev)).toBeNull(); // music is untouched
    expect(await finalizeIfDead(b)).toBeNull();

    const sessions = await store.sessionsOn(date, dev);
    expect(sessions.map((s) => s.genre).sort()).toEqual(["nature"]);
    expect((await store.scoresOn(date, dev)).map((s) => s.genre)).toEqual(["nature"]);
  });

  it("each genre has its own leaderboard and rank", async () => {
    const store = getStore();
    await store.saveScore({ date, genre: "nature", deviceId: "a".repeat(20), handle: "A", total: 9, survivedMs: 1000 });
    await store.saveScore({ date, genre: "nature", deviceId: "b".repeat(20), handle: "B", total: 5, survivedMs: 1000 });
    await store.saveScore({ date, genre: "food", deviceId: "b".repeat(20), handle: "B", total: 12, survivedMs: 1000 });
    expect((await store.leaderboard("daily", date, "nature", 10)).map((e) => e.handle)).toEqual(["A", "B"]);
    expect((await store.leaderboard("daily", date, "food", 10)).map((e) => e.handle)).toEqual(["B"]);
    expect(await store.rankOf(date, "nature", "b".repeat(20))).toBe(2);
    expect(await store.rankOf(date, "food", "b".repeat(20))).toBe(1);
    expect(await store.dailyStats(date, "nature", 5)).toEqual({ below: 0, equal: 1, count: 2 });
  });

  it("the streak counts a day if any genre was finished", async () => {
    const store = getStore();
    await store.saveScore({ date: "2026-09-30", genre: "nature", deviceId: dev, handle: "G", total: 1, survivedMs: 1 });
    await store.saveScore({ date, genre: "music", deviceId: dev, handle: "G", total: 1, survivedMs: 1 });
    expect(computeStreak(await store.scoreDates(dev), date).current).toBe(2);
  });
});
