import type { PromptDef } from "@/data/prompts";
import { listedRarity, withLearnedAnswers } from "./learned";
import { judgeWithLlm } from "./llm";
import { matchList } from "./match";
import { normalize } from "./normalize";
import { startsWithLetter } from "./prompts";
import { getStore } from "./store";

export type JudgeResult =
  /** Accepted. `rarity`: 0 common, 1 rare, 2 ultra rare, 3 insanely rare. */
  | { status: "valid"; canonical: string; rarity: number; source: "list" | "cache" | "llm" }
  /** Probably a typo: shown to the player, who must resubmit to accept it. */
  | { status: "suggest"; canonical: string }
  | { status: "invalid" }
  | { status: "error"; reason: string };

/** Called around the one slow step, the AI check, so the caller can stop the clock while it runs. */
export interface AiHooks {
  beforeAi?: () => Promise<void>;
  afterAi?: () => Promise<void>;
}

const startsRight = (prompt: PromptDef, text: string) => !prompt.letter || startsWithLetter(text, prompt.letter);

/**
 * Hybrid check: pre-generated/seed list -> verdict cache -> LLM (cached, so each answer is judged once).
 * Corrections (typos fixed by fuzzy match or the LLM) are only ever suggested, never auto-accepted.
 */
export async function judgeAnswer(basePrompt: PromptDef, raw: string, hooks?: AiHooks): Promise<JudgeResult> {
  const prompt = await withLearnedAnswers(basePrompt);
  const answer = raw.trim().slice(0, 60);
  const norm = normalize(answer);
  if (!norm || norm === normalize(prompt.text)) return { status: "invalid" };

  const fromList = matchList(prompt, answer);
  if (fromList) {
    return fromList.exact
      ? { status: "valid", canonical: fromList.canonical, rarity: listedRarity(prompt.id, fromList.canonical), source: "list" }
      : { status: "suggest", canonical: fromList.canonical };
  }

  // "Starts with X" prompts: skip the LLM entirely for answers that can't qualify.
  if (!startsRight(prompt, answer)) return { status: "invalid" };

  const store = getStore();
  const cached = await store.getVerdict(prompt.id, norm);
  if (cached) return fromVerdict(prompt, norm, cached.valid, cached.canonical, cached.rarity ?? 0, "cache");

  await hooks?.beforeAi?.();
  let res;
  try {
    res = await judgeWithLlm(prompt.text, answer);
  } finally {
    await hooks?.afterAi?.();
  }
  if (!res.ok) return { status: "error", reason: res.reason };
  const verdict = res.verdict;
  const ok = verdict.valid && !!verdict.canonical && startsRight(prompt, verdict.canonical);
  const canonical = ok ? verdict.canonical : null;
  const rarity = ok ? verdict.rarity : 0;
  await store.setVerdict(prompt.id, norm, { valid: ok, canonical, rarity });
  if (canonical && normalize(canonical) !== norm) {
    // So the suggested spelling is accepted on resubmit without a second LLM call.
    await store.setVerdict(prompt.id, normalize(canonical), { valid: true, canonical, rarity });
  }
  return fromVerdict(prompt, norm, ok, canonical, rarity, "llm");
}

function fromVerdict(
  prompt: PromptDef,
  norm: string,
  valid: boolean,
  canonical: string | null,
  rarity: number,
  source: "cache" | "llm"
): JudgeResult {
  if (!valid || !canonical) return { status: "invalid" };
  if (normalize(canonical) !== norm) return { status: "suggest", canonical };
  // The LLM may have approved something that is on the list under another spelling; dedupe on the list name.
  const listed = matchList(prompt, canonical);
  if (listed?.exact) return { status: "valid", canonical: listed.canonical, rarity: listedRarity(prompt.id, listed.canonical) || rarity, source };
  return { status: "valid", canonical, rarity, source };
}
