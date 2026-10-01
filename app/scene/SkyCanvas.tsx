"use client";

import { useEffect, useRef } from "react";
import { fitCanvas, mulberry32, prefersReducedMotion, type SceneState } from "./types";

interface Constellation {
  /** Points in a 0-1 box and the lines joining them. */
  pts: [number, number][];
  edges: [number, number][];
  /** Centre as a fraction of the screen width, and its height in the sky (px, at zero climb). */
  x: number;
  y: number;
  size: number;
}

const chain = (n: number, from = 0): [number, number][] => Array.from({ length: n - 1 }, (_, i) => [from + i, from + i + 1]);

/** Cinder's own constellation: a panda face made of stars. It sits above the first screen, so you climb up to find it. */
const pandaPts = (): [number, number][] => {
  const ring: [number, number][] = Array.from({ length: 10 }, (_, i) => [0.5 + 0.3 * Math.cos((i / 10) * Math.PI * 2 - Math.PI / 2), 0.58 + 0.3 * Math.sin((i / 10) * Math.PI * 2 - Math.PI / 2)]);
  return [...ring, [0.22, 0.2], [0.78, 0.2], [0.4, 0.55], [0.6, 0.55], [0.5, 0.68]];
};

const CONSTELLATIONS: Constellation[] = [
  { // Cassiopeia
    pts: [[0, 0.2], [0.2, 0.75], [0.5, 0.35], [0.75, 0.8], [1, 0.25]], edges: chain(5), x: 0.1, y: 215, size: 120,
  },
  { // the Big Dipper
    pts: [[0.05, 0.6], [0.22, 0.66], [0.34, 0.5], [0.18, 0.44], [0.52, 0.42], [0.7, 0.3], [0.9, 0.36]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6]], x: 0.82, y: 330, size: 170,
  },
  { // Orion
    pts: [[0.2, 0.1], [0.8, 0.12], [0.38, 0.5], [0.5, 0.52], [0.62, 0.54], [0.22, 0.95], [0.78, 0.92], [0.5, 0.0]],
    edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]], x: 0.09, y: 470, size: 150,
  },
  { // Cygnus, the swan
    pts: [[0.5, 0], [0.5, 0.35], [0.5, 0.7], [0.5, 1], [0.08, 0.3], [0.92, 0.3]],
    edges: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]], x: 0.9, y: 610, size: 130,
  },
  { // the panda: found by climbing
    pts: pandaPts(),
    edges: [...chain(10), [9, 0], [10, 7], [10, 8], [11, 1], [11, 2], [12, 13], [13, 14], [12, 14]], x: 0.5, y: -190, size: 190,
  },
  { // a small W high above
    pts: [[0, 0.7], [0.25, 0.2], [0.5, 0.6], [0.75, 0.15], [1, 0.65]], edges: chain(5), x: 0.28, y: -330, size: 110,
  },
];

const TILE = 1700; // stars repeat vertically, so the sky never runs out as you climb

/**
 * The night sky: twinkling stars in three depths, constellations (one of them a panda), a crescent moon and the
 * occasional shooting star, on a flat dark background. It drifts down slowly as the camera climbs, which makes the tower feel tall.
 */
