import { NextResponse } from "next/server";
import { todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { anonLabel, loadSession } from "@/lib/session";
import { computeStreak } from "@/lib/streak";
import { getStore } from "@/lib/store";

/** Scores come from the server-recorded session, never from the client. */
export async function POST() {
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  const existing = await store.getScore(date, deviceId);
  if (existing) {
    const streak = computeStreak(await store.scoreDates(deviceId), date);
    return NextResponse.json({ total: existing.total, perRound: existing.perRound, streak, duplicate: true });
  }

  const session = await loadSession(date, deviceId);
  const perRound = session.rounds.map((r) => r.answers.length);
  const total = perRound.reduce((a, b) => a + b, 0);
  const saved = await store.saveScore({ date, deviceId, handle: anonLabel(deviceId), total, perRound });
  if (saved) {
    session.submitted = true;
    await store.saveSession(session);
  }
  const streak = computeStreak(await store.scoreDates(deviceId), date);
  return NextResponse.json({ total, perRound, streak });
}
