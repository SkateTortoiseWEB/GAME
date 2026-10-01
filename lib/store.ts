import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ListEntry } from "./llm";
import type { RunEvent } from "./magma";

export interface Session {
  date: string;
  /** Which genre this run belongs to (see lib/genres.ts). Each genre has one run per device per day. */
  genre: string;
  deviceId: string;
  /** Epoch ms when the run started; null until the player presses start. */
  startedAt: number | null;
  /** Total ms the clock has been stopped while the AI was being asked (see lib/run.ts). */
  pausedMs: number;
  /** Epoch ms an AI check is in flight since, or null. The clock is stopped while this is set. */
  pausedSince: number | null;
  /** Epoch ms the latest counted pause ended, so overlapping checks aren't double-counted. */
  pauseEnd: number;
  /** Answer events, sorted by time. */
  events: RunEvent[];
  submitted: boolean;
}

export interface ScoreRow {
  date: string;
  genre: string;
  deviceId: string;
  handle: string;
  total: number;
  /** How long the player survived, ms. Breaks ties between equal totals. */
  survivedMs: number;
}

export interface BoardEntry {
  handle: string;
  total: number;
  deviceId: string;
  survivedMs: number;
}

export interface Verdict {
  valid: boolean;
  canonical: string | null;
  /** 0-3; missing on verdicts saved before rarity existed. */
  rarity?: number;
}

export interface Store {
  getVerdict(promptId: string, norm: string): Promise<Verdict | null>;
  setVerdict(promptId: string, norm: string, v: Verdict): Promise<void>;
  getSession(date: string, genre: string, deviceId: string): Promise<Session | null>;
  saveSession(s: Session): Promise<void>;
  /** Every genre's run this device has started on a date (for the home screen). */
  sessionsOn(date: string, deviceId: string): Promise<Session[]>;
  getScore(date: string, genre: string, deviceId: string): Promise<ScoreRow | null>;
  /** Every genre's finished score this device has on a date (for the home screen). */
  scoresOn(date: string, deviceId: string): Promise<ScoreRow[]>;
  /** UTC days this device finished a run in the given genre, any order. The streak uses the main question. */
  scoreDates(deviceId: string, genre: string): Promise<string[]>;
  /** False when this device already has a score for that genre and date. */
  saveScore(s: ScoreRow): Promise<boolean>;
  /** A prompt's pre-generated answer list (see lib/learned.ts), or null if none has been made yet. */
  getList(promptId: string): Promise<ListEntry[] | null>;
  setList(promptId: string, entries: ListEntry[]): Promise<void>;
  /** How a genre's finished players compare to a given total on a date. */
  dailyStats(date: string, genre: string, total: number): Promise<{ below: number; equal: number; count: number }>;
  /** 1-based rank for a device's score in a genre on a date (total desc, then survived time desc). */
  rankOf(date: string, genre: string, deviceId: string): Promise<number | null>;
  leaderboard(scope: "daily" | "all", date: string, genre: string, limit: number): Promise<BoardEntry[]>;
  /** Adds one to a named counter and returns the new value (used for the daily AI budget). */
  bumpCounter(key: string): Promise<number>;
}

/**
 * Local-development store. Sessions and scores live in memory (so a restart gives you a fresh day),
 * but LLM verdicts are saved to a file so answers you have already paid to check are never checked again.
 * In production the same job is done by the `verdicts` table in Supabase.
 */
class MemoryStore implements Store {
  private verdictFile = process.env.VERDICT_FILE || ".data/verdicts.json";
  private listFile = process.env.LIST_FILE || ".data/lists.json";
  private persist = process.env.NODE_ENV !== "test";
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  verdicts = new Map<string, Verdict>(this.load(this.verdictFile));
  lists = new Map<string, ListEntry[]>(this.load(this.listFile));

  private load<T>(file: string): [string, T][] {
    if (!this.persist) return [];
    try {
      return existsSync(file) ? Object.entries(JSON.parse(readFileSync(file, "utf8"))) : [];
    } catch {
      return [];
    }
  }

