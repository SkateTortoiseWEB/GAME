"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deathTime, MAGMA, stateAt, type RunEvent } from "@/lib/magma";
import Link from "next/link";
import { sfx } from "./audio/sfx";
import { hms, msUntilTomorrow } from "./time";
import LavaCanvas from "./scene/LavaCanvas";
import SkyCanvas from "./scene/SkyCanvas";
import type { SceneState } from "./scene/types";

interface Standing { rank: number | null; players: number; percentile: number | null }
interface Result { total: number; survivedMs: number; standing: Standing }
interface Today {
  date: string;
  genre: { id: string; name: string; emoji: string };
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

/** Cinder the panda. One image per pose in public/panda (made by scripts/slice-panda.py). */
const POSES = ["idle", "cheer", "jump", "curious", "joy", "love", "relax", "shy", "tense", "worried", "tumble", "sleep"] as const;
type Pose = (typeof POSES)[number];
const panda = (pose: Pose) => `/panda/${pose}.png`;

const RARITY_LABEL = ["", "RARE", "ULTRA RARE", "INSANELY RARE"];

/** Sparkles that float up from Cinder when an answer is accepted: bigger and brighter for rarer answers. */
interface Burst { id: number; y: number; items: { e: string; dx: number; delay: number; size: number }[] }
const BURST_SETS = [["💖", "✨", "🐾"], ["⭐", "✨", "💛"], ["💜", "✨", "💫"], ["🌈", "⭐", "💖", "✨", "💜"]];
const BURST_COUNT = [5, 7, 9, 13];
let burstId = 0;
const makeBurst = (tier: number, y: number): Burst => ({
  id: ++burstId,
  y,
  items: Array.from({ length: BURST_COUNT[tier] }, (_, i) => ({
    e: BURST_SETS[tier][i % BURST_SETS[tier].length],
    dx: Math.round((Math.random() - 0.5) * (90 + tier * 40)),
    delay: Math.round(Math.random() * 160),
    size: 0.9 + Math.random() * 0.7 + tier * 0.15,
  })),
});

interface NextGenre { id: string; name: string; emoji: string; prompt: string }
/** Shorter than this and the answer was checked locally, so there is nothing to show. */
const SLOW_CHECK_MS = 150;

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function Game({ genre }: { genre: string }) {
  const [today, setToday] = useState<Today | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [t, setT] = useState(0); // ms since the run started, per the server's clock
  const [result, setResult] = useState<Result | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean; tier?: number; checking?: boolean } | null>(null);
  const [slowCheck, setSlowCheck] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [rulesSeen, setRulesSeen] = useState<boolean | null>(null);
  const [next, setNext] = useState<NextGenre | "all" | null>(null);
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
  const combo = useRef(0); // accepted answers in a row; pitches the pop sound
  const lastBeat = useRef(0);
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
    const d: Today = await fetch(`/api/today?genre=${genre}`).then((r) => r.json());
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

