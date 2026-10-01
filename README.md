# Listicle

Daily list-naming game: 5 broad categories a day (3 "X that start with Y" + 2 niche). Each round starts at 25s and
every accepted answer adds 7s. Every category has hundreds of valid answers. One point per unique valid answer. Global daily and all-time rankings.

## How answers are checked (hybrid)
1. **Seed list** (`data/prompts.ts`): common answers with aliases, typo suggestions, and no LLM cost. It is only a fast path;
   most valid answers are expected to come from the LLM, so **`LLM_API_KEY` is required for the game to be playable**.
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
Real accounts (identity is a server-issued cookie, so clearing cookies or private windows resets play and streak), rate limiting, rare-answer bonus scoring, more prompts, answer-list promotion of cached LLM verdicts.
