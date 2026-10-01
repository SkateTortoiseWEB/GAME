"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SkyCanvas from "./scene/SkyCanvas";
import { hms, msUntilTomorrow } from "./time";

interface GenreStatus {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  status: "new" | "playing" | "done";
  total?: number;
  rank?: number | null;
  players?: number;
}
interface HomeData {
  date: string;
  streak: { current: number; best: number };
  genres: GenreStatus[];
}

/** The front door: one card per genre. Each genre has its own prompt, one run and its own leaderboard every day. */
export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { fetch("/api/home").then((r) => r.json()).then(setData); }, []);
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (data && new Date(n).toISOString().slice(0, 10) !== data.date && document.visibilityState === "visible") window.location.reload();
    }, 1000);
    return () => clearInterval(t);
  }, [data]);

  const done = data?.genres.filter((g) => g.status === "done").length ?? 0;

  return (
    <main className="home">
      <div className="sky-fixed"><SkyCanvas /></div>
      <header className="home-head">
        <img className="home-panda" src="/panda/idle.png" alt="Cinder the panda" draggable={false} />
        <h1 className="title-main">Pawmpeii</h1>
        <p className="home-tag">One question per genre, every day. Name as many as you can before the magma gets you.</p>
        {data && data.streak.current > 0 && (
          <div className="streak-badge"><span className="fire-icon">🔥</span> {data.streak.current}-Day Streak</div>
        )}
      </header>

      {!data ? <div className="loader" /> : (
        <>
          <p className="home-progress">{done} of {data.genres.length} genres played today</p>
          <ul className="genre-grid">
            {data.genres.map((g) => (
              <li key={g.id}>
                <Link href={`/play/${g.id}`} className={`genre-card genre-${g.status}`}>
                  <span className="genre-emoji">{g.emoji}</span>
                  <span className="genre-name">{g.name}</span>
                  <span className="genre-blurb">{g.blurb}</span>
                  <span className="genre-status">
                    {g.status === "done" ? <>✓ <b>{g.total}</b> answers{g.rank ? <> · #{g.rank} of {g.players}</> : null}</>
                      : g.status === "playing" ? "In progress, tap to continue" : "Play today"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="home-foot">New prompts in <b>{hms(msUntilTomorrow(now))}</b></p>
        </>
      )}
    </main>
  );
}
