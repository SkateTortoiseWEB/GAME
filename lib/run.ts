import { deathTime, MIN_PLAYERS_FOR_PERCENTILE } from "./magma";
import { anonLabel } from "./session";
import { getStore, type ScoreRow, type Session } from "./store";

/** No single AI check can stop the clock for longer than this, however long it really took. */
export const MAX_PAUSE_MS = 20000;

/**
 * Run time: how long the player has actually been playing. Wall-clock time minus the time the clock was
 * stopped while the AI was being asked, so a slow AI never costs the player any magma.
 */
export function runTime(session: Session, wallNow = Date.now()): number {
  if (session.startedAt === null) return 0;
  const inFlight = session.pausedSince === null ? 0 : Math.min(MAX_PAUSE_MS, Math.max(0, wallNow - session.pausedSince));
  return Math.max(0, wallNow - session.startedAt - session.pausedMs - inFlight);
}

/** Closes an AI check: adds its duration (minus any overlap with an earlier counted pause) to the stopped time. */
export function addPause(session: Session, start: number, end: number): void {
  const from = Math.max(start, session.pauseEnd);
  session.pausedMs += Math.min(MAX_PAUSE_MS, Math.max(0, end - from));
  session.pauseEnd = Math.max(session.pauseEnd, end);
  session.pausedSince = null;
}

/**
 * If the magma has already caught the player, record their score (once) and close the run.
 * Called on every request, so closing the tab never saves a life.
 */
export async function finalizeIfDead(session: Session, now = Date.now()): Promise<ScoreRow | null> {
  const store = getStore();
  const existing = await store.getScore(session.date, session.genre, session.deviceId);
  if (existing) return existing;
  if (session.startedAt === null) return null;
  const diedAt = deathTime(session.events);
  if (runTime(session, now) < diedAt) return null;

  const row: ScoreRow = {
    date: session.date,
    genre: session.genre,
    deviceId: session.deviceId,
    handle: anonLabel(session.deviceId),
    total: session.events.filter((e) => e.kind === "valid").length,
    survivedMs: Math.round(diedAt),
  };
  await store.saveScore(row);
  session.submitted = true;
  await store.saveSession(session);
  return (await store.getScore(session.date, session.genre, session.deviceId)) ?? row;
}

export interface Standing {
  rank: number | null;
  players: number;
  /** Share of today's players this run beat, 0-100. Null until enough players have finished. */
  percentile: number | null;
}

export async function standingFor(score: ScoreRow): Promise<Standing> {
  const store = getStore();
  const [stats, rank] = await Promise.all([
    store.dailyStats(score.date, score.genre, score.total),
    store.rankOf(score.date, score.genre, score.deviceId),
  ]);
  const percentile = stats.count >= MIN_PLAYERS_FOR_PERCENTILE
    ? Math.round(((stats.below + stats.equal / 2) / stats.count) * 100)
    : null;
  return { rank, players: stats.count, percentile };
}
