import { NextResponse } from "next/server";
import { todayKey } from "@/lib/daily";
import { anonLabel, DEVICE_RE, loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";

/** Scores come from the server-recorded session, never from the client. */
export async function POST(req: Request) {
  const { deviceId } = await req.json().catch(() => ({}));
  if (!DEVICE_RE.test(deviceId ?? "")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const date = todayKey();
  const store = getStore();
  const existing = await store.getScore(date, deviceId);
  if (existing) return NextResponse.json({ total: existing.total, perRound: existing.perRound, duplicate: true });

  const session = await loadSession(date, deviceId);
  const perRound = session.rounds.map((r) => r.answers.length);
  const total = perRound.reduce((a, b) => a + b, 0);
  const saved = await store.saveScore({ date, deviceId, handle: anonLabel(deviceId), total, perRound });
  if (saved) {
    session.submitted = true;
    await store.saveSession(session);
  }
  return NextResponse.json({ total, perRound });
}
