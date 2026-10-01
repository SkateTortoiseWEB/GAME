/**
 * The rules of the run. Pure functions, shared by the server (which decides when you are caught)
 * and the client (which only draws it). Tune the numbers here.
 *
 * You stand on a stack of stones, one per accepted answer. Magma rises at a speed that grows with
 * elapsed time, so nobody can survive forever. A wrong answer makes the magma jump (a surge).
 */
export const MAGMA = {
  /** Starting height of your stack, in stones' worth of height. */
  base: 8,
  /** Height each accepted answer adds. */
  stone: 1,
  /** Magma rise speed at t=0, height units per second. */
  v0: 0.1,
  /** How much faster the magma rises each second (units/s per second). */
  accel: 0.0031,
  /** Instant jump in magma level for a wrong answer. */
  surge: 1,
};

export interface RunEvent {
  /** Milliseconds since the run started, measured when the server received the answer. */
  t: number;
  kind: "valid" | "wrong";
  /** Canonical answer, for valid events. */
  answer?: string;
  /** How niche the answer is: 0 common, 1 rare (gold), 2 ultra rare (purple), 3 insanely rare (rainbow). */
  rarity?: number;
}

/** Magma height from time alone (ignoring surges). */
export function magmaRise(tMs: number): number {
  const s = tMs / 1000;
  return MAGMA.v0 * s + (MAGMA.accel * s * s) / 2;
}

/** Time in ms at which the time-based rise alone reaches `height`. */
export function riseTime(height: number): number {
  if (height <= 0) return 0;
  const { v0, accel } = MAGMA;
  return ((-v0 + Math.sqrt(v0 * v0 + 2 * accel * height)) / accel) * 1000;
}

export interface RunState {
  /** Top of the player's stack. */
  stack: number;
  /** Current magma level, including surges. */
  level: number;
  /** stack - level; the player is caught at <= 0. */
  margin: number;
  valid: number;
  wrong: number;
}

/** The scene at time `t`, given the events up to then. */
export function stateAt(events: RunEvent[], t: number): RunState {
  let valid = 0;
  let wrong = 0;
  for (const e of events) {
    if (e.t > t) break;
    if (e.kind === "valid") valid++;
    else wrong++;
  }
  const stack = MAGMA.base + MAGMA.stone * valid;
  const level = magmaRise(t) + MAGMA.surge * wrong;
  return { stack, level, margin: stack - level, valid, wrong };
}

/**
 * When the player is caught, assuming no further events. `events` must be sorted by time.
 * Valid answers push the moment later; wrong answers pull it earlier, possibly to the instant of the answer.
 */
export function deathTime(events: RunEvent[]): number {
  let c = MAGMA.base; // stack minus accumulated surges
  for (const e of events) {
    const d = riseTime(c);
    if (d <= e.t) return d; // caught before this answer arrived
    c += e.kind === "valid" ? MAGMA.stone : -MAGMA.surge;
    if (riseTime(c) <= e.t) return e.t; // the surge itself was fatal
  }
  return riseTime(c);
}

export const MIN_PLAYERS_FOR_PERCENTILE = 20;
