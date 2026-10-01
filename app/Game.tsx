"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Today {
  date: string;
  prompts: { id: string; text: string; hint?: string }[];
  roundSeconds: number;
  submitted: boolean;
  score: { total: number; perRound: number[]; handle: string } | null;
  rounds: { started: boolean; answers: string[] }[];
}
interface Entry { rank: number; handle: string; total: number; you: boolean }
type Phase = "loading" | "intro" | "playing" | "between" | "done";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

function useDeviceId() {
  const [id, setId] = useState("");
  useEffect(() => {
    let v = localStorage.getItem("ld-device");
    if (!v) {
      v = crypto.randomUUID().replace(/-/g, "") + "ld";
      localStorage.setItem("ld-device", v);
    }
    setId(v);
  }, []);
  return id;
}

export default function Game() {
  const deviceId = useDeviceId();
  const [today, setToday] = useState<Today | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [all, setAll] = useState<string[][]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [input, setInput] = useState("");
  const [msLeft, setMsLeft] = useState(0);
  const [handle, setHandle] = useState("");
  const [result, setResult] = useState<{ total: number; perRound: number[] } | null>(null);
  const [board, setBoard] = useState<{ scope: "daily" | "all"; entries: Entry[]; you: Entry | null } | null>(null);
  const [scope, setScope] = useState<"daily" | "all">("daily");
  const endAt = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);

  const loadBoard = useCallback(async (s: "daily" | "all") => {
    if (!deviceId) return;
    const r = await fetch(`/api/leaderboard?scope=${s}&deviceId=${deviceId}`).then((x) => x.json());
    setBoard(r);
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;
    setHandle(localStorage.getItem("ld-handle") ?? "");
    fetch(`/api/today?deviceId=${deviceId}`).then((r) => r.json()).then((t: Today) => {
      setToday(t);
      if (t.submitted && t.score) {
        setResult({ total: t.score.total, perRound: t.score.perRound });
        setAll(t.rounds.map((r) => r.answers));
        setPhase("done");
      } else {
        setPhase("intro");
      }
    });
  }, [deviceId]);

  useEffect(() => { if (phase === "done") loadBoard(scope); }, [phase, scope, loadBoard]);

  const submit = useCallback(async (finalAll: string[][]) => {
    const name = (localStorage.getItem("ld-handle") ?? "").trim();
    const r = await post("/api/submit", { deviceId, handle: name });
    setAll(finalAll);
    setResult(r);
    setPhase("done");
  }, [deviceId]);

  const finishRound = useCallback(async (i: number, got: string[]) => {
    await queue.current; // let in-flight answers settle
    const next = [...all];
    next[i] = got;
    setAll(next);
    if (i + 1 >= (today?.prompts.length ?? 0)) await submit(next);
    else setPhase("between");
  }, [all, today, submit]);

  const startRound = useCallback(async (i: number) => {
    const r = await post("/api/round", { deviceId, index: i });
    if (r.error) { setMsg({ text: r.error, ok: false }); return; }
    setIndex(i);
    setAnswers(r.answers ?? []);
    setInput("");
    setMsg(null);
    endAt.current = Date.now() + r.remainingMs;
    setMsLeft(r.remainingMs);
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [deviceId]);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => {
      const left = Math.max(0, endAt.current - Date.now());
      setMsLeft(left);
      if (left === 0) { clearInterval(t); finishRound(index, answers); }
    }, 100);
    return () => clearInterval(t);
  }, [phase, index, answers, finishRound]);

  function begin() {
    const name = handle.trim();
    if (!/^[A-Za-z0-9 _-]{2,20}$/.test(name)) {
      setMsg({ text: "Pick a name: 2–20 letters, numbers, spaces, _ or -", ok: false });
      return;
    }
    localStorage.setItem("ld-handle", name);
    // Resume the last started round (its server clock keeps running); otherwise begin at round 1.
    const lastStarted = today ? today.rounds.map((r) => r.started).lastIndexOf(true) : -1;
    const target = Math.max(0, lastStarted);
    startRound(target);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || phase !== "playing") return;
    setInput("");
    queue.current = queue.current.then(async () => {
      const r = await post("/api/answer", { deviceId, index, answer: text });
      if (r.status === "valid") {
        setAnswers((a) => [...a, r.canonical]);
        setMsg({ text: `+1  ${r.canonical}`, ok: true });
      } else if (r.status === "duplicate") setMsg({ text: `Already have ${r.canonical}`, ok: false });
      else if (r.status === "late") setMsg({ text: "Too late", ok: false });
      else if (r.status === "error") setMsg({ text: "Couldn't check that one, try again", ok: false });
      else setMsg({ text: `No: ${text}`, ok: false });
    });
    inputRef.current?.focus();
  }

  if (phase === "loading" || !today) return <p>Loading…</p>;
  const prompt = today.prompts[index];

  if (phase === "intro") {
    return (
      <section>
        <p>{today.prompts.length} categories · {today.roundSeconds}s each · 1 point per valid answer · one attempt a day.</p>
        <input className="text" placeholder="Your name" value={handle} maxLength={20}
          onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && begin()} />
        <button onClick={begin}>Start today&apos;s dive</button>
        {msg && <p className="bad">{msg.text}</p>}
      </section>
    );
  }

  if (phase === "between") {
    const done = all.slice(0, index + 1).reduce((s, a) => s + (a?.length ?? 0), 0);
    return (
      <section>
        <h2>Round {index + 1} done: {all[index]?.length ?? 0}</h2>
        <p>Running total: {done}</p>
        <button onClick={() => startRound(index + 1)}>Next: round {index + 2} →</button>
      </section>
    );
  }

  if (phase === "playing") {
    const secs = Math.ceil(msLeft / 1000);
    return (
      <section>
        <div className="top"><span>Round {index + 1}/{today.prompts.length}</span><span className={secs <= 10 ? "bad" : ""}>{secs}s</span></div>
        <div className="bar"><div style={{ width: `${(msLeft / (today.roundSeconds * 1000)) * 100}%` }} /></div>
        <h2>{prompt.text}</h2>
        {prompt.hint && <p className="hint">{prompt.hint}</p>}
        <form onSubmit={send}>
          <input ref={inputRef} className="text" value={input} onChange={(e) => setInput(e.target.value)}
            autoComplete="off" autoCapitalize="off" placeholder="Type an answer, press Enter" />
        </form>
        <p className={msg?.ok ? "ok" : "bad"} aria-live="polite">{msg?.text ?? " "}</p>
        <p><b>{answers.length}</b> so far</p>
        <ul className="chips">{[...answers].reverse().map((a) => <li key={a}>{a}</li>)}</ul>
      </section>
    );
  }

  return (
    <section>
      <h2>Today: {result?.total ?? 0}</h2>
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
