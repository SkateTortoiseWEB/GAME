import type { PromptDef } from "@/data/prompts";
import { generateAnswerList, type ListEntry } from "./llm";
import { normalize } from "./normalize";
import { startsWithLetter } from "./prompts";
import { getStore } from "./store";

/**
 * Pre-generated answers. Asking the LLM about every answer one by one costs a round trip each; instead, one
 * call per prompt builds a long list up front, already graded for rarity. Answers on it are accepted instantly,
 * it powers typo suggestions, and it supplies the block colour. Anything not on it falls back to a per-answer check.
 */

interface Learned {
  entries: ListEntry[];
  rarity: Map<string, number>; // normalized name -> rarity
  at: number;
}

const cache = new Map<string, Learned>();
const inFlight = new Map<string, Promise<void>>();
const RECHECK_MS = 5000; // how soon to look again for a list that didn't exist yet

export function sanitizeList(prompt: PromptDef, raw: (ListEntry | string)[]): ListEntry[] {
  const seen = new Set<string>();
  const out: ListEntry[] = [];
  for (const item of raw) {
    const e = typeof item === "string" ? { name: item, rarity: 0 } : item; // older saved lists were plain strings
    const name = e.name.replace(/\s+/g, " ").trim();
    const norm = normalize(name);
    if (!name || name.length > 60 || !norm || seen.has(norm)) continue;
    if (prompt.letter && !startsWithLetter(name, prompt.letter)) continue;
    seen.add(norm); // a name listed in two tiers keeps the first (lowest) one
    out.push({ name, rarity: Math.min(3, Math.max(0, Math.round(e.rarity) || 0)) });
    if (out.length >= 800) break;
  }
  return out;
}

function remember(promptId: string, entries: ListEntry[]): Learned {
  const learned: Learned = {
    entries,
    rarity: new Map(entries.map((e) => [normalize(e.name), e.rarity])),
    at: Date.now(),
  };
  cache.set(promptId, learned);
  return learned;
}

async function learnedFor(prompt: PromptDef): Promise<Learned> {
  const hit = cache.get(prompt.id);
  if (hit && (hit.entries.length > 0 || Date.now() - hit.at < RECHECK_MS)) return hit;
  const stored = await getStore().getList(prompt.id);
  return remember(prompt.id, stored ? sanitizeList(prompt, stored) : []);
}

const merged = new Map<string, PromptDef>();

/** The prompt with its pre-generated list merged into its seed answers. */
export async function withLearnedAnswers(prompt: PromptDef): Promise<PromptDef> {
  const learned = await learnedFor(prompt);
  if (learned.entries.length === 0) return prompt;
  const key = `${prompt.id}#${learned.entries.length}`;
  let p = merged.get(key);
  if (!p) {
    p = { ...prompt, answers: [...prompt.answers, ...learned.entries.map((e) => e.name)] };
    merged.set(key, p);
  }
  return p;
}

/** Rarity of an answer on the prompt's pre-generated list; 0 if it isn't there (e.g. seed answers). */
export function listedRarity(promptId: string, canonical: string): number {
  return cache.get(promptId)?.rarity.get(normalize(canonical)) ?? 0;
}

/** Makes the prompt's answer list if it doesn't exist yet. Safe to call on every request. */
export function ensureAnswerList(prompt: PromptDef): Promise<void> {
  const running = inFlight.get(prompt.id);
  if (running) return running;
  const job = (async () => {
    if ((await learnedFor(prompt)).entries.length > 0) return;
    const started = Date.now();
    const res = await generateAnswerList(prompt.text);
    if (!res.ok) {
      console.error(`[prewarm] ${prompt.id}: ${res.reason}`);
      return;
    }
    const entries = sanitizeList(prompt, res.entries);
    if (entries.length === 0) return;
    await getStore().setList(prompt.id, entries);
    remember(prompt.id, entries);
    const counts = [0, 1, 2, 3].map((r) => entries.filter((e) => e.rarity === r).length).join("/");
    console.log(`[prewarm] ${prompt.id}: ${entries.length} answers (common/rare/ultra/insane ${counts}) in ${Date.now() - started}ms`);
  })().finally(() => inFlight.delete(prompt.id));
  inFlight.set(prompt.id, job);
  return job;
}
