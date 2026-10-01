import { PROMPTS_PER_DAY } from "./daily";
import { getStore, type Session } from "./store";

export const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const HANDLE_RE = /^[A-Za-z0-9 _-]{2,20}$/;

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
