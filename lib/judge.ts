import type { PromptDef } from "@/data/prompts";
import { withLearnedAnswers } from "./learned";
import { judgeWithLlm } from "./llm";
import { matchList } from "./match";
import { normalize } from "./normalize";
import { startsWithLetter } from "./prompts";
import { getStore } from "./store";

export type JudgeResult =
  /** Accepted. */
  | { status: "valid"; canonical: string; source: "list" | "cache" | "llm" }
  /** Probably a typo: shown to the player, who must resubmit to accept it. */
  | { status: "suggest"; canonical: string }
  | { status: "invalid" }
  | { status: "error"; reason: string };

const startsRight = (prompt: PromptDef, text: string) => !prompt.letter || startsWithLetter(text, prompt.letter);

/**
 * Hybrid check: curated list -> verdict cache -> LLM (cached, so each answer is judged once).
 * Corrections (typos fixed by fuzzy match or the LLM) are only ever suggested, never auto-accepted.
 */
export async function judgeAnswer(basePrompt: PromptDef, raw: string): Promise<JudgeResult> {
  const prompt = await withLearnedAnswers(basePrompt);
  const answer = raw.trim().slice(0, 60);
  const norm = normalize(answer);
  if (!norm || norm === normalize(prompt.text)) return { status: "invalid" };

  const fromList = matchList(prompt, answer);
  if (fromList) {
    return fromList.exact
      ? { status: "valid", canonical: fromList.canonical, source: "list" }
      : { status: "suggest", canonical: fromList.canonical };
  }

  // "Starts with X" prompts: skip the LLM entirely for answers that can't qualify.
  if (!startsRight(prompt, answer)) return { status: "invalid" };

  const store = getStore();
  const cached = await store.getVerdict(prompt.id, norm);
  if (cached) return fromVerdict(prompt, norm, cached.valid, cached.canonical, "cache");

  const res = await judgeWithLlm(prompt.text, answer);
  if (!res.ok) return { status: "error", reason: res.reason };
  const verdict = res.verdict;
  const ok = verdict.valid && !!verdict.canonical && startsRight(prompt, verdict.canonical);
  const canonical = ok ? verdict.canonical : null;
  await store.setVerdict(prompt.id, norm, { valid: ok, canonical });
  if (canonical && normalize(canonical) !== norm) {
    // So the suggested spelling is accepted on resubmit without a second LLM call.
    await store.setVerdict(prompt.id, normalize(canonical), { valid: true, canonical });
  }
  return fromVerdict(prompt, norm, ok, canonical, "llm");
}

function fromVerdict(
  prompt: PromptDef,
  norm: string,
  valid: boolean,
  canonical: string | null,
  source: "cache" | "llm"
): JudgeResult {
  if (!valid || !canonical) return { status: "invalid" };
  if (normalize(canonical) !== norm) return { status: "suggest", canonical };
  // The LLM may have approved something that is on the list under another spelling; dedupe on the list name.
  const listed = matchList(prompt, canonical);
  return { status: "valid", canonical: listed?.exact ? listed.canonical : canonical, source };
}
