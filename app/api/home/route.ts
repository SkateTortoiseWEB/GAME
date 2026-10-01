import { NextResponse } from "next/server";
import { todayKey } from "@/lib/daily";
import { GENRES } from "@/lib/genres";
import { getDeviceId } from "@/lib/identity";
import { finalizeIfDead, standingFor } from "@/lib/run";
import { getStore } from "@/lib/store";
import { computeStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

/** The home screen: every genre with this player's status for today. */
export async function GET() {
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  const [sessions, scores, dates] = await Promise.all([store.sessionsOn(date, deviceId), store.scoresOn(date, deviceId), store.scoreDates(deviceId)]);

  const genres = await Promise.all(GENRES.map(async (g) => {
    let score = scores.find((s) => s.genre === g.id) ?? null;
    const session = sessions.find((s) => s.genre === g.id);
    if (!score && session?.startedAt != null) score = await finalizeIfDead(session); // a run they walked away from still ends on schedule
    const base = { id: g.id, name: g.name, emoji: g.emoji, blurb: g.blurb };
    if (score) {
      const standing = await standingFor(score);
      return { ...base, status: "done" as const, total: score.total, rank: standing.rank, players: standing.players };
    }
    return { ...base, status: session?.startedAt != null ? ("playing" as const) : ("new" as const) };
  }));

  // Finishing a run today in any genre keeps the streak alive.
  const finishedToday = genres.some((g) => g.status === "done");
  const streak = computeStreak(finishedToday && !dates.includes(date) ? [...dates, date] : dates, date);
  return NextResponse.json({ date, streak, genres });
}
