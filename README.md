# Listicle

One prompt a day, the same for everyone. Name as many valid answers as you can while magma rises.
Each accepted answer adds a stone to your stack. A wrong answer makes the magma surge (typo suggestions and
duplicates cost nothing). The magma speeds up the longer you last, so nobody survives forever. Once it catches
you, your day is over. Score = accepted answers, ties broken by survival time. Daily and all-time rankings,
daily streaks, and a percentile ("you outlasted 71% of players") once 20 players have finished (rank until then).

The rules live in `lib/magma.ts` (start height, stone height, rise speed, acceleration, surge size). They are tuned so a
clean 21-answers-a-minute player lasts about 3 minutes. The server decides when you are caught from the recorded
answer times, so the client only draws the scene. A run you abandon still ends on schedule.

## How answers are checked (hybrid)
1. **Seed list** (`data/prompts.ts`): common answers with aliases, typo suggestions, and no LLM cost. It is only a fast path;
   most valid answers are expected to come from the LLM, so **`LLM_API_KEY` is required for the game to be playable**.
2. **Verdict cache** (`verdicts` table): an answer judged before is never judged again.
3. **LLM judge** (`lib/llm.ts`) for the rest, via any OpenAI-compatible endpoint.

Timing and scores are server-side: `/api/run` starts the clock, `/api/answer` records each answer at the moment it arrives
(so a slow LLM check never gets you caught), and scores come from that record, never from client-sent numbers.

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
Real accounts (identity is a server-issued cookie, so clearing cookies or private windows resets play and streak), rate limiting (a script with a big word list could currently post a huge score), real graphics (the scene is a placeholder), more prompts, tuning with playtesters, forgiving LLM outages (a checker error costs nothing but time still passes).
