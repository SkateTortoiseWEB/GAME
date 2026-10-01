import { NextResponse } from "next/server";
import { promptForDate, todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { finalizeIfDead, standingFor } from "@/lib/run";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { computeStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

export async function GET() {
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  const session = await loadSession(date, deviceId);
  const score = await finalizeIfDead(session); // a run the player abandoned still ends on schedule
  const dates = await store.scoreDates(deviceId);
  const { id, text, hint } = promptForDate(date);

  return NextResponse.json({
    date,
    prompt: { id, text, hint },
    streak: computeStreak(dates, date),
    started: session.startedAt !== null,
    elapsedMs: session.startedAt === null ? 0 : Date.now() - session.startedAt,
    events: session.events,
    result: score ? { total: score.total, survivedMs: score.survivedMs, standing: await standingFor(score) } : null,
  });
}
