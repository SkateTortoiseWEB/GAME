import { NextResponse } from "next/server";
import { todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "daily";
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  const entries = await store.leaderboard(scope, date, 100);
  const ranked = entries.map((e, i) => ({ rank: i + 1, handle: e.handle, total: e.total, you: e.deviceId === deviceId }));

  let you = ranked.find((e) => e.you) ?? null;
  if (!you && scope === "daily") {
    // Outside the top 100: look the rank up directly.
    const [score, rank] = await Promise.all([store.getScore(date, deviceId), store.rankOf(date, deviceId)]);
    if (score && rank) you = { rank, handle: score.handle, total: score.total, you: true };
  }
  return NextResponse.json({ scope, entries: ranked.slice(0, 50), you });
}
