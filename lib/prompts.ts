import { CATEGORIES, NICHE_PROMPTS, type Category, type PromptDef } from "@/data/prompts";
import { normalize } from "./normalize";

/** A letter needs at least this many curated answers to be offered. */
export const MIN_LETTER_ANSWERS = 4;

export function startsWithLetter(form: string, letter: string): boolean {
  return normalize(form).startsWith(letter);
}

/** Entries keep their canonical name but only the forms (name/aliases) that start with the letter. */
export function formsStartingWith(category: Category, letter: string): string[] {
  const out: string[] = [];
  for (const entry of category.answers) {
    const [canonical, ...aliases] = entry.split("|");
    const forms = [canonical, ...aliases].filter((f) => startsWithLetter(f, letter));
    if (forms.length) out.push([canonical, ...forms.filter((f) => f !== canonical)].join("|"));
  }
  return out;
}

const eligible = new Map<string, string[]>();

export function eligibleLetters(category: Category): string[] {
  let letters = eligible.get(category.id);
  if (!letters) {
    letters = "abcdefghijklmnopqrstuvwxyz".split("").filter(
      (l) => formsStartingWith(category, l).length >= MIN_LETTER_ANSWERS
    );
    eligible.set(category.id, letters);
  }
  return letters;
}

const built = new Map<string, PromptDef>();

export function letterPrompt(category: Category, letter: string): PromptDef {
  const id = `${category.id}:${letter}`;
  let p = built.get(id);
  if (!p) {
    p = {
      id,
      letter,
      text: `${category.noun} that start with ${letter.toUpperCase()}`,
      answers: formsStartingWith(category, letter),
    };
    built.set(id, p);
  }
  return p;
}

export function getPrompt(id: string): PromptDef | undefined {
  const [catId, letter] = id.split(":");
  if (letter) {
    const cat = CATEGORIES.find((c) => c.id === catId);
    return cat ? letterPrompt(cat, letter) : undefined;
  }
  return NICHE_PROMPTS.find((p) => p.id === id);
}
