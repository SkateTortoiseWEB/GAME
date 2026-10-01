import { after, NextResponse } from "next/server";
import { promptForDate, todayKey } from "@/lib/daily";
import { isGenre } from "@/lib/genres";
import { getDeviceId } from "@/lib/identity";
import { ensureAnswerList } from "@/lib/learned";
import { finalizeIfDead, runTime } from "@/lib/run";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";

/** Starts today's run and its server-side clock. Idempotent: calling again returns the original clock. */
export async function POST(req: Request) {
  const { genre } = await req.json().catch(() => ({}));
  if (!isGenre(genre)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  after(() => ensureAnswerList(promptForDate(date, genre)));
  const session = await loadSession(date, genre, deviceId);
  if (await finalizeIfDead(session)) return NextResponse.json({ error: "already played" }, { status: 409 });
  if (session.startedAt === null) {
    session.startedAt = Date.now();
    await store.saveSession(session);
  }
  return NextResponse.json({ elapsedMs: runTime(session), events: session.events });
}
