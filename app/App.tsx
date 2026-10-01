"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deathTime, MAGMA, stateAt, type RunEvent } from "@/lib/magma";
import { sfx } from "./audio/sfx";
import SoundToggle from "./audio/SoundToggle";
import LavaCanvas from "./scene/LavaCanvas";
import SkyCanvas from "./scene/SkyCanvas";
import type { SceneState } from "./scene/types";
import { DoneSheet, MenuSheet, ReadySheet, WelcomeSheet } from "./Sheets";
import type { Entry, HomeData, Phase, Result, Today } from "./types";

/** Seconds of "get ready" before the run starts by itself. The server clock only starts after it. */
/** Pixels per unit of height in the scene. */
const UNIT = 38;
/** While running, Cinder sits this far up the screen (share of the height, measured from the bottom). */
const PLAYER_AT = 0.5;
/** Height of the lava pool visible under the tower from the very start. */
const FLOOR = 72;
/** Out of a run, Cinder stands on a short tower (in stones of height) and climbs to the full one when the run starts. */
const IDLE_STACK = 3.5;
/** The tower reaches this far below the screen, so it fills the bottom however the camera moves. */
const TOWER_DEPTH = 1200;
const SLOW_CHECK_MS = 150;
const RARITY_LABEL = ["", "RARE", "ULTRA RARE", "INSANELY RARE"];

/** Cinder the panda. One image per pose in public/panda (made by scripts/slice-panda.py). */
const POSES = ["idle", "cheer", "jump", "curious", "joy", "love", "relax", "shy", "tense", "worried", "tumble", "sleep"] as const;
type Pose = (typeof POSES)[number];
const panda = (pose: Pose) => `/panda/${pose}.png`;

/** Sparkles that float up from Cinder when an answer is accepted: more of them, and brighter, for rarer answers. */
interface Burst { id: number; y: number; items: { glyph: string; color: string; dx: number; delay: number; size: number }[] }
const BURST_GLYPHS = ["♥", "✦", "★"]; // heart, four-point star, star (plain symbols, not emoji)
const BURST_COLORS = [["#ff9ec7", "#fff1dc"], ["#ffd86b", "#fff1dc"], ["#c9a0ff", "#ffd86b"], ["#ff8aa0", "#ffd86b", "#8be9ad", "#9fd8ff", "#c9a0ff"]];
const BURST_COUNT = [5, 7, 9, 13];
let burstId = 0;
const makeBurst = (tier: number, y: number): Burst => ({
  id: ++burstId,
  y,
  items: Array.from({ length: BURST_COUNT[tier] }, (_, i) => ({
    glyph: BURST_GLYPHS[i % BURST_GLYPHS.length],
    color: BURST_COLORS[tier][i % BURST_COLORS[tier].length],
    dx: Math.round((Math.random() - 0.5) * (90 + tier * 40)),
    delay: Math.round(Math.random() * 160),
    size: 0.9 + Math.random() * 0.7 + tier * 0.15,
  })),
});

