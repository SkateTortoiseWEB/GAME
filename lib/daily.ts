import { PROMPTS, type PromptDef } from "@/data/prompts";

export const PROMPTS_PER_DAY = 5;
export const ROUND_SECONDS = 30;
export const GRACE_MS = 2500;

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same five prompts for everyone on a given UTC day. */
export function promptsForDate(date: string): PromptDef[] {
  const rand = mulberry32(hash(date));
  const pool = [...PROMPTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, PROMPTS_PER_DAY);
}
