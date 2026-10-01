export interface Streak {
  current: number;
  best: number;
}

const DAY = 86400000;
const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY;

/**
 * `dates` are UTC days (YYYY-MM-DD) the player finished. The current streak stays alive through
 * today even if today hasn't been played yet; it breaks once a full day is missed.
 */
export function computeStreak(dates: string[], today: string): Streak {
  const days = [...new Set(dates.map(toDay))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] - days[i - 1] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const t = toDay(today);
  const last = days[days.length - 1];
  const current = last === t || last === t - 1 ? run : 0;
  return { current, best };
}
