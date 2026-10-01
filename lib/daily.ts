import { CATEGORIES, NICHE_PROMPTS, type PromptDef } from "@/data/prompts";
import { eligibleLetters, letterPrompt } from "./prompts";

export const PROMPTS_PER_DAY = 5;
const LETTER_PROMPTS = 3; // the other two are hand-picked niche prompts
export const START_SECONDS = 25;
export const BONUS_SECONDS = 7;

/** A round starts with 25s and every accepted answer adds 7s. */
export function roundDeadline(startedAt: number, correct: number): number {
  return startedAt + (START_SECONDS + BONUS_SECONDS * correct) * 1000;
}
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

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Same five prompts for everyone on a given UTC day: 3 "X that start with Y" + 2 niche, in mixed order. */
export function promptsForDate(date: string): PromptDef[] {
  const rand = mulberry32(hash(date));
  const letterPicks = shuffle(CATEGORIES, rand).slice(0, LETTER_PROMPTS).map((cat) => {
    const letters = eligibleLetters(cat);
    return letterPrompt(cat, letters[Math.floor(rand() * letters.length)]);
  });
  const nichePicks = shuffle(NICHE_PROMPTS, rand).slice(0, PROMPTS_PER_DAY - LETTER_PROMPTS);
  return shuffle([...letterPicks, ...nichePicks], rand);
}
