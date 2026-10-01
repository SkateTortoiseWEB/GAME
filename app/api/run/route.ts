import { NextResponse } from "next/server";
import { todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { finalizeIfDead } from "@/lib/run";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";

/** Starts today's run and its server-side clock. Idempotent: calling again returns the original clock. */
export async function POST() {
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  const session = await loadSession(date, deviceId);
  if (await finalizeIfDead(session)) return NextResponse.json({ error: "already played" }, { status: 409 });
  if (session.startedAt === null) {
    session.startedAt = Date.now();
    await store.saveSession(session);
  }
  return NextResponse.json({ elapsedMs: Date.now() - session.startedAt, events: session.events });
}