  private save() {
    if (!this.persist || this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      try {
        mkdirSync(dirname(this.verdictFile), { recursive: true });
        writeFileSync(this.verdictFile, JSON.stringify(Object.fromEntries(this.verdicts), null, 1));
        writeFileSync(this.listFile, JSON.stringify(Object.fromEntries(this.lists), null, 1));
      } catch {
        // Read-only filesystem (some hosts): the in-memory cache still works.
      }
    }, 500);
  }

  sessions = new Map<string, Session>();
  scores = new Map<string, ScoreRow>();

  async getVerdict(p: string, n: string) { return this.verdicts.get(`${p}:${n}`) ?? null; }
  async setVerdict(p: string, n: string, v: Verdict) {
    this.verdicts.set(`${p}:${n}`, v);
    this.save();
  }
  counters = new Map<string, number>();
  async bumpCounter(key: string) {
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    return n;
  }
  async getList(promptId: string) { return this.lists.get(promptId) ?? null; }
  async setList(promptId: string, entries: ListEntry[]) {
    this.lists.set(promptId, entries);
    this.save();
  }
  async getSession(d: string, genre: string, id: string) {
    const s = this.sessions.get(`${d}:${genre}:${id}`);
    return s ? structuredClone(s) : null;
  }
  async saveSession(s: Session) { this.sessions.set(`${s.date}:${s.genre}:${s.deviceId}`, structuredClone(s)); }
  async sessionsOn(date: string, deviceId: string) {
    return [...this.sessions.values()].filter((s) => s.date === date && s.deviceId === deviceId).map((s) => structuredClone(s));
  }
  async getScore(d: string, genre: string, id: string) { return this.scores.get(`${d}:${genre}:${id}`) ?? null; }
  async scoresOn(date: string, deviceId: string) {
    return [...this.scores.values()].filter((s) => s.date === date && s.deviceId === deviceId);
  }
  async scoreDates(id: string, genre: string) { return [...this.scores.values()].filter((s) => s.deviceId === id && s.genre === genre).map((s) => s.date); }
  async saveScore(s: ScoreRow) {
    const k = `${s.date}:${s.genre}:${s.deviceId}`;
    if (this.scores.has(k)) return false;
    this.scores.set(k, s);
    return true;
  }
  async dailyStats(date: string, genre: string, total: number) {
    let below = 0, equal = 0, count = 0;
    for (const s of this.scores.values()) {
      if (s.date !== date || s.genre !== genre) continue;
      count++;
      if (s.total < total) below++;
      else if (s.total === total) equal++;
    }
    return { below, equal, count };
  }
  async rankOf(date: string, genre: string, deviceId: string) {
    const me = this.scores.get(`${date}:${genre}:${deviceId}`);
    if (!me) return null;
    let ahead = 0;
    for (const s of this.scores.values()) {
      if (s.date !== date || s.genre !== genre) continue;
      if (s.total > me.total || (s.total === me.total && s.survivedMs > me.survivedMs)) ahead++;
    }
    return ahead + 1;
  }
  async leaderboard(scope: "daily" | "all", date: string, genre: string, limit: number) {
    const totals = new Map<string, BoardEntry>();
    for (const s of this.scores.values()) {
      if (s.genre !== genre || (scope === "daily" && s.date !== date)) continue;
      const cur = totals.get(s.deviceId);
      if (cur) cur.total += s.total;
      else totals.set(s.deviceId, { handle: s.handle, total: s.total, deviceId: s.deviceId, survivedMs: s.survivedMs });
    }
    return [...totals.values()].sort((a, b) => b.total - a.total || b.survivedMs - a.survivedMs).slice(0, limit);
  }
}

