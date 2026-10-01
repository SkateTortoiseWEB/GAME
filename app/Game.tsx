"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deathTime, stateAt, type RunEvent } from "@/lib/magma";

interface Standing { rank: number | null; players: number; percentile: number | null }
interface Result { total: number; survivedMs: number; standing: Standing }
interface Today {
  date: string;
  prompt: { id: string; text: string; hint?: string };
  streak: { current: number; best: number };
  started: boolean;
  elapsedMs: number;
  events: RunEvent[];
  result: Result | null;
}
interface Entry { rank: number; handle: string; total: number; you: boolean }
type Phase = "loading" | "intro" | "playing" | "done";

const post = (url: string, body: unknown = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function Game() {
  const [today, setToday] = useState<Today | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [t, setT] = useState(0); // ms since the run started, per the server's clock
  const [result, setResult] = useState<Result | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [board, setBoard] = useState<{ entries: Entry[]; you: Entry | null } | null>(null);
  const [scope, setScope] = useState<"daily" | "all">("daily");
  const anchor = useRef(0); // Date.now() minus elapsed run time
  const eventsRef = useRef<RunEvent[]>([]);
  const finishing = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);

  const applyServerState = useCallback((evs: RunEvent[], elapsedMs: number) => {
    eventsRef.current = evs;
    setEvents(evs);
    anchor.current = Date.now() - elapsedMs;
    setT(elapsedMs);
  }, []);

  const loadToday = useCallback(async () => {
    const d: Today = await fetch("/api/today").then((r) => r.json());
    setToday(d);
    if (d.result) {
      setResult(d.result);
      setEvents(d.events);
      setPhase("done");
    } else if (d.started) {
      applyServerState(d.events, d.elapsedMs);
      setPhase("playing");
    } else {
      setPhase("intro");
    }
    return d;
  }, [applyServerState]);

  useEffect(() => { loadToday(); }, [loadToday]);

  useEffect(() => {
    if (phase !== "done") return;
    fetch(`/api/leaderboard?scope=${scope}`).then((r) => r.json()).then(setBoard);
  }, [phase, scope]);

  // Ask the server to confirm the catch; if its clock disagrees, carry on from its state.
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    await queue.current;
    const d = await loadToday();
    finishing.current = false;
    return d;
  }, [loadToday]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const now = Date.now() - anchor.current;
      setT(now);
      if (deathTime(eventsRef.current) <= now) finish();
    }, 50);
    return () => clearInterval(timer);
  }, [phase, finish]);

  async function begin() {
    const r = await post("/api/run");
    if (r.error) { setMsg({ text: r.error, ok: false }); return; }
    applyServerState(r.events, r.elapsedMs);
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = suggestion ?? input.trim();
    if (!text || phase !== "playing" || checking) return;
    setChecking(true);
    queue.current = queue.current.then(async () => {
      const r = await post("/api/answer", { answer: text });
      if (r.events) applyServerState(r.events, r.elapsedMs);
      if (r.dead || r.status === "dead") { setChecking(false); finish(); return; }
      if (r.status === "valid") {
        setMsg({ text: `+1 • ${r.canonical}`, ok: true });
        setInput("");
        setWrong(false);
        setSuggestion(null);
      } else if (r.status === "suggest") {
        // A fixed typo is only offered, never accepted, and costs nothing.
        setSuggestion(r.canonical);
        setWrong(false);
        setMsg({ text: `Did you mean ${r.canonical}? Press Enter to accept, or keep typing.`, ok: false });
      } else if (r.status === "duplicate") {
        setSuggestion(null);
        setMsg({ text: `Already found ${r.canonical}`, ok: false });
        setWrong(true);
        setShaking(true);
      } else if (r.status === "error") {
        setSuggestion(null);
        setMsg({ text: r.detail ? `Checker problem: ${r.detail}` : "Couldn't check that one, try again.", ok: false });
        setWrong(true);
        setShaking(true);
      } else {
        setSuggestion(null);
        setMsg({ text: "Not on the list. The magma surges!", ok: false });
        setWrong(true);
        setShaking(true);
      }
      setChecking(false);
      inputRef.current?.focus();
    });
  }

  if (phase === "loading" || !today) {
    return <main className="layout-centered"><div className="loader" /></main>;
  }

  const s = stateAt(events, t);
  const answers = events.filter((e) => e.kind === "valid").map((e) => e.answer ?? "").reverse();
  const heat = Math.min(100, s.valid);
  const viewMax = Math.max(24, s.stack + 6);
  const danger = s.margin <= 3;

  return (
    <main className={phase === "playing" ? "layout-top" : "layout-centered"} style={{ "--heat": heat } as React.CSSProperties}>
      <div className="ambient-background" />

      {phase === "intro" && (
        <section className="card card-intro">
          <h1 className="title-main">Listicle</h1>
          {today.streak.current > 0 && (
            <div className="streak-badge"><span className="fire-icon">🔥</span> {today.streak.current}-Day Streak</div>
          )}
          <p className="rules-text">
            <b>One prompt a day.</b> Magma is rising and it speeds up the longer you last.
            Every valid answer lifts you higher. A wrong answer makes the magma surge.
            Once it catches you, today is over.
          </p>
          <button className="btn-primary btn-large" onClick={begin}>Start today&apos;s run</button>
          {msg && <p className="msg-bad">{msg.text}</p>}
        </section>
      )}

      {phase === "playing" && (
        <section className="card card-reactive">
          <header className="play-header">
            <div className="round-indicator">Survived</div>
            <div className={`timer ${danger ? "timer-danger" : ""}`}>{clock(t)}</div>
          </header>

          {/* Placeholder scene: the magma level, the stack of stones, and the player on top. */}
          <div className={`arena ${danger ? "arena-danger" : ""}`} aria-label={`Magma level ${s.level.toFixed(1)}, your height ${s.stack}`}>
            <div className="arena-stack" style={{ height: `${(s.stack / viewMax) * 100}%` }} />
            <div className="arena-runner" style={{ bottom: `${(s.stack / viewMax) * 100}%` }} />
            <div className="arena-magma" style={{ height: `${Math.min(100, (s.level / viewMax) * 100)}%` }} />
          </div>

          <div className="prompt-area">
            <h2 className="prompt-text">{today.prompt.text}</h2>
            {today.prompt.hint && <p className="prompt-hint">{today.prompt.hint}</p>}
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
            <span className={`msg-text ${msg?.ok ? "msg-ok" : suggestion ? "msg-suggest" : msg ? "msg-bad" : ""}`}>{msg?.text ?? " "}</span>
          </div>

          <div className="answers-header"><span className="answers-count"><b>{s.valid}</b> accepted</span></div>
          <ul className="chips">
            {answers.map((a) => <li key={a} className="chip-item pop-in">{a}</li>)}
          </ul>
        </section>
      )}

      {phase === "done" && result && (
        <section className="card card-reactive">
          <header className="results-header">
            <h1 className="title-small">The magma caught you</h1>
            <div className="score-massive">{result.total}</div>
            <p className="hint text-center">answers · survived {clock(result.survivedMs)}</p>
          </header>

          {today.streak.current > 0 && (
            <div className="streak-summary">
              <span className="fire-icon">🔥</span> {today.streak.current}-Day Streak
              {today.streak.best > today.streak.current ? <span className="streak-best">(Best: {today.streak.best})</span> : ""}
            </div>
          )}

          <p className="standing text-center">
            {result.standing.percentile !== null
              ? <>You outlasted <b>{result.standing.percentile}%</b> of today&apos;s players</>
              : <>Rank <b>#{result.standing.rank}</b> of {result.standing.players} today</>}
          </p>
          <p className="hint text-center mg-bottom">A new prompt arrives tomorrow.</p>
          <div className="divider" />

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
            <div className="rank-outlier">Your rank: <b>#{board.you.rank}</b> ({board.you.total} answers)</div>
          )}
        </section>
      )}
    </main>
  );
}
