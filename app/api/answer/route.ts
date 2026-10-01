import { NextResponse } from "next/server";
import { promptForDate, todayKey } from "@/lib/daily";
import { isGenre } from "@/lib/genres";
import { getDeviceId } from "@/lib/identity";
import { judgeAnswer } from "@/lib/judge";
import type { RunEvent } from "@/lib/magma";
import { normalize } from "@/lib/normalize";
import { takeAiCheck } from "@/lib/budget";
import { allow, clientIp } from "@/lib/ratelimit";
import { addPause, finalizeIfDead, runTime } from "@/lib/run";
import { loadSession } from "@/lib/session";
import { getStore, type Session } from "@/lib/store";

export async function POST(req: Request) {
  const { answer, genre } = await req.json().catch(() => ({}));
  if (typeof answer !== "string" || !isGenre(genre)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  if (answer.length > 200) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const deviceId = await getDeviceId();
  // A person types well under 60 answers a minute; this only stops scripts.
  if (!allow(`dev:${deviceId}`, 90, 60_000) || !allow(`ip:${clientIp(req)}`, 600, 60_000)) {
    return NextResponse.json({ status: "error", detail: "Slow down a little.", limited: true }, { status: 429 });
  }
  const date = todayKey();
  const store = getStore();

  const session = await loadSession(date, genre, deviceId);
  if (await finalizeIfDead(session)) return reply({ status: "dead" }, session, session.events, true);
  if (session.startedAt === null) return NextResponse.json({ error: "run not started" }, { status: 409 });

  // The answer counts at the moment it arrived, in run time (the clock excludes AI waits).
  const t = runTime(session);

  // While the AI is being asked the clock stands still: the magma doesn't rise and the player loses nothing.
  let pauseStart = 0;
  const result = await judgeAnswer(promptForDate(date, genre), answer, {
    allowAi: () => takeAiCheck(date, deviceId),
    beforeAi: async () => {
      pauseStart = Date.now();
      const s = await loadSession(date, genre, deviceId);
      s.pausedSince = pauseStart;
      await store.saveSession(s);
    },
    afterAi: async () => {
      const s = await loadSession(date, genre, deviceId);
      addPause(s, pauseStart, Date.now());
      await store.saveSession(s);
    },
  });

  const fresh = await loadSession(date, genre, deviceId);
  const answered = (a: string) => fresh.events.some((e) => e.kind === "valid" && normalize(e.answer ?? "") === normalize(a));

  if (result.status === "suggest") {
    return reply({ status: "suggest", canonical: result.canonical }, fresh, fresh.events, false); // no surge
  }
  if (result.status === "error") {
    const detail = result.reason === "busy"
      ? "The checker is busy right now."
      : process.env.NODE_ENV === "production" ? undefined : result.reason;
    return reply({ status: "error", detail }, fresh, fresh.events, false); // no surge
  }
  if (result.status === "valid" && answered(result.canonical)) {
    return reply({ status: "duplicate", canonical: result.canonical }, fresh, fresh.events, false); // no surge
  }

  const event: RunEvent = result.status === "valid"
    ? { t, kind: "valid", answer: result.canonical, rarity: result.rarity }
    : { t, kind: "wrong" };
  fresh.events = [...fresh.events, event].sort((a, b) => a.t - b.t);
  await store.saveSession(fresh);

  const dead = !!(await finalizeIfDead(fresh)); // a surge can be fatal
  return reply(
    result.status === "valid" ? { status: "valid", canonical: result.canonical, rarity: result.rarity } : { status: "invalid" },
    fresh, fresh.events, dead,
  );
}

function reply(body: Record<string, unknown>, session: Session, events: RunEvent[], dead: boolean) {
  return NextResponse.json({
    ...body,
    events,
    dead,
    elapsedMs: runTime(session),
  });
}