class SupabaseStore implements Store {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: SupabaseClient<any>) {}

  async getVerdict(promptId: string, norm: string) {
    const { data } = await this.db.from("verdicts").select("valid, canonical, rarity")
      .eq("prompt_id", promptId).eq("norm", norm).maybeSingle();
    return data ? { valid: data.valid as boolean, canonical: data.canonical as string | null, rarity: (data.rarity as number | null) ?? 0 } : null;
  }
  async setVerdict(promptId: string, norm: string, v: Verdict) {
    await this.db.from("verdicts").upsert({ prompt_id: promptId, norm, valid: v.valid, canonical: v.canonical, rarity: v.rarity ?? 0 });
  }
  async bumpCounter(key: string) {
    const { data, error } = await this.db.rpc("bump_counter", { k: key });
    if (error) throw error;
    return Number(data);
  }
  async getList(promptId: string) {
    const { data } = await this.db.from("prompt_lists").select("answers").eq("prompt_id", promptId).maybeSingle();
    return data ? (data.answers as ListEntry[]) : null;
  }
  async setList(promptId: string, entries: ListEntry[]) {
    await this.db.from("prompt_lists").upsert({ prompt_id: promptId, answers: entries });
  }
  private toSession(row: { date: string; genre: string; device_id: string; run: unknown; submitted: boolean }): Session {
    const run = row.run as { startedAt: number | null; events: RunEvent[]; pausedMs?: number; pausedSince?: number | null; pauseEnd?: number };
    return {
      date: row.date, genre: row.genre, deviceId: row.device_id, startedAt: run.startedAt, events: run.events, submitted: row.submitted,
      pausedMs: run.pausedMs ?? 0, pausedSince: run.pausedSince ?? null, pauseEnd: run.pauseEnd ?? 0,
    };
  }
  async getSession(date: string, genre: string, deviceId: string) {
    const { data } = await this.db.from("sessions").select("date, genre, device_id, run, submitted")
      .eq("date", date).eq("genre", genre).eq("device_id", deviceId).maybeSingle();
    return data ? this.toSession(data) : null;
  }
  async saveSession(s: Session) {
    await this.db.from("sessions").upsert({
      date: s.date, genre: s.genre, device_id: s.deviceId,
      run: { startedAt: s.startedAt, events: s.events, pausedMs: s.pausedMs, pausedSince: s.pausedSince, pauseEnd: s.pauseEnd },
      submitted: s.submitted,
    });
  }
  async sessionsOn(date: string, deviceId: string) {
    const { data } = await this.db.from("sessions").select("date, genre, device_id, run, submitted").eq("date", date).eq("device_id", deviceId);
    return (data ?? []).map((r) => this.toSession(r));
  }
  private toScore(r: { date: string; genre: string; device_id: string; handle: string; total: number; survived_ms: number }): ScoreRow {
    return { date: r.date, genre: r.genre, deviceId: r.device_id, handle: r.handle, total: r.total, survivedMs: r.survived_ms };
  }
  async getScore(date: string, genre: string, deviceId: string) {
    const { data } = await this.db.from("scores").select("date, genre, device_id, handle, total, survived_ms")
      .eq("date", date).eq("genre", genre).eq("device_id", deviceId).maybeSingle();
    return data ? this.toScore(data) : null;
  }
  async scoresOn(date: string, deviceId: string) {
    const { data } = await this.db.from("scores").select("date, genre, device_id, handle, total, survived_ms").eq("date", date).eq("device_id", deviceId);
    return (data ?? []).map((r) => this.toScore(r));
  }
  async scoreDates(deviceId: string, genre: string) {
    const { data } = await this.db.from("scores").select("date")
      .eq("device_id", deviceId).eq("genre", genre).order("date", { ascending: false }).limit(2000);
    return (data ?? []).map((r) => r.date as string);
  }
  async saveScore(s: ScoreRow) {
    const { error } = await this.db.from("scores").insert({
      date: s.date, genre: s.genre, device_id: s.deviceId, handle: s.handle, total: s.total, survived_ms: s.survivedMs,
    });
    return !error;
  }
  private async count(date: string, genre: string, f: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count } = await f(this.db.from("scores").select("*", { count: "exact", head: true }).eq("date", date).eq("genre", genre));
    return (count as number | null) ?? 0;
  }
  async dailyStats(date: string, genre: string, total: number) {
    const [count, below, equal] = await Promise.all([
      this.count(date, genre, (q) => q),
      this.count(date, genre, (q) => q.lt("total", total)),
      this.count(date, genre, (q) => q.eq("total", total)),
    ]);
    return { below, equal, count };
  }
  async rankOf(date: string, genre: string, deviceId: string) {
    const me = await this.getScore(date, genre, deviceId);
    if (!me) return null;
    const [higher, sameTotalLonger] = await Promise.all([
      this.count(date, genre, (q) => q.gt("total", me.total)),
      this.count(date, genre, (q) => q.eq("total", me.total).gt("survived_ms", me.survivedMs)),
    ]);
    return higher + sameTotalLonger + 1;
  }
  async leaderboard(scope: "daily" | "all", date: string, genre: string, limit: number) {
    if (scope === "daily") {
      const { data } = await this.db.from("scores").select("handle, total, device_id, survived_ms")
        .eq("date", date).eq("genre", genre).order("total", { ascending: false }).order("survived_ms", { ascending: false }).limit(limit);
      return (data ?? []).map((r) => ({
        handle: r.handle as string, total: r.total as number, deviceId: r.device_id as string, survivedMs: r.survived_ms as number,
      }));
    }
    const { data } = await this.db.from("all_time_scores").select("handle, total, device_id").eq("genre", genre)
      .order("total", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => ({ handle: r.handle as string, total: r.total as number, deviceId: r.device_id as string, survivedMs: 0 }));
  }
}

const g = globalThis as unknown as { __store?: Store };

export function getStore(): Store {
  if (g.__store) return g.__store;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  g.__store = url && key
    ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }))
    : new MemoryStore();
  return g.__store;
}
