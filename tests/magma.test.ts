import { beforeEach, describe, expect, it } from "vitest";
import { deathTime, MAGMA, riseTime, magmaRise, stateAt, type RunEvent } from "@/lib/magma";
import { finalizeIfDead, standingFor } from "@/lib/run";
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
    const mk = (startedAt: number | null) => ({ date, deviceId: "d".repeat(20), startedAt, events: [], submitted: false });
    expect(await finalizeIfDead(mk(null))).toBeNull();
    expect(await finalizeIfDead(mk(Date.now()))).toBeNull();
  });

  it("records the score once when the magma has already won, even if the tab was closed", async () => {
    const events: RunEvent[] = [{ t: 3000, kind: "valid", answer: "a" }, { t: 6000, kind: "valid", answer: "b" }];
    const session = { date, deviceId: "p".repeat(20), startedAt: Date.now() - 10 * 60000, events, submitted: false };
    const first = await finalizeIfDead(session);
    expect(first).toMatchObject({ total: 2 });
    expect(first!.survivedMs).toBeCloseTo(deathTime(events), -1);
    const again = await finalizeIfDead(session);
    expect(again).toEqual(first);
    expect((await getStore().leaderboard("daily", date, 10))).toHaveLength(1);
  });

  it("shows rank until enough players, then a percentile", async () => {
    const store = getStore();
    for (let i = 0; i < 25; i++) {
      await store.saveScore({ date, deviceId: `player-${String(i).padStart(2, "0")}-xxxxxxxx`, handle: `P${i}`, total: i, survivedMs: 1000 * i });
    }
    const top = await standingFor({ date, deviceId: "player-24-xxxxxxxx", handle: "P24", total: 24, survivedMs: 24000 });
    expect(top.rank).toBe(1);
    expect(top.percentile).toBeGreaterThanOrEqual(95);

    (globalThis as { __store?: unknown }).__store = undefined;
    const few = getStore();
    await few.saveScore({ date, deviceId: "solo-player-xxxxxxxxxx", handle: "S", total: 5, survivedMs: 5000 });
    const lone = await standingFor({ date, deviceId: "solo-player-xxxxxxxxxx", handle: "S", total: 5, survivedMs: 5000 });
    expect(lone).toEqual({ rank: 1, players: 1, percentile: null });
  });
});

describe("streak (unchanged)", () => {
  it("still counts consecutive days", () => {
    expect(computeStreak(["2026-10-01", "2026-09-30"], "2026-10-01").current).toBe(2);
  });
});
