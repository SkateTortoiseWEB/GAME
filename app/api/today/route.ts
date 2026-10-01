import { after, NextResponse } from "next/server";
import { promptForDate, todayKey } from "@/lib/daily";
import { genreById, isGenre } from "@/lib/genres";
import { getDeviceId } from "@/lib/identity";
import { ensureAnswerList } from "@/lib/learned";
import { finalizeIfDead, runTime, standingFor } from "@/lib/run";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { computeStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const genre = new URL(req.url).searchParams.get("genre");
  if (!isGenre(genre)) return NextResponse.json({ error: "unknown genre" }, { status: 400 });
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  const session = await loadSession(date, genre, deviceId);
  const score = await finalizeIfDead(session); // a run the player abandoned still ends on schedule
  const dates = await store.scoreDates(deviceId);
  const prompt = promptForDate(date, genre);
  const { id, text, hint } = prompt;
  after(() => ensureAnswerList(prompt)); // build today's answer list in the background if it doesn't exist yet

  const { id: genreId, name, emoji } = genreById(genre)!;
  return NextResponse.json({
    date,
    genre: { id: genreId, name, emoji },
    prompt: { id, text, hint },
    streak: computeStreak(dates, date),
    started: session.startedAt !== null,
    elapsedMs: runTime(session),
    events: session.events,
    result: score ? { total: score.total, survivedMs: score.survivedMs, standing: await standingFor(score) } : null,
  });
}
