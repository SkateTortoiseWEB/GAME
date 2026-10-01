import type { RunEvent } from "@/lib/magma";

export interface Standing { rank: number | null; players: number; percentile: number | null }
export interface Result { total: number; survivedMs: number; standing: Standing }

/** What /api/today returns for one genre. */
export interface Today {
  date: string;
  genre: { id: string; name: string; main: boolean };
  prompt: { id: string; text: string; hint?: string };
  /** The streak, which only the main question counts towards. */
  streak: { current: number; best: number };
  started: boolean;
  elapsedMs: number;
  events: RunEvent[];
  result: Result | null;
}

/** One row of /api/home: a genre with this player's status for today. The first row is the main question. */
export interface HomeGenre {
  id: string;
  name: string;
  main: boolean;
  /** Today's question for this genre. */
  prompt: string;
  status: "new" | "playing" | "done";
  total?: number;
  rank?: number | null;
  players?: number;
}
export interface HomeData {
  date: string;
  streak: { current: number; best: number };
  genres: HomeGenre[];
}

export interface Entry { rank: number; handle: string; total: number; you: boolean }
export type Phase = "loading" | "ready" | "playing" | "done";

export const hrefFor = (genreId: string) => (genreId === "general" ? "/" : `/play/${genreId}`);