  useEffect(() => { try { setRulesSeen(localStorage.getItem("pw-rules") === "1"); } catch { setRulesSeen(false); } }, []);

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
    fetch(`/api/leaderboard?genre=${genre}&scope=${scope}`).then((r) => r.json()).then(setBoard);
  }, [phase, scope, genre]);

  // On the game-over screen: work out which genre to suggest next, and play the "caught" sounds.
  useEffect(() => {
    if (phase !== "done" || !result) return;
    fetch("/api/home").then((r) => r.json()).then((h: { genres: { id: string; name: string; emoji: string; prompt: string; status: string }[] }) => {
      const open = h.genres.filter((g) => g.id !== genre && g.status !== "done");
      setNext(open.length ? open[0] : "all");
    });
    const proud = result.standing.percentile !== null ? result.standing.percentile >= 75 : result.standing.rank === 1;
    sfx.play("gameover");
    const t = setTimeout(() => sfx.play(proud ? "win" : "lullaby"), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result?.total]);

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

      if (left > 0 && left <= 8 && frozenAt.current === null) { // a heartbeat each second while the lava is close
        const sec = Math.ceil(left);
        if (sec !== lastBeat.current) { lastBeat.current = sec; sfx.play("beat"); }
      }
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
    const r = await post("/api/run", { genre });
    if (r.error) { setMsg({ text: r.error, ok: false }); return; }
    applyServerState(r.events, r.elapsedMs);
    try { localStorage.setItem("pw-rules", "1"); } catch { /* not remembered in private mode */ }
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [applyServerState]);

  // Countdown ticks and the "go" chime.
  useEffect(() => {
    if (phase !== "ready") return;
    sfx.play(readyIn > 0 ? "tick" : "go");
  }, [phase, readyIn]);

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
      setMsg({ text: "Thinking…", ok: false, checking: true });
    }, SLOW_CHECK_MS);
    queue.current = queue.current.then(async () => {
      const prevLeft = deathTime(eventsRef.current) - (Date.now() - anchor.current);
      frozenAt.current = Date.now();
      let r;
      try {
        r = await post("/api/answer", { genre, answer: text });
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
        setMsg({ text: tier > 0 ? `${RARITY_LABEL[tier]}! ${r.canonical}` : `Yay! ${r.canonical}`, ok: true, tier });
        setReaction(tier > 0 ? { pose: "cheer", ms: 1600, key: Date.now() } : { pose: "jump", ms: 900, key: Date.now() });
        combo.current += 1;
        sfx.play(tier > 0 ? (`rare${tier}` as "rare1" | "rare2" | "rare3") : "pop", { combo: combo.current - 1 });
        window.setTimeout(() => sfx.play("squeak"), 90);
        const sh = shown.current;
        const burst = makeBurst(tier, sh ? sceneHRef.current - (sh.stack + UNIT) + sh.cam - 56 : 220);
        setBursts((b) => [...b.slice(-3), burst]);
        window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== burst.id)), 1500);
        setInput("");
        setWrong(false);
        setSuggestion(null);
      } else if (r.status === "suggest") {
        // A fixed typo is only offered, never accepted, and costs nothing.
        setSuggestion(r.canonical);
        setWrong(false);
        setMsg({ text: `Did you mean ${r.canonical}? Press Enter to accept 🐾`, ok: false });
        setReaction({ pose: "shy", ms: 1200, key: Date.now() });
        sfx.play("suggest");
      } else if (r.status === "duplicate") {
        setSuggestion(null);
        setMsg({ text: `Already got ${r.canonical}!`, ok: false });
        sfx.play("tap");
        setWrong(true);
        setShaking(true);
      } else if (r.status === "error") {
        setSuggestion(null);
        setMsg({ text: r.detail ? `Checker problem: ${r.detail}` : "Couldn't check that one, try again.", ok: false });
        setWrong(true);
        setShaking(true);
      } else {
        setSuggestion(null);
        setMsg({ text: "Oopsie, not on the list! The lava surges", ok: false });
        setReaction({ pose: "worried", ms: 1200, key: Date.now() });
        combo.current = 0;
        sfx.play("wrong");
        window.setTimeout(() => sfx.play("surge"), 120);
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
  const mood: Pose = secsToDeath <= 8 ? "worried" : secsToDeath <= 20 ? "tense" : "idle";
  const pose: Pose = reaction?.pose ?? (slowCheck ? "curious" : mood);

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
        <div className="fx-layer" aria-hidden>
          {bursts.map((b) => b.items.map((it, i) => (
            <span key={`${b.id}-${i}`} className="fx" style={{ top: b.y, "--dx": `${it.dx}px`, animationDelay: `${it.delay}ms`, fontSize: `${it.size}rem` } as React.CSSProperties}>{it.e}</span>
          )))}
        </div>

        <div className="hud">
          <div className="hud-timer">
            <span className="hud-label">Lava reaches Cinder in</span>
            <span className={`hud-time ${danger ? "hud-danger" : ""}`}>{clock(msToDeath)}</span>
            {delta && <span key={delta.key} className={`hud-delta ${delta.ok ? "delta-up" : "delta-down"}`}>{delta.text}</span>}
          </div>

          <p className="hud-genre">{today.genre.emoji} {today.genre.name}</p>
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
              placeholder="Type an answer… 🐾"
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
        <section className="card card-intro pop-card">
          <Link href="/" className="back-link" onClick={() => sfx.play("tap")}>← All genres</Link>
          <img className="ready-panda" src={panda("idle")} alt="Cinder the panda" draggable={false} />
          <p className="genre-chip">{today.genre.emoji} {today.genre.name}</p>
          <div className="ready-prompt">
            <span className="ready-prompt-label">Today&apos;s question</span>
            <b>{today.prompt.text}</b>
            {today.prompt.hint && <i>{today.prompt.hint}</i>}
          </div>
          {rulesSeen === false && (
            <p className="rules-text">
              Help Cinder climb! Every answer adds a block. Wrong answers make the lava surge, and the lava gets
              faster the longer you last. When it catches Cinder, this genre is done for today.
            </p>
          )}
          {rulesSeen === true && <p className="rules-text rules-compact">Name as many as you can. Don&apos;t let the lava catch Cinder! 🐾</p>}
          {today.streak.current > 0 && (
            <div className="streak-badge"><span className="fire-icon">🔥</span> {today.streak.current}-Day Streak</div>
          )}
          {msg ? <p className="msg-bad">{msg.text}</p> : (
            <>
              <div className="ready-count" key={readyIn}>{readyIn > 0 ? readyIn : "Go!"}</div>
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

  const proud = !!result && (result.standing.percentile !== null ? result.standing.percentile >= 75 : result.standing.rank === 1);

  return (
    <div className="over">
      <div className="sky-fixed"><SkyCanvas /></div>
      <div className="lava-fixed"><LavaCanvas stateRef={idleScene} fixedSurface={0.64} /></div>
      {result && (
        <main className="over-content">
          <img className="over-panda" src={panda(proud ? "love" : "worried")} alt={proud ? "Cinder, delighted" : "Cinder, worried"} draggable={false} />
          <p className="over-kicker">{proud ? "Pawsome run!" : "Oh no, the lava caught Cinder!"}</p>
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
            <h2>Sweet dreams, Cinder!</h2>
            <p className="hint">You can play {today.genre.name} again tomorrow. Its next question unlocks in</p>
            <div className="over-countdown" aria-live="off">{hms(untilTomorrow)}</div>
            <p className="hint">New questions at midnight UTC ({resetLocal} your time)</p>
          </section>

          <section className="over-card over-next">
            {next && next !== "all" && (
              <>
                <p className="over-h">Up next</p>
                <Link href={`/play/${next.id}`} className="btn-primary over-more" onClick={() => sfx.play("tap")}>
                  {next.emoji} {next.name} →
                </Link>
                <p className="hint">{next.prompt}</p>
              </>
            )}
            {next === "all" && <p className="over-all-done">🎉 You&apos;ve played every genre today! See you tomorrow.</p>}
            <Link href="/" className="over-allgenres" onClick={() => sfx.play("tap")}>See all genres</Link>
          </section>

          <section className="over-card">
            <h3 className="over-h">Your answers</h3>
            <p className="over-prompt">{today.prompt.text}</p>
            {answersInOrder.length > 0 ? (
              <ul className="chips">
                {answersInOrder.map((a, i) => <li key={`${i}-${a.name}`} className={`chip-item r${a.rarity}`}>{a.name}</li>)}
              </ul>
            ) : <p className="hint">No answers this time, Cinder believes in you!</p>}
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
