import { NextResponse } from "next/server";
import { promptsForDate, ROUND_SECONDS, todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { loadSession } from "@/lib/session";
import { computeStreak } from "@/lib/streak";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const deviceId = await getDeviceId();

  const date = todayKey();
  const prompts = promptsForDate(date).map(({ id, text, hint }) => ({ id, text, hint }));
  const store = getStore();
  const [session, score, dates] = await Promise.all([
    loadSession(date, deviceId),
    store.getScore(date, deviceId),
    store.scoreDates(deviceId),
  ]);
  return NextResponse.json({
    date,
    prompts,
    roundSeconds: ROUND_SECONDS,
    streak: computeStreak(dates, date),
    submitted: !!score,
    score: score ? { total: score.total, perRound: score.perRound, handle: score.handle } : null,
    // Rounds already started can't be replayed; the client resumes from here.
    rounds: session.rounds.map((r) => ({ started: r.startedAt !== null, answers: r.answers })),
  });
}
