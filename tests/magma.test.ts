import { beforeEach, describe, expect, it, vi } from "vitest";
import { deathTime, MAGMA, riseTime, magmaRise, stateAt, type RunEvent } from "@/lib/magma";
import { addPause, finalizeIfDead, MAX_PAUSE_MS, runTime, standingFor } from "@/lib/run";
import { judgeAnswer } from "@/lib/judge";
import { getPrompt } from "@/lib/prompts";
import type { Session } from "@/lib/store";
import { getStore } from "@/lib/store";
import { computeStreak } from "@/lib/streak";

/** A steady player: `rate` answers per second, optionally every `wrongEvery`th one wrong. */
function simulate(rate: number, wrongEvery = 0): { events: RunEvent[]; diedAt: number } {
  const events: RunEvent[] = [];
  let t = 2000;
  let n = 0;
  while (t < 900000 && deathTime(events) > t) {
    n++;
    events.push(wrongEvery && n % wrongEvery === 0 ? { t, kind: "wrong" } : { t, kind: "valid", answer: `a${n}` });
    t += 1000 / rate;
  }
  return { events, diedAt: deathTime(events) };
}

describe("magma rules", () => {
  it("riseTime inverts magmaRise", () => {
    for (const ms of [1000, 30000, 120000]) expect(riseTime(magmaRise(ms))).toBeCloseTo(ms, 0);
  });

  it("an idle player is caught within the first minute", () => {
    const d = deathTime([]);
    expect(d).toBeGreaterThan(30000);
    expect(d).toBeLessThan(60000);
  });

  it("answers delay the catch, wrong answers hasten it", () => {
    const base = deathTime([]);
    expect(deathTime([{ t: 5000, kind: "valid", answer: "x" }])).toBeGreaterThan(base);
    expect(deathTime([{ t: 5000, kind: "wrong" }])).toBeLessThan(base);
  });

  it("a surge can be fatal at the instant of the wrong answer", () => {
    const late = Math.floor(deathTime([]) - 10);
    expect(deathTime([{ t: late, kind: "wrong" }])).toBe(late);
  });

  it("nobody survives forever: even an inhumanly fast, flawless player is caught", () => {
    const { diedAt } = simulate(2); // 2 answers every second, no mistakes
    expect(diedAt).toBeLessThan(25 * 60000);
  });

  it("tuning target: a strong, clean player lasts around 3 minutes", () => {
    const { diedAt } = simulate(0.35);
    expect(diedAt).toBeGreaterThan(150000);
    expect(diedAt).toBeLessThan(220000);
  });

  it("mistakes cost real time", () => {
    expect(simulate(0.35, 5).diedAt).toBeLessThan(simulate(0.35).diedAt * 0.75);
  });

  it("stateAt reports the scene", () => {
    const events: RunEvent[] = [{ t: 1000, kind: "valid", answer: "a" }, { t: 2000, kind: "wrong" }];
    expect(stateAt(events, 500)).toMatchObject({ valid: 0, wrong: 0, stack: MAGMA.base });
    const s = stateAt(events, 3000);
    expect(s).toMatchObject({ valid: 1, wrong: 1, stack: MAGMA.base + MAGMA.stone });
    expect(s.level).toBeCloseTo(magmaRise(3000) + MAGMA.surge);
  });
});

describe("finalizing a run (in-memory store)", () => {
  const date = "2026-10-01";
  beforeEach(() => { (globalThis as { __store?: unknown }).__store = undefined; });

  it("does nothing while the player is alive or hasn't started", async () => {
    const mk = (startedAt: number | null): Session => ({ date, genre: "nature", deviceId: "d".repeat(20), startedAt, pausedMs: 0, pausedSince: null, pauseEnd: 0, events: [], submitted: false });
    expect(await finalizeIfDead(mk(null))).toBeNull();
    expect(await finalizeIfDead(mk(Date.now()))).toBeNull();
  });

  it("records the score once when the magma has already won, even if the tab was closed", async () => {
    const events: RunEvent[] = [{ t: 3000, kind: "valid", answer: "a" }, { t: 6000, kind: "valid", answer: "b" }];
    const session: Session = { date, genre: "nature", deviceId: "p".repeat(20), startedAt: Date.now() - 10 * 60000, pausedMs: 0, pausedSince: null, pauseEnd: 0, events, submitted: false };
    const first = await finalizeIfDead(session);
    expect(first).toMatchObject({ total: 2 });
    expect(first!.survivedMs).toBeCloseTo(deathTime(events), -1);
    const again = await finalizeIfDead(session);
    expect(again).toEqual(first);
    expect((await getStore().leaderboard("daily", date, "nature", 10))).toHaveLength(1);
  });

  it("shows rank until enough players, then a percentile", async () => {
    const store = getStore();
    for (let i = 0; i < 25; i++) {
      await store.saveScore({ date, genre: "nature", deviceId: `player-${String(i).padStart(2, "0")}-xxxxxxxx`, handle: `P${i}`, total: i, survivedMs: 1000 * i });
    }
    const top = await standingFor({ date, genre: "nature", deviceId: "player-24-xxxxxxxx", handle: "P24", total: 24, survivedMs: 24000 });
    expect(top.rank).toBe(1);
    expect(top.percentile).toBeGreaterThanOrEqual(95);

    (globalThis as { __store?: unknown }).__store = undefined;
    const few = getStore();
    await few.saveScore({ date, genre: "nature", deviceId: "solo-player-xxxxxxxxxx", handle: "S", total: 5, survivedMs: 5000 });
    const lone = await standingFor({ date, genre: "nature", deviceId: "solo-player-xxxxxxxxxx", handle: "S", total: 5, survivedMs: 5000 });
    expect(lone).toEqual({ rank: 1, players: 1, percentile: null });
  });
});

