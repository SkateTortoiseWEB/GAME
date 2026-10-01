/**
 * Cute sound effects, synthesized in the browser with the Web Audio API (no audio files to load or license).
 * Every effect is a "recipe" that schedules oscillators onto any audio context, so the same code plays live and can be
 * rendered offline in tests. Pitches come from a major pentatonic scale, so nothing ever sounds out of tune.
 */

export type SfxName =
  | "tap" | "pop" | "squeak" | "rare1" | "rare2" | "rare3" | "wrong" | "surge" | "suggest"
  | "tick" | "go" | "beat" | "gameover" | "lullaby" | "win";

export interface SfxOpts {
  /** Accepted answers in a row; makes "pop" climb the scale. */
  combo?: number;
}

type Recipe = (ctx: BaseAudioContext, out: AudioNode, t: number, o: SfxOpts) => number;

interface ToneSpec {
  f: number;
  /** Glide to this frequency over the note. */
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  /** Delay from the start of the recipe, seconds. */
  at?: number;
  /** Vibrato: rate in Hz, depth in Hz. */
  vib?: [number, number];
}

function tone(ctx: BaseAudioContext, out: AudioNode, t0: number, s: ToneSpec) {
  const t = t0 + (s.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = s.type ?? "sine";
  osc.frequency.setValueAtTime(s.f, t);
  if (s.to) osc.frequency.exponentialRampToValueAtTime(s.to, t + s.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(s.gain ?? 0.2, t + (s.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
  if (s.vib) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = s.vib[0];
    depth.gain.value = s.vib[1];
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + s.dur + 0.05);
  }
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + s.dur + 0.05);
}

/** A soft bell: a sine with a quiet octave above it. */
function bell(ctx: BaseAudioContext, out: AudioNode, t0: number, f: number, at: number, dur: number, gain: number) {
  tone(ctx, out, t0, { f, dur, gain, at, attack: 0.004 });
  tone(ctx, out, t0, { f: f * 2, dur: dur * 0.6, gain: gain * 0.28, at, attack: 0.004 });
}

function noise(ctx: BaseAudioContext, out: AudioNode, t0: number, o: { at?: number; dur: number; gain: number; type: BiquadFilterType; freq: number; swell?: boolean }) {
  const t = t0 + (o.at ?? 0);
  const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * o.dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = o.type;
  filter.frequency.value = o.freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + (o.swell ? o.dur * 0.4 : 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t);
}

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const semitones = (base: number, steps: number) => base * Math.pow(2, steps / 12);
export const comboStep = (combo: number) => PENTATONIC[Math.min(Math.max(0, combo), PENTATONIC.length - 1)];

export const RECIPES: Record<SfxName, Recipe> = {
  // a tiny "pip" for taps and buttons
  tap: (c, o, t) => { tone(c, o, t, { f: 880, to: 1320, dur: 0.07, gain: 0.1 }); return 0.12; },

  // an accepted answer: a bubbly "bloop" that climbs the scale as you keep getting them right
  pop: (c, o, t, opts) => {
    const f = semitones(440, comboStep(opts.combo ?? 0));
    tone(c, o, t, { f: f * 0.75, to: f, dur: 0.11, gain: 0.22 });
    tone(c, o, t, { f: f * 2, to: f * 2.4, dur: 0.09, gain: 0.06, type: "triangle" });
    return 0.22;
  },

  // Cinder's happy little squeak
  squeak: (c, o, t) => {
    tone(c, o, t, { f: 1500, to: 2300, dur: 0.07, gain: 0.08, vib: [28, 40] });
    tone(c, o, t, { f: 2300, to: 1800, dur: 0.08, gain: 0.07, at: 0.07, vib: [28, 40] });
    return 0.2;
  },

  // rare: two quick bells (gold)
  rare1: (c, o, t) => {
    bell(c, o, t, 1318.5, 0, 0.5, 0.17);
    bell(c, o, t, 1760, 0.09, 0.55, 0.13);
    return 0.7;
  },

  // ultra rare: a sparkling arpeggio (purple)
  rare2: (c, o, t) => {
    [784, 987.8, 1174.7, 1568].forEach((f, i) => bell(c, o, t, f, i * 0.075, 0.6, 0.15));
    noise(c, o, t, { at: 0.05, dur: 0.3, gain: 0.025, type: "highpass", freq: 6000 });
    return 0.95;
  },

  // insanely rare: a magical run up two octaves and a chime (rainbow)
  rare3: (c, o, t) => {
    [659.3, 784, 880, 987.8, 1174.7, 1318.5, 1568, 1760].forEach((f, i) => bell(c, o, t, f, i * 0.06, 0.65, 0.13));
    tone(c, o, t, { f: 1200, to: 3800, dur: 0.55, gain: 0.04, attack: 0.05 });
    [523.3, 659.3, 784, 1046.5].forEach((f) => tone(c, o, t, { f, dur: 1.0, gain: 0.09, at: 0.5, attack: 0.02 }));
    noise(c, o, t, { at: 0.1, dur: 0.6, gain: 0.03, type: "highpass", freq: 7000 });
    return 1.6;
  },

  // a wrong answer: a soft, wobbly "boop-woop", never harsh
  wrong: (c, o, t) => {
    tone(c, o, t, { f: 360, to: 210, dur: 0.24, gain: 0.22, vib: [16, 10] });
    tone(c, o, t, { f: 180, to: 110, dur: 0.24, gain: 0.1, type: "triangle" });
    return 0.32;
  },

  // the lava heaving: a low gurgle with a few bubbles
  surge: (c, o, t) => {
    noise(c, o, t, { dur: 0.5, gain: 0.16, type: "lowpass", freq: 420, swell: true });
    tone(c, o, t, { f: 120, to: 70, dur: 0.45, gain: 0.12 });
    [520, 740, 620].forEach((f, i) => tone(c, o, t, { f, to: f * 1.5, dur: 0.07, gain: 0.07, at: 0.08 + i * 0.1 }));
    return 0.6;
  },

  // "did you mean...?": a rising two-note question
  suggest: (c, o, t) => {
    tone(c, o, t, { f: 660, dur: 0.1, gain: 0.12 });
    tone(c, o, t, { f: 880, dur: 0.16, gain: 0.12, at: 0.11 });
    return 0.3;
  },

  tick: (c, o, t) => { tone(c, o, t, { f: 1000, dur: 0.05, gain: 0.1, type: "triangle" }); return 0.1; },

  go: (c, o, t) => {
    [784, 1174.7, 1568].forEach((f, i) => bell(c, o, t, f, i * 0.07, 0.4, 0.15));
    return 0.6;
  },

  // heartbeat when the lava is close
  beat: (c, o, t) => {
    tone(c, o, t, { f: 110, to: 70, dur: 0.12, gain: 0.3 });
    tone(c, o, t, { f: 95, to: 60, dur: 0.14, gain: 0.22, at: 0.16 });
    return 0.35;
  },

  // "wah wah wah waaah", gently
  gameover: (c, o, t) => {
    [392, 370, 349].forEach((f, i) => tone(c, o, t, { f, dur: 0.24, gain: 0.17, at: i * 0.26, type: "triangle" }));
    tone(c, o, t, { f: 330, to: 300, dur: 0.8, gain: 0.17, at: 0.78, type: "triangle", vib: [6, 7] });
    return 1.7;
  },

  // a music-box twinkle for the "sleep tight" card
  lullaby: (c, o, t) => {
    [523.3, 659.3, 784, 659.3, 523.3, 392].forEach((f, i) => bell(c, o, t, f, i * 0.3, 0.55, 0.085));
    return 2.3;
  },

  // a little fanfare for a great result
  win: (c, o, t) => {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => bell(c, o, t, f, i * 0.1, 0.5, 0.15));
    [523.3, 659.3, 784, 1046.5].forEach((f) => tone(c, o, t, { f, dur: 1.0, gain: 0.08, at: 0.45, attack: 0.02 }));
    noise(c, o, t, { at: 0.4, dur: 0.5, gain: 0.025, type: "highpass", freq: 6500 });
    return 1.6;
  },
};

