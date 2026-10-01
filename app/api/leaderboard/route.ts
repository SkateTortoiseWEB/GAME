import { NextResponse } from "next/server";
import { todayKey } from "@/lib/daily";
import { getDeviceId } from "@/lib/identity";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deviceId = await getDeviceId();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "daily";
  const entries = await getStore().leaderboard(scope, todayKey(), 100);
  const ranked = entries.map((e, i) => ({
    rank: i + 1,
    handle: e.handle,
    total: e.total,
    you: e.deviceId === deviceId,
  }));
  return NextResponse.json({ scope, entries: ranked.slice(0, 50), you: ranked.find((e) => e.you) ?? null });
}