describe("streak (unchanged)", () => {
  it("still counts consecutive days", () => {
    expect(computeStreak(["2026-10-01", "2026-09-30"], "2026-10-01").current).toBe(2);
  });
});

describe("the clock stops while the AI is being asked", () => {
  const base = (over: Partial<Session> = {}): Session => ({
    date: "2026-10-01", genre: "nature", deviceId: "c".repeat(20), startedAt: 1_000_000, pausedMs: 0, pausedSince: null, pauseEnd: 0, events: [], submitted: false, ...over,
  });

  it("run time is wall time minus the time spent waiting on the AI", () => {
    expect(runTime(base(), 1_030_000)).toBe(30_000);
    expect(runTime(base({ pausedMs: 4_000 }), 1_030_000)).toBe(26_000);
  });

  it("an AI check still in flight already holds the clock", () => {
    const s = base({ pausedSince: 1_020_000 });
    expect(runTime(s, 1_020_000)).toBe(20_000);
    expect(runTime(s, 1_025_000)).toBe(20_000); // 5s later, still frozen
  });

  it("a stuck check cannot freeze the clock forever", () => {
    const s = base({ pausedSince: 1_010_000 });
    expect(runTime(s, 1_010_000 + 120_000)).toBe(10_000 + 120_000 - MAX_PAUSE_MS);
  });

  it("addPause counts each check once, even when checks overlap", () => {
    const s = base({ pausedSince: 1_000_000 });
    addPause(s, 1_000_000, 1_003_000); // 3s
    expect(s).toMatchObject({ pausedMs: 3000, pausedSince: null, pauseEnd: 1_003_000 });
    addPause(s, 1_001_000, 1_004_000); // overlaps the first by 2s, so only 1s is new
    expect(s.pausedMs).toBe(4000);
    addPause(s, 1_000_500, 1_002_000); // entirely inside what is already counted
    expect(s.pausedMs).toBe(4000);
    addPause(s, 1_010_000, 1_090_000); // an absurdly long one is capped
    expect(s.pausedMs).toBe(4000 + MAX_PAUSE_MS);
  });

  it("a player is not caught while their time went on waiting for the AI", async () => {
    (globalThis as { __store?: unknown }).__store = undefined;
    const idle = Math.floor(deathTime([]));
    const now = 5_000_000;
    // 60s of wall time with no answers would be fatal (~46s), but 30s of it was spent waiting on the AI.
    const s = base({ startedAt: now - idle - 15_000, pausedMs: 30_000 });
    expect(await finalizeIfDead(s, now)).toBeNull();
    const dead = base({ startedAt: now - idle - 15_000, pausedMs: 0 });
    expect(await finalizeIfDead(dead, now)).not.toBeNull();
  });

  it("the judge only stops the clock when it really asks the AI", async () => {
    (globalThis as { __store?: unknown }).__store = undefined;
    process.env.LLM_API_KEY = "test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ valid: true, canonical: "Echidna", rarity: 0 }) } }] })));
    vi.stubGlobal("fetch", fetchMock);
    const hooks = { beforeAi: vi.fn(async () => {}), afterAi: vi.fn(async () => {}) };
    const animals = getPrompt("animals:e")!;

    await judgeAnswer(animals, "eagle", hooks); // on the seed list
    expect(hooks.beforeAi).not.toHaveBeenCalled();

    await judgeAnswer(animals, "echidna", hooks); // off the list: goes to the AI
    expect(hooks.beforeAi).toHaveBeenCalledTimes(1);
    expect(hooks.afterAi).toHaveBeenCalledTimes(1);

    await judgeAnswer(animals, "Echidna", hooks); // now cached: no AI, no pause
    expect(hooks.beforeAi).toHaveBeenCalledTimes(1);

    // Even a failed check releases the clock.
    fetchMock.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await judgeAnswer(animals, "emu-ish", hooks);
    expect(hooks.beforeAi).toHaveBeenCalledTimes(2);
    expect(hooks.afterAi).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
    delete process.env.LLM_API_KEY;
  });
});
