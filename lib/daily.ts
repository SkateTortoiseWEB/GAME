import { CATEGORIES, NICHE_PROMPTS, type PromptDef } from "@/data/prompts";
import { EXTRA_GENRES, genreById } from "./genres";
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

function pickFrom(date: string, genreId: string, categoryIds: string[], nicheIds: string[], salt: number): PromptDef {
  const rand = mulberry32(hash(`${date}:${genreId}:${salt}`));
  const categories = CATEGORIES.filter((c) => categoryIds.includes(c.id));
  const niche = NICHE_PROMPTS.filter((p) => nicheIds.includes(p.id));
  const useNiche = categories.length === 0 || (niche.length > 0 && rand() < 0.7);
  if (useNiche) return niche[Math.floor(rand() * niche.length)];
  const cat = categories[Math.floor(rand() * categories.length)];
  const letters = eligibleLetters(cat);
  return letterPrompt(cat, letters[Math.floor(rand() * letters.length)]);
}

/**
 * One prompt per genre per day, the same for everyone. Players spend minutes on it, so every candidate needs plenty of
 * valid answers. In a genre with both kinds, about seven days in ten it is a quirky prompt.
 * The main question draws from every genre's pool, and never repeats an extra's prompt of the same day.
 */
export function promptForDate(date: string, genreId: string): PromptDef {
  const genre = genreById(genreId);
  if (!genre) throw new Error(`unknown genre: ${genreId}`);
  if (!genre.main) return pickFrom(date, genreId, genre.categories, genre.niche, 0);

  const extras = EXTRA_GENRES;
  const taken = new Set(extras.map((g) => promptForDate(date, g.id).id));
  const categories = extras.flatMap((g) => g.categories);
  const niche = extras.flatMap((g) => g.niche);
  for (let salt = 0; salt < 20; salt++) {
    const p = pickFrom(date, genreId, categories, niche, salt);
    if (!taken.has(p.id)) return p;
  }
  return pickFrom(date, genreId, categories, niche, 0);
}
