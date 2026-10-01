import { deathTime, MIN_PLAYERS_FOR_PERCENTILE } from "./magma";
import { anonLabel } from "./session";
import { getStore, type ScoreRow, type Session } from "./store";

/**
 * If the magma has already caught the player, record their score (once) and close the run.
 * Called on every request, so closing the tab never saves a life.
 */
export async function finalizeIfDead(session: Session, now = Date.now()): Promise<ScoreRow | null> {
  const store = getStore();
  const existing = await store.getScore(session.date, session.deviceId);
  if (existing) return existing;
  if (session.startedAt === null) return null;
  const diedAt = deathTime(session.events);
  if (session.startedAt + diedAt > now) return null;

  const row: ScoreRow = {
    date: session.date,
    deviceId: session.deviceId,
    handle: anonLabel(session.deviceId),
    total: session.events.filter((e) => e.kind === "valid").length,
    survivedMs: Math.round(diedAt),
  };
  await store.saveScore(row);
  session.submitted = true;
  await store.saveSession(session);
  return (await store.getScore(session.date, session.deviceId)) ?? row;
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
    store.dailyStats(score.date, score.total),
    store.rankOf(score.date, score.deviceId),
  ]);
  const percentile = stats.count >= MIN_PLAYERS_FOR_PERCENTILE
    ? Math.round(((stats.below + stats.equal / 2) / stats.count) * 100)
    : null;
  return { rank, players: stats.count, percentile };
}
