# Listicle

One prompt a day, the same for everyone. Name as many valid answers as you can while magma rises.
Each accepted answer adds a stone to your stack. A wrong answer makes the magma surge (typo suggestions and
duplicates cost nothing). The magma speeds up the longer you last, so nobody survives forever. Once it catches
you, your day is over. Score = accepted answers, ties broken by survival time. Daily and all-time rankings,
daily streaks, and a percentile ("you outlasted 71% of players") once 20 players have finished (rank until then).

There is no start button: opening the page shows a 3-second "get ready" countdown and then the run begins by itself
(the server clock only starts after that, so closing the tab during the countdown costs nothing). When the magma
catches you the game-over screen shows your result, your answers, the leaderboard, and a countdown to tomorrow's prompt
(midnight UTC), after which the page reloads into the new day.

The rules live in `lib/magma.ts` (start height, stone height, rise speed, acceleration, surge size). They are tuned so a
clean 21-answers-a-minute player lasts about 3 minutes. The server decides when you are caught from the recorded
answer times, so the client only draws the scene. A run you abandon still ends on schedule.

## Rarity colours
Accepted answers are graded 0-3 for how niche they are, by the same LLM calls that already happen (no extra calls):
the pre-generated list arrives sorted into common / rare / ultra / insane tiers, and a per-answer check returns a
grade too. Common answers stay plain; rare blocks turn gold, ultra rare shiny purple, insanely rare rainbow. The grade is
cosmetic: it does not change the score or the magma. The prompt that asks for grades (`RARITY_GUIDE` in `lib/llm.ts`) is
deliberately stingy (about 90% common, 7% rare, 2.5% ultra, 0.5% insane), and `capTiers` in `lib/learned.ts` enforces those limits on
every answer list however generous the AI was. Those are the knobs to turn if too many or too few blocks light up.

## How answers are checked (hybrid)
0. **Pre-generated list** (`lib/learned.ts`): the first visit of the day triggers one LLM call that builds a long list of valid
   answers for today's prompt (saved in `prompt_lists`, or `.data/lists.json` in dev, and reused whenever that prompt returns).
   Answers on it are accepted in milliseconds and it powers typo suggestions, so most answers never wait on an LLM.
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
