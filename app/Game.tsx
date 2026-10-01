"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deathTime, MAGMA, stateAt, type RunEvent } from "@/lib/magma";
import LavaCanvas from "./scene/LavaCanvas";
import SkyCanvas from "./scene/SkyCanvas";
import type { SceneState } from "./scene/types";

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
type Phase = "loading" | "ready" | "playing" | "done";

/** Seconds of "get ready" before the run starts by itself. The server clock only starts after it. */
const GET_READY_SECONDS = 3;

const post = (url: string, body: unknown = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

/** Pixels per unit of height in the scene. */
const UNIT = 38;
/** Where the player sits on screen, as a share of the scene height measured from the bottom. */
const PLAYER_AT = 0.5;
/** Height of the magma pool visible under the tower from the very start. */
const FLOOR = 72;

/** Milliseconds until the next UTC midnight, when tomorrow's prompt unlocks. */
const msUntilTomorrow = (now: number) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
};
const hms = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
};

/** Cinder the panda. One image per pose in public/panda (made by scripts/slice-panda.py). */
const POSES = ["idle", "happy", "celebrate", "think", "sad", "scared", "tumble", "ponder", "sulk", "nervous", "scorched", "sleep"] as const;
type Pose = (typeof POSES)[number];
const panda = (pose: Pose) => `/panda/${pose}.png`;

