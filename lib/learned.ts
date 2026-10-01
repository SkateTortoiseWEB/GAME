import type { PromptDef } from "@/data/prompts";
import { generateAnswerList } from "./llm";
import { normalize } from "./normalize";
import { startsWithLetter } from "./prompts";
import { getStore } from "./store";

/**
 * Pre-generated answers. Asking the LLM about every answer one by one costs a round trip each; instead, one
 * call per prompt builds a long list up front. Answers on it are accepted instantly, and it powers typo
 * suggestions. Anything not on it still falls back to a per-answer check.
 */

const cache = new Map<string, { answers: string[]; at: number }>();
const inFlight = new Map<string, Promise<void>>();
const RECHECK_MS = 5000; // how soon to look again for a list that didn't exist yet

export function sanitizeList(prompt: PromptDef, raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const name = item.replace(/\s+/g, " ").trim();
    const norm = normalize(name);
    if (!name || name.length > 60 || !norm || seen.has(norm)) continue;
    if (prompt.letter && !startsWithLetter(name, prompt.letter)) continue;
    seen.add(norm);
    out.push(name);
    if (out.length >= 800) break;
  }
  return out;
}

async function learnedAnswers(promptId: string): Promise<string[]> {
  const hit = cache.get(promptId);
  if (hit && (hit.answers.length > 0 || Date.now() - hit.at < RECHECK_MS)) return hit.answers;
  const answers = (await getStore().getList(promptId)) ?? [];
  cache.set(promptId, { answers, at: Date.now() });
  return answers;
}

const merged = new Map<string, PromptDef>();

/** The prompt with its pre-generated list merged into its seed answers. */
export async function withLearnedAnswers(prompt: PromptDef): Promise<PromptDef> {
  const learned = await learnedAnswers(prompt.id);
  if (learned.length === 0) return prompt;
  const key = `${prompt.id}#${learned.length}`;
  let p = merged.get(key);
  if (!p) {
    p = { ...prompt, answers: [...prompt.answers, ...learned] };
    merged.set(key, p);
  }
  return p;
}

/** Makes the prompt's answer list if it doesn't exist yet. Safe to call on every request. */
export function ensureAnswerList(prompt: PromptDef): Promise<void> {
  const running = inFlight.get(prompt.id);
  if (running) return running;
  const job = (async () => {
    if ((await learnedAnswers(prompt.id)).length > 0) return;
    const started = Date.now();
    const res = await generateAnswerList(prompt.text);
    if (!res.ok) {
      console.error(`[prewarm] ${prompt.id}: ${res.reason}`);
      return;
    }
    const answers = sanitizeList(prompt, res.answers);
    if (answers.length === 0) return;
    await getStore().setList(prompt.id, answers);
    cache.set(prompt.id, { answers, at: Date.now() });
    console.log(`[prewarm] ${prompt.id}: ${answers.length} answers in ${Date.now() - started}ms`);
  })().finally(() => inFlight.delete(prompt.id));
  inFlight.set(prompt.id, job);
  return job;
}
