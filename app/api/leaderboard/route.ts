import { NextResponse } from "next/server";
import { todayKey } from "@/lib/daily";
import { isGenre } from "@/lib/genres";
import { getDeviceId } from "@/lib/identity";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const genre = params.get("genre");
  if (!isGenre(genre)) return NextResponse.json({ error: "unknown genre" }, { status: 400 });
  const scope = params.get("scope") === "all" ? "all" : "daily";
  const deviceId = await getDeviceId();
  const date = todayKey();
  const store = getStore();
  const entries = await store.leaderboard(scope, date, genre, 100);
  // Players tied on score (and survival time, for the daily board) share a rank, matching the results screen.
  let prevRank = 0;
  const ranked = entries.map((e, i) => {
    const prev = entries[i - 1];
    const tied = prev && prev.total === e.total && (scope === "all" || prev.survivedMs === e.survivedMs);
    prevRank = tied ? prevRank : i + 1;
    return { rank: prevRank, handle: e.handle, total: e.total, you: e.deviceId === deviceId };
  });

  let you = ranked.find((e) => e.you) ?? null;
  if (!you && scope === "daily") {
    // Outside the top 100: look the rank up directly.
    const [score, rank] = await Promise.all([store.getScore(date, genre, deviceId), store.rankOf(date, genre, deviceId)]);
    if (score && rank) you = { rank, handle: score.handle, total: score.total, you: true };
  }
  return NextResponse.json({ scope, entries: ranked.slice(0, 50), you });
}
