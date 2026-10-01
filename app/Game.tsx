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
    await queue.current; // let in-flight answers settle
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

  // Between rounds: show the tally briefly, then roll straight into the next round.
  useEffect(() => {
    if (phase !== "between") return;
    const t = setTimeout(() => startRound(index + 1), 1500);
    return () => clearTimeout(t);
  }, [phase, index, startRound]);

  function begin() {
    // Resume the last started round (its server clock keeps running); otherwise begin at round 1.
    const lastStarted = today ? today.rounds.map((r) => r.started).lastIndexOf(true) : -1;
    startRound(Math.max(0, lastStarted));
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    // A pending suggestion is submitted in place of what was typed.
    const text = suggestion ?? input.trim();
    if (!text || phase !== "playing" || checking) return;
    setChecking(true);
    queue.current = queue.current.then(async () => {
      const r = await post("/api/answer", { index, answer: text });
      if (r.status === "valid") {
        setAnswers((a) => [...a, r.canonical]);
        endAt.current += today!.bonusSeconds * 1000; // mirrors the server clock
        setMsg({ text: `+1  ${r.canonical}`, ok: true });
        setInput("");
        setWrong(false);
        setSuggestion(null);
      } else if (r.status === "suggest") {
        // Typo fixed by the server: offer it, don't accept it.
        setSuggestion(r.canonical);
        setWrong(false);
        setMsg({ text: `Did you mean ${r.canonical}? Press Enter to accept, or keep typing`, ok: false });
      } else {
        setSuggestion(null);
        // Wrong answers stay in the box, turn red and shake so they can be edited.
        setMsg({
          text: r.status === "duplicate" ? `Already have ${r.canonical}`
            : r.status === "late" ? "Too late"
            : r.status === "error" ? (r.detail ? `Checker problem: ${r.detail}` : "Couldn't check that one, try again")
            : "Not on the list",
          ok: false,
        });
        setWrong(true);
        setShaking(true);
      }
      setChecking(false);
      inputRef.current?.focus();
    });
  }

  if (phase === "loading" || !today) return <p>Loading…</p>;
  const prompt = today.prompts[index];

  if (phase === "intro") {
    return (
      <section>
        {today.streak.current > 0 && <p className="streak">🔥 {today.streak.current}-day streak. Play today to keep it going.</p>}
        <p>{today.prompts.length} categories · {today.startSeconds}s to start, +{today.bonusSeconds}s for every correct answer · 1 point each · one attempt a day.</p>
        <button onClick={begin}>Start today&apos;s round</button>
        {msg && <p className="bad">{msg.text}</p>}
      </section>
    );
  }

  if (phase === "between") {
    const done = all.slice(0, index + 1).reduce((t, a) => t + (a?.length ?? 0), 0);
    return (
      <section>
        <h2>Round {index + 1}: {all[index]?.length ?? 0} found</h2>
        <p>Running total: {done}. Next category coming up…</p>
      </section>
    );
  }

  if (phase === "playing") {
    const secs = Math.ceil(msLeft / 1000);
    return (
      <section>
        <div className="top"><span>Round {index + 1}/{today.prompts.length}</span><span className={secs <= 10 ? "bad" : ""}>{secs}s</span></div>
        <div className="bar"><div style={{ width: `${Math.min(100, (msLeft / (today.startSeconds * 1000)) * 100)}%` }} /></div>
        <h2>{prompt.text}</h2>
        {prompt.hint && <p className="hint">{prompt.hint}</p>}
        <form onSubmit={send}>
          <input ref={inputRef} className={`text${wrong ? " wrong" : ""}${suggestion ? " suggest" : ""}${shaking ? " shake" : ""}`}
            value={input} onChange={(e) => { setInput(e.target.value); setWrong(false); setSuggestion(null); setMsg(null); }}
            onAnimationEnd={() => setShaking(false)}
            autoComplete="off" autoCapitalize="off" placeholder="Type an answer, press Enter" />
        </form>
        <p className={msg?.ok ? "ok" : suggestion ? "maybe" : "bad"} aria-live="polite">{msg?.text ?? " "}</p>
        <p><b>{answers.length}</b> so far</p>
        <ul className="chips">{[...answers].reverse().map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
    );
  }

  return (
    <section>
      <h2>Today: {result?.total ?? 0}</h2>
      {result?.streak && result.streak.current > 0 && (
        <p className="streak">🔥 {result.streak.current}-day streak{result.streak.best > result.streak.current ? ` · best ${result.streak.best}` : ""}</p>
      )}
      <p>{result?.perRound.map((n, i) => <span key={i} className="pill">R{i + 1}: {n}</span>)}</p>
      <p className="hint">Come back tomorrow for five new categories.</p>
      <div className="tabs">
        <button className={scope === "daily" ? "on" : ""} onClick={() => setScope("daily")}>Today</button>
        <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>All time</button>
      </div>
      <ol className="board">
        {board?.entries.map((e) => (
          <li key={e.rank} className={e.you ? "me" : ""}><span>{e.rank}.</span><span>{e.handle}</span><b>{e.total}</b></li>
        ))}
      </ol>
      {board?.you && board.you.rank > 50 && <p>Your rank: #{board.you.rank} ({board.you.total})</p>}
    </section>
  );
}
