"use client";

import Link from "next/link";
import { memo } from "react";
import { sfx } from "./audio/sfx";
import SoundToggle from "./audio/SoundToggle";
import { hms, msUntilTomorrow } from "./time";
import { hrefFor, type Entry, type HomeData, type HomeGenre, type Result, type Today } from "./types";

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

function statusText(g: HomeGenre) {
  if (g.status === "done") return `${g.total} ${g.total === 1 ? "answer" : "answers"}${g.rank ? ` · #${g.rank} of ${g.players}` : ""}`;
  return g.status === "playing" ? "Continue" : "Play";
}

/** The list of questions: the main one first and larger, then the optional extras in a grid. */
function QuestionList({ home, currentId, onPick }: { home: HomeData | null; currentId: string; onPick: () => void }) {
  if (!home) return <p className="hint">Loading questions...</p>;
  const [main, ...extras] = home.genres;
  const card = (g: HomeGenre, big: boolean) => (
    <Link
      key={g.id}
      href={hrefFor(g.id)}
      className={`q-card q-${g.status}${big ? " q-main" : ""}${g.id === currentId ? " q-current" : ""}`}
      onClick={() => { sfx.play("tap"); onPick(); }}
    >
      <span className="q-name">{g.name}</span>
      <span className="q-prompt">{g.prompt}</span>
      <span className="q-status">{statusText(g)}</span>
    </Link>
  );
  return (
    <>
      {card(main, true)}
      <p className="q-label">Optional extras (no streak)</p>
      <div className="q-grid">{extras.map((g) => card(g, false))}</div>
    </>
  );
}

/** Shown before a run: the question, then a short countdown, then the run starts by itself. */
export const ReadySheet = memo(function ReadySheet(props: {
  today: Today; rulesSeen: boolean | null; error: string | null; onStart: () => void; onMenu: () => void;
}) {
  const { today, rulesSeen, error, onStart, onMenu } = props;
  return (
    <section className="sheet" aria-live="polite">
      <p className="sheet-kicker">{today.genre.main ? "Today's question" : `Extra: ${today.genre.name}`}</p>
      <h1 className="sheet-question">{today.prompt.text}</h1>
      {today.prompt.hint && <p className="hint">{today.prompt.hint}</p>}
      {rulesSeen === false && (
        <p className="rules-text">
          Every answer adds a block and lifts Cinder higher. Wrong answers make the lava surge, and it rises faster the longer you last.
          When it catches Cinder, this question is done for today.
        </p>
      )}
      {today.genre.main && today.streak.current > 0 && <p className="streak">{today.streak.current} day streak. Finish today to keep it going.</p>}
      {error && <p className="msg-bad">{error}</p>}
      <button className="btn-primary" onClick={() => { sfx.play("go"); onStart(); }}>Start</button>
      <div className="sheet-actions">
        <button className="btn-secondary" onClick={() => { sfx.play("tap"); onMenu(); }}>Other questions</button>
        <SoundToggle />
      </div>
    </section>
  );
});

/** First visit only: what the game is, before anything starts. */
export const WelcomeSheet = memo(function WelcomeSheet({ onContinue }: { onContinue: () => void }) {
  return (
    <section className="sheet" aria-live="polite">
      <h1 className="sheet-question">Welcome to Pawmpeii</h1>
      <p className="rules-text">
        Each day there is a new question. Name as many answers as you can while lava rises under Cinder the panda.
        Every correct answer builds a block and buys you time. Wrong answers make the lava surge.
      </p>
      <p className="rules-text">
        You get one try per question each day. Today's Question keeps your streak, and the other sections are optional extras.
      </p>
      <button className="btn-primary" onClick={() => { sfx.play("tap"); onContinue(); }}>Continue</button>
    </section>
  );
});

