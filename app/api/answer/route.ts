import { NextResponse } from "next/server";
import { promptsForDate, GRACE_MS, PROMPTS_PER_DAY, roundDeadline, todayKey } from "@/lib/daily";
import { judgeAnswer } from "@/lib/judge";
import { normalize } from "@/lib/normalize";
import { getDeviceId } from "@/lib/identity";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  const { index, answer } = await req.json().catch(() => ({}));
  const deviceId = await getDeviceId();
  if (
    !Number.isInteger(index) || index < 0 || index >= PROMPTS_PER_DAY ||
    typeof answer !== "string"
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const date = todayKey();
  const store = getStore();
  if (await store.getScore(date, deviceId)) return NextResponse.json({ error: "already played" }, { status: 409 });

  const session = await loadSession(date, deviceId);
  const round = session.rounds[index];
  if (round.startedAt === null) return NextResponse.json({ error: "round not started" }, { status: 409 });
  if (Date.now() > roundDeadline(round.startedAt, round.answers.length) + GRACE_MS) {
    return NextResponse.json({ status: "late", count: round.answers.length });
  }

  const prompt = promptsForDate(date)[index];
  const result = await judgeAnswer(prompt, answer);
  if (result.status === "suggest") {
    return NextResponse.json({ status: "suggest", canonical: result.canonical, count: round.answers.length });
  }
  if (result.status !== "valid") return NextResponse.json({ status: result.status, count: round.answers.length });

  // Re-read in case a parallel request already added answers, then dedupe by normalized name.
  const fresh = await loadSession(date, deviceId);
  const r = fresh.rounds[index];
  if (r.answers.some((a) => normalize(a) === normalize(result.canonical))) {
    return NextResponse.json({ status: "duplicate", canonical: result.canonical, count: r.answers.length });
  }
  r.answers.push(result.canonical);
  await store.saveSession(fresh);
  return NextResponse.json({ status: "valid", canonical: result.canonical, count: r.answers.length });
}
