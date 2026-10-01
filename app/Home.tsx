"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sfx } from "./audio/sfx";
import SoundToggle from "./audio/SoundToggle";
import SkyCanvas from "./scene/SkyCanvas";
import { hms, msUntilTomorrow } from "./time";

interface GenreStatus {
  id: string;
  name: string;
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

/** The front door: one card per genre, all visible at once. Each genre has its own question and one run a day. */
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
  // The card to highlight: a run in progress first, otherwise the first genre not played yet.
  const next = playing ?? genres.find((g) => g.status === "new");
  const allDone = !!data && done === genres.length;

  return (
    <main className="home">
      <div className="sky-fixed"><SkyCanvas /></div>

      <header className="home-head">
        <img className="home-panda" src={`/panda/${allDone ? "love" : "idle"}.png`} alt="Cinder the panda" draggable={false} />
        <div>
          <h1 className="title-main">Pawmpeii</h1>
          <p className="home-tag">
            {data && data.streak.current > 0 && <><span className="streak">{data.streak.current} day streak.</span>{" "}</>}
            {allDone ? "All genres played today." : done > 0 ? `${done} of ${genres.length} played today. Next: ${next?.name}.` : "One question per genre each day. Name as many answers as you can."}
          </p>
        </div>
      </header>

      {!data ? <div className="loader" /> : (
        <>
          <ul className="genre-grid">
            {genres.map((g) => (
              <li key={g.id} className="genre-item">
                <Link
                  href={`/play/${g.id}`}
                  className={`genre-card genre-${g.status}${next?.id === g.id && !allDone ? " genre-next" : ""}`}
                  onClick={() => sfx.play("tap")}
                >
                  <span className="genre-name">{g.name}</span>
                  <span className="genre-prompt">{g.prompt}</span>
                  <span className="genre-status">
                    {g.status === "done" ? <>{g.total} {g.total === 1 ? "answer" : "answers"}{g.rank ? ` · #${g.rank} of ${g.players}` : ""}</>
                      : g.status === "playing" ? "Continue"
                      : next?.id === g.id ? "Play next" : "Play"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="home-foot">
            <span>New questions in <b>{hms(msUntilTomorrow(now))}</b></span>
            <SoundToggle />
          </p>
        </>
      )}
    </main>
  );
}