/** The menu: pick the main question or an optional extra. */
export const MenuSheet = memo(function MenuSheet(props: { home: HomeData | null; currentId: string; onClose: () => void }) {
  const { home, currentId, onClose } = props;
  return (
    <section className="sheet sheet-menu">
      <h2 className="sheet-title">Choose a question</h2>
      <QuestionList home={home} currentId={currentId} onPick={onClose} />
      <div className="sheet-actions">
        <button className="btn-secondary" onClick={() => { sfx.play("tap"); onClose(); }}>Close</button>
        <SoundToggle />
      </div>
    </section>
  );
});

/** Shown after a run: the result, what to play next, tomorrow's countdown, your answers and the leaderboard. */
export const DoneSheet = memo(function DoneSheet(props: {
  today: Today; result: Result; proud: boolean; now: number; home: HomeData | null;
  answers: { name: string; rarity: number }[];
  scope: "daily" | "all"; onScope: (s: "daily" | "all") => void;
  board: { entries: Entry[]; you: Entry | null } | null;
}) {
  const { today, result, proud, now, home, answers, scope, onScope, board } = props;
  const resetLocal = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1))
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const unplayed = home?.genres.filter((g) => g.status !== "done") ?? [];
  const main = home?.genres.find((g) => g.main);

  return (
    <section className="sheet sheet-done">
      <p className="sheet-kicker">{today.genre.name}: {proud ? "great run" : "the lava caught Cinder"}</p>
      <div className="result-row">
        <span className="result-score">{result.total}</span>
        <span className="result-meta">
          <span>{result.total === 1 ? "answer" : "answers"} · survived {clock(result.survivedMs)}</span>
          <span>
            {result.standing.percentile !== null
              ? <>You outlasted <b>{result.standing.percentile}%</b> of players</>
              : <>Rank <b>#{result.standing.rank}</b> of {result.standing.players}</>}
          </span>
          {today.genre.main && today.streak.current > 0 && (
            <span className="streak">{today.streak.current} day streak{today.streak.best > today.streak.current ? `, best ${today.streak.best}` : ""}</span>
          )}
        </span>
      </div>

      {!today.genre.main && main?.status !== "done" && (
        <Link href="/" className="btn-primary" onClick={() => sfx.play("tap")}>Play today&apos;s question</Link>
      )}
      <h3 className="sheet-h">{unplayed.length ? "Keep playing" : "All questions played"}</h3>
      <QuestionList home={home} currentId={today.genre.id} onPick={() => undefined} />

      <p className="over-count">
        Next questions in <b>{hms(msUntilTomorrow(now))}</b>
        <span className="hint"> (midnight UTC, {resetLocal} your time)</span>
      </p>

      <h3 className="sheet-h">Your answers</h3>
      {answers.length > 0 ? (
        <ul className="chips">{answers.map((a, i) => <li key={`${i}-${a.name}`} className={`chip-item r${a.rarity}`}>{a.name}</li>)}</ul>
      ) : <p className="hint">No answers this time.</p>}

      <h3 className="sheet-h">Leaderboard: {today.genre.name}</h3>
      <div className="tabs">
        <button className={`tab-btn ${scope === "daily" ? "is-active" : ""}`} onClick={() => onScope("daily")}>Today</button>
        <button className={`tab-btn ${scope === "all" ? "is-active" : ""}`} onClick={() => onScope("all")}>All time</button>
      </div>
      <ol className="board">
        {board?.entries.map((e) => (
          <li key={`${e.rank}-${e.handle}`} className={`board-row ${e.you ? "is-me" : ""}`}>
            <span className="board-rank">{e.rank}</span>
            <span className="board-handle">{e.handle} {e.you && "(you)"}</span>
            <span className="board-score">{e.total}</span>
          </li>
        ))}
      </ol>
      {board?.you && board.you.rank > 50 && <div className="rank-outlier">Your rank: <b>#{board.you.rank}</b> ({board.you.total} answers)</div>}
      <div className="sheet-actions"><SoundToggle /></div>
    </section>
  );
});
