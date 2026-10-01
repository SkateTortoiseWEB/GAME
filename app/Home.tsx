"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sfx } from "./audio/sfx";
import SkyCanvas from "./scene/SkyCanvas";
import { hms, msUntilTomorrow } from "./time";

interface GenreStatus {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Today's question for this genre. */
  prompt: string;
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

/** A soft colour for each genre's card (r,g,b). */
const TINT: Record<string, string> = {
  nature: "126,224,160", food: "255,170,110", places: "130,190,255", screen: "255,140,180",
  music: "190,150,255", games: "150,160,255", words: "255,215,120", everything: "255,130,130",
};

/** The front door: one card per genre. Each genre has its own question, one run and its own leaderboard every day. */
export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { fetch("/api/home").then((r) => r.json()).then(setData); }, []);
  useEffect(() => { for (const p of ["idle", "love", "cheer"]) new Image().src = `/panda/${p}.png`; }, []);
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (data && new Date(n).toISOString().slice(0, 10) !== data.date && document.visibilityState === "visible") window.location.reload();
    }, 1000);
    return () => clearInterval(t);
  }, [data]);

  const genres = data?.genres ?? [];
  const done = genres.filter((g) => g.status === "done").length;
  const playing = genres.find((g) => g.status === "playing");
  const upNext = playing ?? genres.find((g) => g.status === "new");
  const allDone = !!data && done === genres.length;
  const pose = allDone ? "love" : playing ? "cheer" : "idle";

  return (
    <main className="home">
      <div className="sky-fixed"><SkyCanvas /></div>

      <header className="home-head">
        <img key={pose} className="home-panda" src={`/panda/${pose}.png`} alt="Cinder the panda" draggable={false} />
        <h1 className="title-main title-bounce" aria-label="Pawmpeii">
          {"Pawmpeii".split("").map((ch, i) => <span key={i} style={{ animationDelay: `${i * 70}ms` }}>{ch}</span>)}
        </h1>
        <p className="home-tag">
          {!data ? "Waking up Cinder…"
            : allDone ? "Cinder is so proud of you! New questions tomorrow."
            : playing ? "Cinder is waiting for you!"
            : done === 0 ? "Pick a pawsome genre and help Cinder stay ahead of the lava!"
            : "Nice! Which genre is next?"}
        </p>
        {data && data.streak.current > 0 && (
          <div className="streak-badge"><span className="fire-icon">🔥</span> {data.streak.current}-day streak</div>
        )}
      </header>

      {!data ? <div className="loader" /> : (
        <>
          {upNext && !allDone && (
            <Link href={`/play/${upNext.id}`} className="up-next" onClick={() => sfx.play("tap")} style={{ "--tint": TINT[upNext.id] ?? "255,170,110" } as React.CSSProperties}>
              <span className="up-next-emoji">{upNext.emoji}</span>
              <span className="up-next-body">
                <span className="up-next-label">{upNext.status === "playing" ? "Continue your run" : done === 0 ? "Start here" : "Up next"}</span>
                <span className="up-next-name">{upNext.name}</span>
                <span className="up-next-prompt">{upNext.prompt}</span>
              </span>
              <span className="up-next-go">▶</span>
            </Link>
          )}

          <div className="paw-tracker" aria-label={`${done} of ${genres.length} genres played today`}>
            {genres.map((g) => <span key={g.id} className={`paw ${g.status === "done" ? "paw-on" : ""}`}>🐾</span>)}
            <span className="paw-count">{done}/{genres.length} today</span>
          </div>

          <ul className="genre-grid">
            {genres.map((g, i) => (
              <li key={g.id} style={{ animationDelay: `${i * 55}ms` }} className="genre-item">
                <Link
                  href={`/play/${g.id}`}
                  className={`genre-card genre-${g.status}`}
                  onClick={() => sfx.play("tap")}
                  style={{ "--tint": TINT[g.id] ?? "255,170,110" } as React.CSSProperties}
                >
                  <span className="genre-emoji">{g.emoji}</span>
                  <span className="genre-name">{g.name}</span>
                  <span className="genre-prompt">{g.prompt}</span>
                  <span className="genre-status">
                    {g.status === "done" ? <>{g.rank === 1 ? "🏆" : "⭐"} <b>{g.total}</b>{g.rank ? <> · #{g.rank} of {g.players}</> : null}</>
                      : g.status === "playing" ? "▶ Continue" : "Play"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="home-foot">New questions in <b>{hms(msUntilTomorrow(now))}</b> 🌙</p>
        </>
      )}
    </main>
  );
}
