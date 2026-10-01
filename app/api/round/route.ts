import { NextResponse } from "next/server";
import { GRACE_MS, PROMPTS_PER_DAY, ROUND_SECONDS, todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";

/** Starts a round's server-side timer. Idempotent: a second call returns the original clock. */
export async function POST(req: Request) {
  const { index } = await req.json().catch(() => ({}));
  const deviceId = await getDeviceId();
  if (!Number.isInteger(index) || index < 0 || index >= PROMPTS_PER_DAY) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const date = todayKey();
  const store = getStore();
  if (await store.getScore(date, deviceId)) return NextResponse.json({ error: "already played" }, { status: 409 });

  const session = await loadSession(date, deviceId);
  // Rounds must be played in order.
  if (index > 0 && session.rounds[index - 1].startedAt === null) {
    return NextResponse.json({ error: "out of order" }, { status: 409 });
  }
  const round = session.rounds[index];
  if (round.startedAt === null) {
    round.startedAt = Date.now();
    await store.saveSession(session);
  }
  const remainingMs = Math.max(0, round.startedAt + ROUND_SECONDS * 1000 - Date.now());
  return NextResponse.json({ remainingMs, graceMs: GRACE_MS, answers: round.answers });
}