const RARITY_LABEL = ["", "RARE", "ULTRA RARE", "INSANELY RARE"];
/** Shorter than this and the answer was checked locally, so there is nothing to show. */
const SLOW_CHECK_MS = 150;

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function Game() {
  const [today, setToday] = useState<Today | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [t, setT] = useState(0); // ms since the run started, per the server's clock
  const [result, setResult] = useState<Result | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean; tier?: number; checking?: boolean } | null>(null);
  const [slowCheck, setSlowCheck] = useState(false);
  const [reaction, setReaction] = useState<{ pose: Pose; ms: number; key: number } | null>(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [readyIn, setReadyIn] = useState(GET_READY_SECONDS);
  const [now, setNow] = useState(() => Date.now());
  const [sceneH, setSceneH] = useState(700);
  const [delta, setDelta] = useState<{ text: string; ok: boolean; key: number } | null>(null);
  const [board, setBoard] = useState<{ entries: Entry[]; you: Entry | null } | null>(null);
  const [scope, setScope] = useState<"daily" | "all">("daily");
  const anchor = useRef(0); // Date.now() minus elapsed run time
  // Set while an answer is out for checking. The clock is held still, mirroring the server, which stops it for AI checks.
  const frozenAt = useRef<number | null>(null);
  const tRef = useRef(0); // latest run time, held while frozen
  // Read every frame by the sky and lava canvases (kept in a ref so they never cause React re-renders).
  const sceneState = useRef<SceneState>({ level: FLOOR, cam: 0, dread: 0, surge: 0 });
  const idleScene = useRef<SceneState>({ level: 0, cam: 0, dread: 0.3, surge: 0 }); // for screens where nothing is climbing
  const sceneHRef = useRef(700);
  // What is drawn lags the true value slightly (easing), so jumps, such as a new block or a surge, glide instead of snapping.
  const shown = useRef<{ level: number; stack: number; cam: number } | null>(null);
  const [view, setView] = useState({ level: FLOOR, stack: FLOOR + MAGMA.base * UNIT, cam: 0 });
  const eventsRef = useRef<RunEvent[]>([]);
  const finishing = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

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
      setReadyIn(GET_READY_SECONDS);
      setPhase("ready");
    }
    return d;
  }, [applyServerState]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Load every pose up front so swapping poses never flickers.
  useEffect(() => { for (const p of POSES) new Image().src = panda(p); }, []);

  // A reaction (happy, sad, ...) lasts a moment, then Cinder goes back to reacting to the magma.
  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), reaction.ms);
    return () => clearTimeout(t);
  }, [reaction]);

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

  // The game loop: one animation frame at a time. Everything on screen (magma, tower, camera, Cinder) is derived from one
  // clock and eased by the same loop, so they always move together.
  useEffect(() => {
    if (phase !== "playing") return;
    shown.current = null;
    let last = performance.now();
    let raf = 0;
    const frame = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      let now: number;
      if (frozenAt.current !== null) now = tRef.current; // a check is in flight: nothing moves
      else { now = Date.now() - anchor.current; tRef.current = now; }

      const st = stateAt(eventsRef.current, now);
      const stack = FLOOR + st.stack * UNIT;
      const level = FLOOR + st.level * UNIT;
      const cam = Math.max(0, stack - sceneHRef.current * PLAYER_AT);
      const d = shown.current ?? (shown.current = { level, stack, cam });
      d.level += (level - d.level) * (1 - Math.exp(-dt / 0.08)); // a surge slides up quickly
      d.stack += (stack - d.stack) * (1 - Math.exp(-dt / 0.14)); // Cinder climbs onto the new block
      d.cam += (cam - d.cam) * (1 - Math.exp(-dt / 0.3)); // the camera follows more lazily
      setT(now);
      setView({ ...d });
      const left = (deathTime(eventsRef.current) - now) / 1000;
      sceneState.current = { level: d.level, cam: d.cam, dread: Math.min(1, Math.max(0, 1 - left / 20)), surge: sceneState.current.surge };

      if (frozenAt.current === null && deathTime(eventsRef.current) <= now) finish();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, finish]);

  useEffect(() => {
    if (phase !== "playing") return;
    const measure = () => { const h = sceneRef.current?.clientHeight ?? window.innerHeight; sceneHRef.current = h; setSceneH(h); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [phase]);

  const begin = useCallback(async () => {
    const r = await post("/api/run");
    if (r.error) { setMsg({ text: r.error, ok: false }); return; }
    applyServerState(r.events, r.elapsedMs);
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [applyServerState]);

  // No start button: after a short get-ready countdown the run begins by itself.
  useEffect(() => {
    if (phase !== "ready") return;
    if (readyIn <= 0) { begin(); return; }
    const timer = setTimeout(() => setReadyIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, readyIn, begin]);

  // Game-over screen: tick every second and reload when tomorrow's prompt unlocks.
  useEffect(() => {
    if (phase !== "done") return;
    setNow(Date.now()); // don't show the time from page load for the first second
    const timer = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (today && new Date(n).toISOString().slice(0, 10) !== today.date && document.visibilityState === "visible") {
        window.location.reload(); // midnight UTC passed: tomorrow's prompt is live
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, today]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = suggestion ?? input.trim();
    if (!text || phase !== "playing" || checking) return;
    setChecking(true);
    // Only if the check takes a moment (i.e. it has gone to the AI) does the typed word change colour.
    const slowTimer = setTimeout(() => {
      setSlowCheck(true);
      setMsg({ text: "Checking…", ok: false, checking: true });
    }, SLOW_CHECK_MS);
    queue.current = queue.current.then(async () => {
      const prevLeft = deathTime(eventsRef.current) - (Date.now() - anchor.current);
      frozenAt.current = Date.now();
      let r;
      try {
        r = await post("/api/answer", { answer: text });
      } catch {
        r = { status: "error", detail: "no connection" };
      }
      clearTimeout(slowTimer);
      setSlowCheck(false);
      if (!r.events && frozenAt.current !== null) anchor.current += Date.now() - frozenAt.current; // no server clock: resume where we froze
      frozenAt.current = null;
      if (r.events) {
        applyServerState(r.events, r.elapsedMs);
        const change = (deathTime(r.events) - r.elapsedMs) - prevLeft;
        if (r.status === "valid" || r.status === "invalid") {
          setDelta({ text: `${change >= 0 ? "+" : "−"}${(Math.abs(change) / 1000).toFixed(1)}s`, ok: change >= 0, key: Date.now() });
        }
      }
      if (r.dead || r.status === "dead") { setChecking(false); finish(); return; }
      if (r.status === "valid") {
        const tier: number = r.rarity ?? 0;
        setMsg({ text: tier > 0 ? `${RARITY_LABEL[tier]} • ${r.canonical}` : `+1 • ${r.canonical}`, ok: true, tier });
        setReaction(tier > 0 ? { pose: "celebrate", ms: 1600, key: Date.now() } : { pose: "happy", ms: 900, key: Date.now() });
        setInput("");
        setWrong(false);
        setSuggestion(null);
      } else if (r.status === "suggest") {
        // A fixed typo is only offered, never accepted, and costs nothing.
        setSuggestion(r.canonical);
        setWrong(false);
        setMsg({ text: `Did you mean ${r.canonical}? Press Enter to accept, or keep typing.`, ok: false });
        setReaction({ pose: "ponder", ms: 1200, key: Date.now() });
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
        setReaction({ pose: "sad", ms: 1200, key: Date.now() });
        sceneState.current.surge++; // the lava heaves
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
  const words = events.filter((e) => e.kind === "valid").map((e) => ({ name: e.answer ?? "", rarity: e.rarity ?? 0 }));
  // Time until the magma reaches you if you stopped answering right now.
  const msToDeath = Math.max(0, deathTime(events) - t);
  const secsToDeath = msToDeath / 1000;
  const danger = secsToDeath <= 10;
  const dread = Math.min(1, Math.max(0, 1 - secsToDeath / 20)); // 0 = calm, 1 = about to die
  // Cinder: a quick reaction to the last answer, else "thinking" while the AI checks, else a mood that follows the magma.
  const mood: Pose = secsToDeath <= 8 ? "scared" : secsToDeath <= 20 ? "nervous" : "idle";
  const pose: Pose = reaction?.pose ?? (slowCheck ? "think" : mood);

  // Camera: it follows the top of the stack so Cinder stays at a fixed spot on screen. The whole world moves with it,
  // magma included, so adding a block never makes the lava appear to sink.
  const cam = view.cam;
  const belowScreen = (bottom: number) => bottom + UNIT - cam < 0;

  if (phase === "playing") {
    return (
      <div className="scene" ref={sceneRef} style={{ "--dread": dread } as React.CSSProperties}>
        <SkyCanvas stateRef={sceneState} />

        <div className="world" style={{ transform: `translate3d(0, ${cam}px, 0)` }}>
          <div className="tower" style={{ height: FLOOR + MAGMA.base * UNIT }} />
          {words.map((w, i) => {
            const bottom = FLOOR + (MAGMA.base + i * MAGMA.stone) * UNIT;
            if (belowScreen(bottom)) return null;
            const submerged = bottom + UNIT <= view.level; // fully under the lava
            return (
              <div key={`${i}-${w.name}`} className={`box drop-in r${w.rarity}${submerged ? " sub" : ""}`} style={{ bottom, height: UNIT, "--i": i, transform: `translateX(${((i * 7) % 5 - 2) * 3}px)` } as React.CSSProperties}>
                <span>{w.name}</span>
              </div>
            );
          })}
          <div className="panda-wrap" style={{ bottom: view.stack }}>
            <img key={pose} className={`panda panda-${pose}`} src={panda(pose)} alt="Cinder the panda" draggable={false} />
          </div>
        </div>
        <LavaCanvas stateRef={sceneState} />
        <div className="scene-vignette" />

        <div className="hud">
          <div className="hud-timer">
            <span className="hud-label">Magma reaches you in</span>
            <span className={`hud-time ${danger ? "hud-danger" : ""}`}>{clock(msToDeath)}</span>
            {delta && <span key={delta.key} className={`hud-delta ${delta.ok ? "delta-up" : "delta-down"}`}>{delta.text}</span>}
          </div>

          <h2 className="hud-prompt">{today.prompt.text}</h2>
          {today.prompt.hint && <p className="hud-hint">{today.prompt.hint}</p>}

          <form onSubmit={send}>
            <input
              ref={inputRef}
              className={`input-box ${wrong ? "is-wrong" : ""} ${suggestion ? "is-suggest" : ""} ${slowCheck ? "is-checking" : ""} ${shaking ? "is-shaking" : ""}`}
              value={input}
              onChange={(e) => { setInput(e.target.value); setWrong(false); setSuggestion(null); setMsg(null); }}
              onAnimationEnd={() => setShaking(false)}
              autoComplete="off"
              autoCapitalize="off"
              placeholder="Type an answer..."
            />
          </form>
          <div className="hud-feedback" aria-live="polite">
            <span className={`msg-text ${msg?.checking ? "msg-checking" : msg?.ok ? (msg.tier ? `msg-r${msg.tier}` : "msg-ok") : suggestion ? "msg-suggest" : msg ? "msg-bad" : ""}`}>{msg?.text ?? " "}</span>
            <span className="hud-count"><b>{s.valid}</b> accepted</span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <main className="layout-centered">
        <div className="sky-fixed"><SkyCanvas /></div>
        <section className="card card-intro">
          <img className="ready-panda" src={panda("idle")} alt="Cinder the panda" draggable={false} />
          <h1 className="title-main">Listicle</h1>
          {today.streak.current > 0 && (
            <div className="streak-badge"><span className="fire-icon">🔥</span> {today.streak.current}-Day Streak</div>
          )}
          <p className="rules-text">
            <b>One prompt a day.</b> Help Cinder the panda stay ahead of the rising magma. It speeds up the longer you last.
            Every valid answer lifts you higher. A wrong answer makes the magma surge.
            Once it catches you, today is over.
          </p>
          {msg ? <p className="msg-bad">{msg.text}</p> : (
            <>
              <div className="ready-count" key={readyIn}>{readyIn > 0 ? readyIn : "Go"}</div>
              <p className="hint">Get ready…</p>
            </>
          )}
        </section>
      </main>
    );
  }

  // phase === "done": the game-over screen.
  const answersInOrder = events.filter((e) => e.kind === "valid").map((e) => ({ name: e.answer ?? "", rarity: e.rarity ?? 0 }));
  const untilTomorrow = msUntilTomorrow(now);
  const resetLocal = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1))
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="over">
      <div className="sky-fixed"><SkyCanvas /></div>
      <div className="lava-fixed"><LavaCanvas stateRef={idleScene} fixedSurface={0.64} /></div>
      {result && (
        <main className="over-content">
          <img className="over-panda" src={panda("scorched")} alt="Cinder, scorched" draggable={false} />
          <p className="over-kicker">The magma caught Cinder</p>
          <div className="over-score">{result.total}</div>
          <p className="over-sub">{result.total === 1 ? "answer" : "answers"} · survived {clock(result.survivedMs)}</p>

          <p className="over-standing">
            {result.standing.percentile !== null
              ? <>You outlasted <b>{result.standing.percentile}%</b> of today&apos;s players</>
              : <>Rank <b>#{result.standing.rank}</b> of {result.standing.players} today</>}
          </p>
          {today.streak.current > 0 && (
            <div className="streak-summary">
              <span className="fire-icon">🔥</span> {today.streak.current}-Day Streak
              {today.streak.best > today.streak.current ? <span className="streak-best">(Best: {today.streak.best})</span> : ""}
            </div>
          )}

          <section className="over-card over-tomorrow">
            <img className="sleep-panda" src={panda("sleep")} alt="Cinder asleep" draggable={false} />
            <h2>You can play again tomorrow</h2>
            <p className="hint">Today&apos;s run is used. Tomorrow&apos;s prompt unlocks in</p>
            <div className="over-countdown" aria-live="off">{hms(untilTomorrow)}</div>
            <p className="hint">New prompt at midnight UTC ({resetLocal} your time)</p>
          </section>

          <section className="over-card">
            <h3 className="over-h">Today&apos;s prompt</h3>
            <p className="over-prompt">{today.prompt.text}</p>
            {answersInOrder.length > 0 ? (
              <ul className="chips">
                {answersInOrder.map((a, i) => <li key={`${i}-${a.name}`} className={`chip-item r${a.rarity}`}>{a.name}</li>)}
              </ul>
            ) : <p className="hint">You didn&apos;t get an answer in this time.</p>}
          </section>

          <section className="over-card">
            <h3 className="over-h">Leaderboard</h3>
            <div className="tabs">
              <button className={`tab-btn ${scope === "daily" ? "is-active" : ""}`} onClick={() => setScope("daily")}>Today</button>
              <button className={`tab-btn ${scope === "all" ? "is-active" : ""}`} onClick={() => setScope("all")}>All Time</button>
            </div>
            <ol className="board">
              {board?.entries.map((e) => (
                <li key={`${e.rank}-${e.handle}`} className={`board-row ${e.you ? "is-me" : ""}`}>
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
        </main>
      )}
    </div>
  );
}
