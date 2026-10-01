"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Today {
  date: string;
  prompts: { id: string; text: string; hint?: string }[];
  startSeconds: number;
  bonusSeconds: number;
  submitted: boolean;
  streak: { current: number; best: number };
  score: { total: number; perRound: number[]; handle: string } | null;
  rounds: { started: boolean; answers: string[] }[];
}
interface Entry { rank: number; handle: string; total: number; you: boolean }
type Phase = "loading" | "intro" | "playing" | "between" | "done";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export default function Game() {
  const [today, setToday] = useState<Today | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [all, setAll] = useState<string[][]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [msLeft, setMsLeft] = useState(0);
  const [result, setResult] = useState<{ total: number; perRound: number[]; streak?: { current: number; best: number } } | null>(null);
  const [board, setBoard] = useState<{ scope: "daily" | "all"; entries: Entry[]; you: Entry | null } | null>(null);
  const [scope, setScope] = useState<"daily" | "all">("daily");
  const endAt = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);

  const loadBoard = useCallback(async (s: "daily" | "all") => {
    const r = await fetch(`/api/leaderboard?scope=${s}`).then((x) => x.json());
    setBoard(r);
  }, []);

  useEffect(() => {
    fetch("/api/today").then((r) => r.json()).then((t: Today) => {
      setToday(t);
      if (t.submitted && t.score) {
        setResult({ total: t.score.total, perRound: t.score.perRound, streak: t.streak });
        setAll(t.rounds.map((r) => r.answers));
        setPhase("done");
      } else {
        setPhase("intro");
      }
    });
  }, []);

  useEffect(() => { if (phase === "done") loadBoard(scope); }, [phase, scope, loadBoard]);

  const submit = useCallback(async (finalAll: string[][]) => {
    const r = await post("/api/submit", {});
    setAll(finalAll);
    setResult(r);
    setPhase("done");
  }, []);

  const finishRound = useCallback(async (i: number, got: string[]) => {
    await queue.current; 
    const next = [...all];
    next[i] = got;
    setAll(next);
    if (i + 1 >= (today?.prompts.length ?? 0)) await submit(next);
    else setPhase("between");
  }, [all, today, submit]);

  const startRound = useCallback(async (i: number) => {
    const r = await post("/api/round", { index: i });
    if (r.error) { setMsg({ text: r.error, ok: false }); return; }
    setIndex(i);
    setAnswers(r.answers ?? []);
    setInput("");
    setMsg(null);
    endAt.current = Date.now() + r.remainingMs;
    setMsLeft(r.remainingMs);
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => {
      const left = Math.max(0, endAt.current - Date.now());
      setMsLeft(left);
      if (left === 0) { clearInterval(t); finishRound(index, answers); }
    }, 100);
    return () => clearInterval(t);
  }, [phase, index, answers, finishRound]);

  useEffect(() => {
    if (phase !== "between") return;
    const t = setTimeout(() => startRound(index + 1), 1500);
    return () => clearTimeout(t);
  }, [phase, index, startRound]);

  function begin() {
    const lastStarted = today ? today.rounds.map((r) => r.started).lastIndexOf(true) : -1;
    startRound(Math.max(0, lastStarted));
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = suggestion ?? input.trim();
    if (!text || phase !== "playing" || checking) return;
    setChecking(true);
    queue.current = queue.current.then(async () => {
      const r = await post("/api/answer", { index, answer: text });
      if (r.status === "valid") {
        setAnswers((a) => [r.canonical, ...a]); 
        endAt.current += today!.bonusSeconds * 1000; 
        setMsg({ text: `+${today!.bonusSeconds}s • ${r.canonical}`, ok: true });
        setInput("");
        setWrong(false);
        setSuggestion(null);
      } else if (r.status === "suggest") {
        setSuggestion(r.canonical);
        setWrong(false);
        setMsg({ text: `Did you mean ${r.canonical}? Press Enter to accept, or keep typing.`, ok: false });
      } else {
        setSuggestion(null);
        setMsg({
          text: r.status === "duplicate" ? `Already found ${r.canonical}`
            : r.status === "late" ? "Time's up!"
            : r.status === "error" ? (r.detail ? `Error: ${r.detail}` : "Couldn't check, try again.")
            : "Not on the list.",
          ok: false,
        });
        setWrong(true);
        setShaking(true);
      }
      setChecking(false);
      inputRef.current?.focus();
    });
  }

  // Calculate cumulative score to drive the visual "heat" of the environment
  let currentScore = 0;
  if (phase === "playing") {
    currentScore = all.slice(0, index).reduce((t, a) => t + (a?.length ?? 0), 0) + answers.length;
  } else if (phase === "between") {
    currentScore = all.slice(0, index + 1).reduce((t, a) => t + (a?.length ?? 0), 0);
  } else if (phase === "done") {
    currentScore = result?.total ?? 0;
  }
  const heat = Math.min(100, currentScore); // Capped for predictable CSS math

  if (phase === "loading" || !today) {
    return (
      <main className="layout-centered">
        <div className="loader"></div>
      </main>
    );
  }

  const prompt = today.prompts[index];

  return (
    <main 
      className={phase === "intro" || phase === "between" ? "layout-centered" : "layout-top"} 
      style={{ "--heat": heat } as React.CSSProperties}
    >
      {/* The ambient background scales in intensity based on the --heat variable */}
      <div className="ambient-background" />

      {phase === "intro" && (
        <section className="card card-intro">
          <h1 className="title-main">Listicle</h1>
          {today.streak.current > 0 && (
            <div className="streak-badge">
              <span className="fire-icon">🔥</span> {today.streak.current}-Day Streak
            </div>
          )}
          <p className="rules-text">
            <b>{today.prompts.length} categories.</b> {today.startSeconds} seconds to start. 
            Every valid answer earns 1 point and adds {today.bonusSeconds} seconds to the clock. 
            One attempt per day.
          </p>
          <button className="btn-primary btn-large" onClick={begin}>Play Today&apos;s Game</button>
          {msg && <p className="msg-bad">{msg.text}</p>}
        </section>
      )}

      {phase === "between" && (
        <section className="card card-reactive card-center fade-in">
          <h2 className="round-tally">Round {index + 1} Complete</h2>
          <p className="round-found"><b>{all[index]?.length ?? 0}</b> words found</p>
          <div className="divider"></div>
          <p className="total-running">Total Score: <b>{currentScore}</b></p>
          <p className="hint pulse">Preparing next category...</p>
        </section>
      )}

      {phase === "playing" && (
        <section className="card card-reactive">
          <header className="play-header">
            <div className="round-indicator">Round {index + 1} / {today.prompts.length}</div>
            <div className={`timer ${Math.ceil(msLeft / 1000) <= 10 ? "timer-danger" : ""}`}>{Math.ceil(msLeft / 1000)}s</div>
          </header>
          
          <div className="progress-track">
            <div 
              className={`progress-fill ${Math.ceil(msLeft / 1000) <= 10 ? "fill-danger" : ""}`} 
              style={{ width: `${Math.min(100, (msLeft / (today.startSeconds * 1000)) * 100)}%` }} 
            />
          </div>

          <div className="prompt-area">
            <h2 className="prompt-text">{prompt.text}</h2>
            {prompt.hint && <p className="prompt-hint">{prompt.hint}</p>}
          </div>

          <form onSubmit={send} className="input-form">
            <input 
              ref={inputRef} 
              className={`input-box ${wrong ? "is-wrong" : ""} ${suggestion ? "is-suggest" : ""} ${shaking ? "is-shaking" : ""}`}
              value={input} 
              onChange={(e) => { setInput(e.target.value); setWrong(false); setSuggestion(null); setMsg(null); }}
              onAnimationEnd={() => setShaking(false)}
              autoComplete="off" 
              autoCapitalize="off" 
              placeholder="Type an answer..." 
            />
          </form>

          <div className="feedback-area" aria-live="polite">
            <span className={`msg-text ${msg?.ok ? "msg-ok" : suggestion ? "msg-suggest" : msg ? "msg-bad" : ""}`}>
              {msg?.text ?? " "}
            </span>
          </div>
          
          <div className="answers-header">
            <span className="answers-count"><b>{answers.length}</b> accepted</span>
          </div>
          
          <ul className="chips">
            {answers.map((a) => <li key={a} className="chip-item pop-in">{a}</li>)}
          </ul>
        </section>
      )}

      {phase === "done" && (
        <section className="card card-reactive">
          <header className="results-header">
            <h1 className="title-small">Final Score</h1>
            <div className="score-massive">{result?.total ?? 0}</div>
          </header>

          {result?.streak && result.streak.current > 0 && (
            <div className="streak-summary">
              <span className="fire-icon">🔥</span> {result.streak.current}-Day Streak 
              {result.streak.best > result.streak.current ? <span className="streak-best">(Best: {result.streak.best})</span> : ""}
            </div>
          )}

          <div className="round-pills">
            {result?.perRound.map((n, i) => (
              <div key={i} className="pill">
                <span className="pill-label">R{i + 1}</span>
                <span className="pill-val">{n}</span>
              </div>
            ))}
          </div>
          
          <p className="hint text-center mg-bottom">New prompts arrive tomorrow.</p>
          <div className="divider"></div>

          <div className="tabs">
            <button className={`tab-btn ${scope === "daily" ? "is-active" : ""}`} onClick={() => setScope("daily")}>Today</button>
            <button className={`tab-btn ${scope === "all" ? "is-active" : ""}`} onClick={() => setScope("all")}>All Time</button>
          </div>

          <ol className="board">
            {board?.entries.map((e) => (
              <li key={e.rank} className={`board-row ${e.you ? "is-me" : ""}`}>
                <span className="board-rank">{e.rank}</span>
                <span className="board-handle">{e.handle} {e.you && "(You)"}</span>
                <span className="board-score">{e.total}</span>
              </li>
            ))}
          </ol>
          
          {board?.you && board.you.rank > 50 && (
            <div className="rank-outlier">
              Your rank: <b>#{board.you.rank}</b> ({board.you.total} pts)
            </div>
          )}
        </section>
      )}
    </main>
  );
}