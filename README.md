# Listicle

Daily list-naming game: 5 categories a day, 30 seconds each, name as many valid members as you can.
One point per unique valid answer. Global daily and all-time rankings.

## How answers are checked (hybrid)
1. **Curated list** (`data/prompts.ts`) with aliases and typo-tolerant matching (`lib/match.ts`).
2. **Verdict cache** (`verdicts` table): an answer judged before is never judged again.
3. **LLM judge** (`lib/llm.ts`) for the rest, via any OpenAI-compatible endpoint.

Timers and scores are server-side: `/api/round` starts the clock, `/api/answer` records valid answers,
`/api/submit` scores from the recorded session, never from client-sent numbers.

## Run
```
cp .env.example .env.local   # optional: Supabase + LLM keys
npm install
npm run dev
npm test
```
Without Supabase env vars it uses an in-memory store (resets on restart). With them, run
`supabase/migrations/001_init.sql` first. Without `LLM_API_KEY`, answers off the list are reported as unverifiable.

## Not done yet
Real accounts (identity is a device id + handle), rate limiting, rare-answer bonus scoring, more prompts, answer-list promotion of cached LLM verdicts.
