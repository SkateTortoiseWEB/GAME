import { PROMPTS, type PromptDef } from "@/data/prompts";
import { levenshtein, normalize } from "./normalize";

interface Index {
  exact: Map<string, string>; // normalized form -> canonical display name
  keys: string[];
}

const indexes = new Map<string, Index>();

function indexFor(prompt: PromptDef): Index {
  let idx = indexes.get(prompt.id);
  if (idx) return idx;
  const exact = new Map<string, string>();
  for (const entry of prompt.answers) {
    const [canonical, ...aliases] = entry.split("|");
    for (const form of [canonical, ...aliases]) exact.set(normalize(form), canonical);
  }
  idx = { exact, keys: [...exact.keys()] };
  indexes.set(prompt.id, idx);
  return idx;
}

export function getPrompt(id: string): PromptDef | undefined {
  return PROMPTS.find((p) => p.id === id);
}

/** Typo budget: none for short answers, 1 edit up to 8 chars, 2 beyond. */
function budget(len: number): number {
  return len < 5 ? 0 : len <= 8 ? 1 : 2;
}

/** Returns the canonical answer if the input is on the curated list (exact or near-exact). */
export function matchList(prompt: PromptDef, input: string): string | null {
  const norm = normalize(input);
  if (!norm) return null;
  const idx = indexFor(prompt);
  const hit = idx.exact.get(norm);
  if (hit) return hit;
  const max = budget(norm.length);
  if (max === 0) return null;
  let best: { key: string; d: number } | null = null;
  for (const key of idx.keys) {
    const d = levenshtein(norm, key, max);
    if (d <= max && (!best || d < best.d)) best = { key, d };
  }
  return best ? idx.exact.get(best.key)! : null;
}