// ---- live playback ----------------------------------------------------------------------------------------------

const MUTE_KEY = "pw-muted";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();
const lastPlayed = new Map<string, number>();

const readMuted = (): boolean => {
  if (muted === null) {
    try { muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1"; } catch { muted = false; }
  }
  return muted;
};

/** Browsers only allow sound after a tap or key press, so this is called from the first gesture. */
function unlock() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = readMuted() ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor(); // keeps overlapping sounds from ever clipping
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function play(name: SfxName, opts: SfxOpts = {}) {
  if (typeof window === "undefined" || readMuted()) return;
  unlock();
  if (!ctx || !master || ctx.state !== "running") return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < 35) return; // never stack the same sound on itself
  lastPlayed.set(name, now);
  RECIPES[name](ctx, master, ctx.currentTime + 0.01, opts);
}

function setMuted(next: boolean) {
  muted = next;
  try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* private mode: just not remembered */ }
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.85, ctx.currentTime, 0.02);
  listeners.forEach((l) => l());
}

export const sfx = {
  play,
  unlock,
  isMuted: readMuted,
  setMuted,
  toggle: () => setMuted(!readMuted()),
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

// A hook for checking the sounds in a real browser without needing ears (development only).
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __sfx?: unknown }).__sfx = { RECIPES, state: () => ctx?.state ?? "none", muted: () => readMuted() };
}