const post = (url: string, body: unknown = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/**
 * The whole app. The world (night sky, tower, Cinder, lava) is mounted once and never goes away: the menu, the
 * get-ready screen, the run and the results are panels that sit on top of it, so moving between them never feels
 * like changing page. The URL says which question is open: "/" is Today's Question, "/play/<genre>" an extra.
 */
export default function App() {
  const pathname = usePathname();
  const genre = pathname.startsWith("/play/") ? pathname.split("/")[2] : "general";

  const [today, setToday] = useState<Today | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [menu, setMenu] = useState(false);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [t, setT] = useState(0); // ms of run time, per the server's clock
  const [result, setResult] = useState<Result | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean; tier?: number; checking?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slowCheck, setSlowCheck] = useState(false);
  const [reaction, setReaction] = useState<{ pose: Pose; ms: number; key: number } | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [rulesSeen, setRulesSeen] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [delta, setDelta] = useState<{ text: string; ok: boolean; key: number } | null>(null);
  const [board, setBoard] = useState<{ entries: Entry[]; you: Entry | null } | null>(null);
  const [scope, setScope] = useState<"daily" | "all">("daily");
  const [view, setView] = useState({ level: FLOOR, stack: FLOOR + MAGMA.base * UNIT, cam: 0 });

  const anchor = useRef(0); // Date.now() minus elapsed run time
  const frozenAt = useRef<number | null>(null); // set while an answer is out for checking: the clock holds still
  const tRef = useRef(0);
  const sceneState = useRef<SceneState>({ level: FLOOR, cam: 0, dread: 0, surge: 0 });
  const sceneHRef = useRef(700);
  const shown = useRef<{ level: number; stack: number; cam: number } | null>(null); // what is drawn lags the true value (easing)
  const eventsRef = useRef<RunEvent[]>([]);
  const validRef = useRef(0);
  const phaseRef = useRef<Phase>("loading");
  const genreRef = useRef(genre);
  const finishing = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const combo = useRef(0); // accepted answers in a row; pitches the pop sound
  const lastBeat = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  phaseRef.current = phase;
  genreRef.current = genre;

  const applyServerState = useCallback((evs: RunEvent[], elapsedMs: number) => {
    eventsRef.current = evs;
    validRef.current = evs.filter((e) => e.kind === "valid").length;
    setEvents(evs);
    anchor.current = Date.now() - elapsedMs;
    setT(elapsedMs);
  }, []);

  const loadHome = useCallback(() => {
    fetch("/api/home").then((r) => r.json()).then(setHome).catch(() => undefined);
  }, []);

  const loadToday = useCallback(async () => {
    const wanted = genre;
    const d: Today = await fetch(`/api/today?genre=${wanted}`).then((r) => r.json());
    if (genreRef.current !== wanted) return d; // the player moved on while this was loading
    setToday(d);
    if (d.result) {
      eventsRef.current = d.events;
      validRef.current = d.events.filter((e) => e.kind === "valid").length;
      setEvents(d.events);
      setResult(d.result);
      setPhase("done");
    } else if (d.started) {
      applyServerState(d.events, d.elapsedMs);
      setPhase("playing");
    } else {
      setPhase("ready");
    }
    return d;
  }, [genre, applyServerState]);

  // Opening a different question starts from a clean slate, but the world stays where it is.
  useEffect(() => {
    eventsRef.current = [];
    validRef.current = 0;
    frozenAt.current = null;
    combo.current = 0;
    lastBeat.current = 0;
    finishing.current = false;
    setEvents([]); setT(0); tRef.current = 0; setResult(null); setBoard(null); setMsg(null); setError(null); setInput("");
    setWrong(false); setSuggestion(null); setSlowCheck(false); setReaction(null); setBursts([]); setDelta(null);
    setMenu(false); setToday(null); setPhase("loading");
    void loadToday();
  }, [genre, loadToday]);

  useEffect(() => { loadHome(); }, [loadHome]);
  useEffect(() => { if (menu || phase === "done") loadHome(); }, [menu, phase, loadHome]);
  useEffect(() => {
    try {
      setRulesSeen(localStorage.getItem("pw-rules") === "1");
      setWelcome(localStorage.getItem("pw-welcome") !== "1");
    } catch { setRulesSeen(false); setWelcome(true); }
  }, []);
  useEffect(() => { for (const p of POSES) new Image().src = panda(p); }, []);
  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), reaction.ms);
    return () => clearTimeout(timer);
  }, [reaction]);

  useEffect(() => {
    if (phase !== "done") return;
    fetch(`/api/leaderboard?genre=${genre}&scope=${scope}`).then((r) => r.json()).then(setBoard);
  }, [phase, scope, genre]);

  const proud = !!result && (result.standing.percentile !== null ? result.standing.percentile >= 75 : result.standing.rank === 1);

  // The "caught" sounds.
  useEffect(() => {
    if (phase !== "done" || !result) return;
    sfx.play("gameover");
    const timer = setTimeout(() => sfx.play(proud ? "win" : "lullaby"), 1800);
    return () => clearTimeout(timer);
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

  // The world loop: one animation frame at a time, always running. Everything on screen (lava, tower, camera, Cinder)
  // is derived from one clock and eased by this loop, so it all moves together, in a run and out of it.
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const frame = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      const ph = phaseRef.current;
      const H = sceneHRef.current;
      let stackU: number = IDLE_STACK;
      let levelU = 0.4;
      let dread = 0;
      let feetFromBottom: number;

      if (ph === "playing") {
        let nowMs: number;
        if (frozenAt.current !== null) nowMs = tRef.current; // a check is in flight: nothing moves
        else { nowMs = Date.now() - anchor.current; tRef.current = nowMs; }
        const st = stateAt(eventsRef.current, nowMs);
        stackU = st.stack;
        levelU = st.level;
        const left = (deathTime(eventsRef.current) - nowMs) / 1000;
        dread = Math.min(1, Math.max(0, 1 - left / 20));
        setT(nowMs);
        if (left > 0 && left <= 8 && frozenAt.current === null) { // a heartbeat each second while the lava is close
          const sec = Math.ceil(left);
          if (sec !== lastBeat.current) { lastBeat.current = sec; sfx.play("beat"); }
        }
        if (frozenAt.current === null && deathTime(eventsRef.current) <= nowMs) void finish();
        feetFromBottom = H * PLAYER_AT;
      } else {
        // Out of a run: show the stage under whichever panel is open. After a run, the lava has reached Cinder.
        if (ph === "done") { stackU = MAGMA.base + MAGMA.stone * validRef.current; levelU = stackU + 0.5; dread = 0.45; }
        const sheet = document.querySelector(".sheet");
        const sheetBottom = sheet ? sheet.getBoundingClientRect().bottom : 0;
        feetFromBottom = Math.min(H * 0.7, Math.max(70, H - sheetBottom - 130)); // Cinder stands in the space below the panel
      }

      const stack = FLOOR + stackU * UNIT;
      const level = FLOOR + levelU * UNIT;
      let cam = stack - feetFromBottom;
      if (ph === "playing") {
        cam = Math.max(0, cam);
      } else {
        // Keep a strip of lava on screen, but only if Cinder still stays clear of the panel above.
        const sheet = document.querySelector(".sheet");
        const clearBelow = H - (sheet ? sheet.getBoundingClientRect().bottom : 0) - 112; // room for Cinder's body
        const camForLava = level - 44;
        if (stack - camForLava <= clearBelow) cam = Math.min(cam, camForLava);
      }
      const d = shown.current ?? (shown.current = { level, stack, cam });
      d.level += (level - d.level) * (1 - Math.exp(-dt / 0.08)); // a surge slides up quickly
      d.stack += (stack - d.stack) * (1 - Math.exp(-dt / 0.14)); // Cinder climbs onto the new block
      d.cam += (cam - d.cam) * (1 - Math.exp(-dt / 0.3)); // the camera follows more lazily
      setView({ ...d });
      sceneState.current = { level: d.level, cam: d.cam, dread, surge: sceneState.current.surge };
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finish]);

  useEffect(() => {
    const measure = () => { const h = sceneRef.current?.clientHeight ?? window.innerHeight; sceneHRef.current = h; };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const begin = useCallback(async () => {
    const wanted = genre;
    const r = await post("/api/run", { genre: wanted });
    if (genreRef.current !== wanted) return;
    if (r.error) { setError(r.error); return; }
    applyServerState(r.events, r.elapsedMs);
    try { localStorage.setItem("pw-rules", "1"); } catch { /* not remembered in private mode */ }
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [genre, applyServerState]);

  // Out of a run: tick every second, and reload when tomorrow's questions unlock.
  useEffect(() => {
    if (phase === "playing") return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (today && new Date(n).toISOString().slice(0, 10) !== today.date && document.visibilityState === "visible") window.location.reload();
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, today]);

  const dismissWelcome = useCallback(() => {
    setWelcome(false);
    try { localStorage.setItem("pw-welcome", "1"); } catch { /* shown again next visit in private mode */ }
  }, []);
  const openMenu = useCallback(() => setMenu(true), []);
  const closeMenu = useCallback(() => setMenu(false), []);

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
      if (r.dead || r.status === "dead") { setChecking(false); void finish(); return; }
      if (r.status === "valid") {
        const tier: number = r.rarity ?? 0;
        setMsg({ text: tier > 0 ? `${RARITY_LABEL[tier]}: ${r.canonical}` : `+1 ${r.canonical}`, ok: true, tier });
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
        setMsg({ text: `Did you mean ${r.canonical}? Press Enter to accept.`, ok: false });
        setReaction({ pose: "shy", ms: 1200, key: Date.now() });
        sfx.play("suggest");
      } else if (r.status === "duplicate") {
        setSuggestion(null);
        setMsg({ text: `You already have ${r.canonical}.`, ok: false });
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
        setMsg({ text: "Not on the list. The lava surges.", ok: false });
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

  const answers = useMemo(
    () => (phase === "done" ? events.filter((e) => e.kind === "valid").map((e) => ({ name: e.answer ?? "", rarity: e.rarity ?? 0 })) : []),
    [events, phase],
  );

  const s = stateAt(events, t);
  const words = phase === "ready" || phase === "loading" ? [] : events.filter((e) => e.kind === "valid").map((e) => ({ name: e.answer ?? "", rarity: e.rarity ?? 0 }));
  const msToDeath = Math.max(0, deathTime(events) - t); // time until the lava reaches Cinder if you stopped answering now
  const secsToDeath = msToDeath / 1000;
  const playing = phase === "playing";
  const danger = playing && secsToDeath <= 10;
  const mood: Pose = secsToDeath <= 8 ? "worried" : secsToDeath <= 20 ? "tense" : "idle";
  const pose: Pose = phase === "done" ? (proud ? "love" : "worried") : playing ? (reaction?.pose ?? (slowCheck ? "curious" : mood)) : "idle";
  const dread = playing ? Math.min(1, Math.max(0, 1 - secsToDeath / 20)) : 0;
  const cam = view.cam;
  const belowScreen = (bottom: number) => bottom + UNIT - cam < 0;

  return (
    <div className="scene" ref={sceneRef} style={{ "--dread": dread } as React.CSSProperties}>
      <SkyCanvas stateRef={sceneState} />

      <div className="world" style={{ transform: `translate3d(0, ${cam}px, 0)` }}>
        <div className="tower" style={{ bottom: -TOWER_DEPTH, height: Math.min(view.stack, FLOOR + MAGMA.base * UNIT) + TOWER_DEPTH }} />
        {words.map((w, i) => {
          const bottom = FLOOR + (MAGMA.base + i * MAGMA.stone) * UNIT;
          if (belowScreen(bottom)) return null;
          const submerged = bottom + UNIT <= view.level; // fully under the lava
          return (
            <div key={`${genre}-${i}-${w.name}`} className={`box drop-in r${w.rarity}${submerged ? " sub" : ""}`} style={{ bottom, height: UNIT, "--i": i, transform: `translateX(${((i * 7) % 5 - 2) * 3}px)` } as React.CSSProperties}>
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
          <span key={`${b.id}-${i}`} className="fx" style={{ top: b.y, color: it.color, "--dx": `${it.dx}px`, animationDelay: `${it.delay}ms`, fontSize: `${it.size}rem` } as React.CSSProperties}>{it.glyph}</span>
        )))}
      </div>

      {playing && today && (
        <div className="hud">
          <div className="hud-timer">
            <span className="hud-label">Lava reaches Cinder in</span>
            <span className={`hud-time ${danger ? "hud-danger" : ""}`}>{clock(msToDeath)}</span>
            {delta && <span key={delta.key} className={`hud-delta ${delta.ok ? "delta-up" : "delta-down"}`}>{delta.text}</span>}
          </div>
          <p className="hud-genre">{today.genre.main ? "Today's question" : today.genre.name}</p>
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
              placeholder="Type an answer"
            />
          </form>
          <div className="hud-feedback" aria-live="polite">
            <span className={`msg-text ${msg?.checking ? "msg-checking" : msg?.ok ? (msg.tier ? `msg-r${msg.tier}` : "msg-ok") : suggestion ? "msg-suggest" : msg ? "msg-bad" : ""}`}>{msg?.text ?? " "}</span>
            <span className="hud-count"><b>{s.valid}</b> accepted</span>
          </div>
          <div className="hud-foot"><SoundToggle /></div>
        </div>
      )}

      {phase === "loading" && <section className="sheet"><div className="loader" /></section>}
      {phase === "ready" && welcome && <WelcomeSheet onContinue={dismissWelcome} />}
      {phase === "ready" && today && !menu && !welcome && <ReadySheet today={today} rulesSeen={rulesSeen} error={error} onStart={() => void begin()} onMenu={openMenu} />}
      {menu && phase !== "playing" && <MenuSheet home={home} currentId={genre} onClose={closeMenu} />}
      {phase === "done" && today && result && !menu && (
        <DoneSheet today={today} result={result} proud={proud} now={now} home={home} answers={answers} scope={scope} onScope={setScope} board={board} />
      )}
    </div>
  );
}
