import { NextResponse } from "next/server";
import { promptForDate, todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { judgeAnswer } from "@/lib/judge";
import type { RunEvent } from "@/lib/magma";
import { normalize } from "@/lib/normalize";
import { finalizeIfDead } from "@/lib/run";
import { loadSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  const { answer } = await req.json().catch(() => ({}));
  if (typeof answer !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });

  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();

  const session = await loadSession(date, deviceId);
  if (await finalizeIfDead(session)) return reply({ status: "dead" }, session.startedAt, session.events, true);
  if (session.startedAt === null) return NextResponse.json({ error: "run not started" }, { status: 409 });

  // The answer counts at the moment it arrived, so a slow check can never get the player caught.
  const t = Date.now() - session.startedAt;
  const result = await judgeAnswer(promptForDate(date), answer);

  const fresh = await loadSession(date, deviceId);
  const startedAt = fresh.startedAt!;
  const answered = (a: string) => fresh.events.some((e) => e.kind === "valid" && normalize(e.answer ?? "") === normalize(a));

  if (result.status === "suggest") {
    return reply({ status: "suggest", canonical: result.canonical }, startedAt, fresh.events, false); // no surge
  }
  if (result.status === "error") {
    const detail = process.env.NODE_ENV === "production" ? undefined : result.reason;
    return reply({ status: "error", detail }, startedAt, fresh.events, false); // no surge
  }
  if (result.status === "valid" && answered(result.canonical)) {
    return reply({ status: "duplicate", canonical: result.canonical }, startedAt, fresh.events, false); // no surge
  }

  const event: RunEvent = result.status === "valid"
    ? { t, kind: "valid", answer: result.canonical }
    : { t, kind: "wrong" };
  fresh.events = [...fresh.events, event].sort((a, b) => a.t - b.t);
  await store.saveSession(fresh);

  const dead = !!(await finalizeIfDead(fresh)); // a surge can be fatal
  return reply(
    result.status === "valid" ? { status: "valid", canonical: result.canonical } : { status: "invalid" },
    startedAt, fresh.events, dead,
  );
}

function reply(body: Record<string, unknown>, startedAt: number | null, events: RunEvent[], dead: boolean) {
  return NextResponse.json({
    ...body,
    events,
    dead,
    elapsedMs: startedAt === null ? 0 : Date.now() - startedAt,
  });
}
