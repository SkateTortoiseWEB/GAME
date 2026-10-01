import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Round {
  startedAt: number | null;
  /** Canonical valid answers accepted so far. */
  answers: string[];
}

export interface Session {
  date: string;
  deviceId: string;
  rounds: Round[];
  submitted: boolean;
}

export interface ScoreRow {
  date: string;
  deviceId: string;
  handle: string;
  total: number;
  perRound: number[];
}

export interface BoardEntry {
  handle: string;
  total: number;
  deviceId: string;
}

export interface Verdict {
  valid: boolean;
  canonical: string | null;
}

export interface Store {
  getVerdict(promptId: string, norm: string): Promise<Verdict | null>;
  setVerdict(promptId: string, norm: string, v: Verdict): Promise<void>;
  getSession(date: string, deviceId: string): Promise<Session | null>;
  saveSession(s: Session): Promise<void>;
  getScore(date: string, deviceId: string): Promise<ScoreRow | null>;
  /** False when this device already has a score for the date. */
  saveScore(s: ScoreRow): Promise<boolean>;
  leaderboard(scope: "daily" | "all", date: string, limit: number): Promise<BoardEntry[]>;
}

class MemoryStore implements Store {
  verdicts = new Map<string, Verdict>();
  sessions = new Map<string, Session>();
  scores = new Map<string, ScoreRow>();

  async getVerdict(p: string, n: string) { return this.verdicts.get(`${p}:${n}`) ?? null; }
  async setVerdict(p: string, n: string, v: Verdict) { this.verdicts.set(`${p}:${n}`, v); }
  async getSession(d: string, id: string) {
    const s = this.sessions.get(`${d}:${id}`);
    return s ? structuredClone(s) : null;
  }
  async saveSession(s: Session) { this.sessions.set(`${s.date}:${s.deviceId}`, structuredClone(s)); }
  async getScore(d: string, id: string) { return this.scores.get(`${d}:${id}`) ?? null; }
  async saveScore(s: ScoreRow) {
    const k = `${s.date}:${s.deviceId}`;
    if (this.scores.has(k)) return false;
    this.scores.set(k, s);
    return true;
  }
  async leaderboard(scope: "daily" | "all", date: string, limit: number) {
    const totals = new Map<string, BoardEntry>();
    for (const s of this.scores.values()) {
      if (scope === "daily" && s.date !== date) continue;
      const cur = totals.get(s.deviceId);
      if (cur) cur.total += s.total;
      else totals.set(s.deviceId, { handle: s.handle, total: s.total, deviceId: s.deviceId });
    }
    return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit);
  }
}

class SupabaseStore implements Store {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: SupabaseClient<any>) {}

  async getVerdict(promptId: string, norm: string) {
    const { data } = await this.db.from("verdicts").select("valid, canonical")
      .eq("prompt_id", promptId).eq("norm", norm).maybeSingle();
    return data ? { valid: data.valid as boolean, canonical: data.canonical as string | null } : null;
  }
  async setVerdict(promptId: string, norm: string, v: Verdict) {
    await this.db.from("verdicts").upsert({ prompt_id: promptId, norm, valid: v.valid, canonical: v.canonical });
  }
  async getSession(date: string, deviceId: string) {
    const { data } = await this.db.from("sessions").select("rounds, submitted")
      .eq("date", date).eq("device_id", deviceId).maybeSingle();
    return data ? { date, deviceId, rounds: data.rounds as Round[], submitted: data.submitted as boolean } : null;
  }
  async saveSession(s: Session) {
    await this.db.from("sessions").upsert({
      date: s.date, device_id: s.deviceId, rounds: s.rounds, submitted: s.submitted,
    });
  }
  async getScore(date: string, deviceId: string) {
    const { data } = await this.db.from("scores").select("handle, total, per_round")
      .eq("date", date).eq("device_id", deviceId).maybeSingle();
    return data
      ? { date, deviceId, handle: data.handle as string, total: data.total as number, perRound: data.per_round as number[] }
      : null;
  }
  async saveScore(s: ScoreRow) {
    const { error } = await this.db.from("scores").insert({
      date: s.date, device_id: s.deviceId, handle: s.handle, total: s.total, per_round: s.perRound,
    });
    return !error;
  }
  async leaderboard(scope: "daily" | "all", date: string, limit: number) {
    if (scope === "daily") {
      const { data } = await this.db.from("scores").select("handle, total, device_id")
        .eq("date", date).order("total", { ascending: false }).limit(limit);
      return (data ?? []).map((r) => ({ handle: r.handle as string, total: r.total as number, deviceId: r.device_id as string }));
    }
    const { data } = await this.db.from("all_time_scores").select("handle, total, device_id")
      .order("total", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => ({ handle: r.handle as string, total: r.total as number, deviceId: r.device_id as string }));
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
