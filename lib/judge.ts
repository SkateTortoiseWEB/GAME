import type { PromptDef } from "@/data/prompts";
import { judgeWithLlm } from "./llm";
import { matchList } from "./match";
import { normalize } from "./normalize";
import { getStore } from "./store";

export type JudgeResult =
  | { status: "valid"; canonical: string; source: "list" | "cache" | "llm" }
  | { status: "invalid" }
  | { status: "error" };

/** Hybrid check: curated list -> verdict cache -> LLM (cached, so each answer is judged once). */
export async function judgeAnswer(prompt: PromptDef, raw: string): Promise<JudgeResult> {
  const answer = raw.trim().slice(0, 60);
  const norm = normalize(answer);
  if (!norm || norm === normalize(prompt.text)) return { status: "invalid" };

  const fromList = matchList(prompt, answer);
  if (fromList) return { status: "valid", canonical: fromList, source: "list" };

  const store = getStore();
  const cached = await store.getVerdict(prompt.id, norm);
  if (cached) {
    return cached.valid && cached.canonical
      ? { status: "valid", canonical: cached.canonical, source: "cache" }
      : { status: "invalid" };
  }

  const verdict = await judgeWithLlm(prompt.text, answer);
  if (!verdict) return { status: "error" };
  await store.setVerdict(prompt.id, norm, verdict);
  if (!verdict.valid || !verdict.canonical) return { status: "invalid" };

  // The LLM may have corrected spelling or mapped to a listed answer; re-check so it dedupes.
  const relisted = matchList(prompt, verdict.canonical);
  return { status: "valid", canonical: relisted ?? verdict.canonical, source: "llm" };
}
