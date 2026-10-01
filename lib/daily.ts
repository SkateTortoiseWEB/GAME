import { CATEGORIES, NICHE_PROMPTS, type PromptDef } from "@/data/prompts";
import { eligibleLetters, letterPrompt } from "./prompts";

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

/**
 * One prompt a day, the same for everyone. Players spend minutes on it, so every candidate must have
 * hundreds of valid answers. Two days in three it is a "starts with" prompt, the third a niche one.
 */
export function promptForDate(date: string): PromptDef {
  const rand = mulberry32(hash(date));
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  if (dayNumber % 3 === 0) return NICHE_PROMPTS[Math.floor(rand() * NICHE_PROMPTS.length)];
  const cat = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
  const letters = eligibleLetters(cat);
  return letterPrompt(cat, letters[Math.floor(rand() * letters.length)]);
}