export default function SkyCanvas({ stateRef }: { stateRef?: React.MutableRefObject<SceneState> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = prefersReducedMotion();
    const rand = mulberry32(2024);
    const stopFit = fitCanvas(canvas);

    const layers = [
      { n: 120, size: [0.5, 1.0], alpha: 0.55, par: 0.05, speed: 1.2 },
      { n: 70, size: [0.8, 1.5], alpha: 0.75, par: 0.1, speed: 1.8 },
      { n: 34, size: [1.2, 2.1], alpha: 0.95, par: 0.17, speed: 2.4 },
    ].map((l) => ({
      ...l,
      stars: Array.from({ length: l.n }, () => ({
        x: rand(), y: rand() * TILE, r: l.size[0] + rand() * (l.size[1] - l.size[0]), phase: rand() * 6.28,
        warm: rand() < 0.2 ? 1 : 0,
      })),
    }));
    let shoot: { x: number; y: number; vx: number; vy: number; age: number } | null = null;
    let nextShoot = 4 + rand() * 6;
    let t = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const dpr = canvas.width / canvas.clientWidth || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const st = stateRef?.current;
      const cam = st?.cam ?? 0;
      const dread = st?.dread ?? 0;
      const shift = Math.max(0, cam) * 0.22;

      ctx.fillStyle = "#0e0d12"; // a flat, near-black night: the stars do the work
      ctx.fillRect(0, 0, W, H);

      for (const l of layers) {
        for (const s of l.stars) {
          const y = (((s.y + shift * l.par * 4.5) % TILE) + TILE) % TILE - 80;
          if (y > H + 4) continue;
          const tw = reduced ? 0.8 : 0.62 + 0.38 * Math.sin(t * l.speed + s.phase);
          ctx.globalAlpha = l.alpha * tw;
          ctx.fillStyle = s.warm ? "#ffd9a8" : "#e8ecff";
          ctx.beginPath();
          ctx.arc(s.x * W, y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // constellations
      const sc = Math.min(1.15, Math.max(0.6, W / 760));
      CONSTELLATIONS.forEach((c, ci) => {
        const size = c.size * sc;
        const cy = c.y + shift;
        if (cy > H + size || cy < -size * 1.3) return;
        const px = c.pts.map(([x, y]) => [c.x * W + (x - 0.5) * size, cy + (y - 0.5) * size] as const);
        const pulse = reduced ? 0.7 : 0.7 + 0.3 * Math.sin(t * 0.9 + ci);
        ctx.strokeStyle = `rgba(190,205,255,${0.2 * pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [a, b] of c.edges) { ctx.moveTo(px[a][0], px[a][1]); ctx.lineTo(px[b][0], px[b][1]); }
        ctx.stroke();
        px.forEach(([x, y], i) => {
          const tw = reduced ? 0.9 : 0.75 + 0.25 * Math.sin(t * 2.1 + i * 1.7 + ci);
          const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
          g.addColorStop(0, `rgba(235,240,255,${0.5 * tw})`);
          g.addColorStop(1, "rgba(235,240,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 7, y - 7, 14, 14);
          ctx.fillStyle = `rgba(255,255,255,${0.95 * tw})`;
          ctx.beginPath();
          ctx.arc(x, y, i % 3 === 0 ? 2.1 : 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // crescent moon
      {
        const mx = W * 0.84;
        const my = 128 + shift * 0.55;
        const r = 30 * sc;
        if (my < H + r * 3) {
          const halo = ctx.createRadialGradient(mx, my, r * 0.6, mx, my, r * 3.2);
          halo.addColorStop(0, "rgba(255,240,205,0.22)");
          halo.addColorStop(1, "rgba(255,240,205,0)");
          ctx.fillStyle = halo;
          ctx.fillRect(mx - r * 3.2, my - r * 3.2, r * 6.4, r * 6.4);
          ctx.fillStyle = "#fff1cf";
          ctx.beginPath();
          ctx.arc(mx, my, r, 0, Math.PI * 2);
          ctx.arc(mx + r * 0.42, my - r * 0.16, r * 0.86, 0, Math.PI * 2, true);
          ctx.fill("evenodd");
        }
      }

      // shooting star
      if (!reduced) {
        nextShoot -= dt;
        if (nextShoot <= 0 && !shoot) {
          shoot = { x: rand() * W * 0.7, y: rand() * H * 0.35, vx: 520 + rand() * 240, vy: 220 + rand() * 120, age: 0 };
          nextShoot = 7 + rand() * 9;
        }
        if (shoot) {
          shoot.age += dt;
          shoot.x += shoot.vx * dt;
          shoot.y += shoot.vy * dt;
          const a = Math.max(0, 1 - shoot.age / 0.8);
          const len = 90;
          const n = Math.hypot(shoot.vx, shoot.vy);
          const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - (shoot.vx / n) * len, shoot.y - (shoot.vy / n) * len);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(shoot.x - (shoot.vx / n) * len, shoot.y - (shoot.vy / n) * len);
          ctx.stroke();
          if (shoot.age > 0.8) shoot = null;
        }
      }

      if (dread > 0.01) { // the sky reddens as the magma closes in
        ctx.fillStyle = `rgba(160,30,12,${0.16 * dread})`;
        ctx.fillRect(0, 0, W, H);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); stopFit(); };
  }, [stateRef]);

  return <canvas ref={ref} className="sky-canvas" aria-hidden />;
}
