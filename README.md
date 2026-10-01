# Pawmpeii

A daily word game. The app opens on **Today's Question**, the main game: one broad question a day, the same for everyone, drawn from every
genre's pool, with the leaderboard that matters and the only streak. Six optional **extras** (Animals & Nature, Places, Movies & TV, Music,
Words & Names, Everything Else) each have their own question, run and leaderboard every day, but never affect the streak.

Name as many valid answers as you can while lava rises. Each accepted answer adds a block to Cinder's tower. A wrong answer makes the lava surge
(typo suggestions and duplicates cost nothing). The lava speeds up the longer you last, so nobody survives forever. Once it catches Cinder, that
question is over for the day. Score = accepted answers, ties broken by survival time. Each question has its own daily and all-time leaderboard and
its own "you outlasted X% of players" (rank until 20 players have finished).

Genres live in `lib/genres.ts`: the main question (`general`) has no pool of its own, it picks from all the extras' pools and never repeats an
extra's prompt of the same day; each extra lists the categories (which spawn "X that start with Y" prompts) and niche prompts it draws from.
`promptForDate(date, genre)` picks deterministically. Every prompt must have hundreds of valid answers.

**One world, panels on top.** `app/App.tsx` is mounted once in the root layout and never unmounts: the night sky, tower, Cinder and lava are always
there. The menu, get-ready screen, run HUD and results (`app/Sheets.tsx`) are panels over that world, so moving between them never feels like
changing page. Out of a run Cinder stands on a short tower in the space below the open panel; in the results the lava has risen to Cinder. The URL
only says which question is open: `/` is Today's Question, `/play/<genre>` an extra.

There is no start button: opening a question shows a 3-second "get ready" countdown and then the run begins by itself
(the server clock only starts after that, so closing the tab during the countdown costs nothing). When the magma
catches you the game-over screen shows your result, your answers, the leaderboard, and a countdown to tomorrow's prompt
(midnight UTC), after which the page reloads into the new day.

The clock stops, silently, while the AI is being asked: the server records how long each AI check took (`pausedMs`,
`runTime` in `lib/run.ts`), so the magma does not rise and the countdown does not move during one. Answers found on the
list or in the cache never pause anything, and a slow or failed AI call never costs the player any magma.

The rules live in `lib/magma.ts` (start height, stone height, rise speed, acceleration, surge size). They are tuned so a
clean 21-answers-a-minute player lasts about 3 minutes. The server decides when you are caught from the recorded
answer times, so the client only draws the scene. A run you abandon still ends on schedule.

## The scene
`app/scene/` holds two canvases. `SkyCanvas` is the night sky: three depths of twinkling stars, constellations (one is a panda that only
appears if you climb high), a crescent moon and the odd shooting star, drifting slowly as the camera climbs. `LavaCanvas` is the lava:
a see-through body (blocks under the surface show through, dim and tinted), a wavy glowing surface, cooling plates with glowing cracks
(`lavaTexture.ts`), bubbles, and embers that rise off the surface and light the air. Wrong answers make it heave and spit. Both read one
shared `SceneState` ref every frame, so they never cause React re-renders, and both calm down under `prefers-reduced-motion`.

## Sound
`app/audio/sfx.ts` synthesizes every sound in the browser with the Web Audio API, so there are no audio files. Accepted answers go "bloop" and
climb a pentatonic scale as your combo grows, rare answers get bells (two for gold, an arpeggio for purple, a run up two octaves for rainbow),
wrong answers are a soft wobbly boop with a lava gurgle, there is a countdown, a heartbeat when the lava is close, and a gentle game-over
wah-wah and lullaby. Audio unlocks on the first tap or key press; the speaker button (bottom right) mutes and remembers the choice.

## The look and flow
The design is deliberately plain: flat solid surfaces, one accent colour (the orange of the lava and Cinder's scarf), a rounded system
font, no icons or emoji, and a fixed spacing scale (`--s1` to `--s6` in `app/globals.css`). Text contrast is at least 4.5:1 and borders at
least 3:1 against their backgrounds. Things to keep out when changing it: gradient text, glass or blurred cards, coloured left borders, badges
above headlines, scroll-triggered fade-ins, hover effects that fade, and em dashes in copy. The only gradients are gameplay colours (the gold,
purple and rainbow rarity blocks) and the scrim behind the timer.

The menu shows Today's Question and the extras with their status, without scrolling at normal screen sizes. After a run, the results panel lists
what is left to play. The first visit shows the full rules; later visits show a one-liner. Opening the app also builds all the answer lists in the background.

## Cinder the panda
The mascot is a sprite sheet in `design/cinder-sprite-sheet.jpg`; `scripts/slice-panda.py` cuts it into one transparent PNG per pose in
`public/panda/` (needs `pip install pillow numpy scipy`). In the run Cinder reacts: idle, then tense and worried as the lava nears, jumping on an accepted answer (cheering with star eyes for
rare ones), worried on a wrong one, curious while the AI checks and shy on a typo suggestion. The game-over screen shows love for a great run
or worry otherwise, and Cinder sleeps on the "see you tomorrow" card.

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
