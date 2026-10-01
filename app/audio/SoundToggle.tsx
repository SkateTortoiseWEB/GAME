"use client";

import { useEffect, useSyncExternalStore } from "react";
import { sfx } from "./sfx";

/** The mute button, shown on every screen. It also unlocks audio on the first tap or key press anywhere. */
export default function SoundToggle() {
  const muted = useSyncExternalStore(sfx.subscribe, sfx.isMuted, () => false);

  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  return (
    <button
      className="sound-toggle"
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      aria-pressed={!muted}
      onClick={() => { sfx.toggle(); if (!sfx.isMuted()) sfx.play("tap"); }}
    >
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}
