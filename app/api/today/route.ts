import { NextResponse } from "next/server";
import { promptsForDate, ROUND_SECONDS, todayKey } from "@/lib/daily";
import { DEVICE_RE, loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deviceId = new URL(req.url).searchParams.get("deviceId") ?? "";
  if (!DEVICE_RE.test(deviceId)) return NextResponse.json({ error: "bad deviceId" }, { status: 400 });

  const date = todayKey();
  const prompts = promptsForDate(date).map(({ id, text, hint }) => ({ id, text, hint }));
  const [session, score] = await Promise.all([
    loadSession(date, deviceId),
    getStore().getScore(date, deviceId),
  ]);
  return NextResponse.json({
    date,
    prompts,
    roundSeconds: ROUND_SECONDS,
    submitted: !!score,
    score: score ? { total: score.total, perRound: score.perRound, handle: score.handle } : null,
    // Rounds already started can't be replayed; the client resumes from here.
    rounds: session.rounds.map((r) => ({ started: r.startedAt !== null, answers: r.answers })),
  });
}
