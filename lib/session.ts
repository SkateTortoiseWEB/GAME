import { PROMPTS_PER_DAY } from "./daily";
import { getStore, type Session } from "./store";

export const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Anonymous label for the leaderboard, derived from the device id (no names are collected). */
export function anonLabel(deviceId: string): string {
  let h = 5381;
  for (let i = 0; i < deviceId.length; i++) h = ((h << 5) + h + deviceId.charCodeAt(i)) >>> 0;
  return `Player ${h.toString(36).toUpperCase().padStart(4, "0").slice(-4)}`;
}

export async function loadSession(date: string, deviceId: string): Promise<Session> {
  const existing = await getStore().getSession(date, deviceId);
  if (existing) return existing;
  return {
    date,
    deviceId,
    submitted: false,
    rounds: Array.from({ length: PROMPTS_PER_DAY }, () => ({ startedAt: null, answers: [] })),
  };
}
