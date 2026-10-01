"use client";

import { useEffect, useRef } from "react";
import { makeLavaTile } from "./lavaTexture";
import { fitCanvas, mulberry32, prefersReducedMotion, type SceneState } from "./types";

interface Ember { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hot: boolean; seed: number }
interface Bubble { x: number; d: number; v: number; r: number }
interface Pop { x: number; y: number; age: number }

/**
 * The lava: a see-through body (so submerged blocks show through, tinted and dim), a wavy glowing surface, cooling
 * plates with glowing cracks that drift, bubbles that pop, and embers that rise off the surface and light up the air.
 * `fixedSurface` pins the surface at a fraction of the screen height (used behind the game-over screen).
 */
export default function LavaCanvas({ stateRef, fixedSurface }: { stateRef: React.MutableRefObject<SceneState>; fixedSurface?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = prefersReducedMotion();
    const tile = makeLavaTile(256);
    const pattern = ctx.createPattern(tile, "repeat")!;
    const rand = mulberry32(Math.floor(Math.random() * 1e9));
    const stopFit = fitCanvas(canvas);

    const embers: Ember[] = [];
    const bubbles: Bubble[] = [];
    const pops: Pop[] = [];
    let splash = 0;
    let lastSurge = stateRef.current.surge;
    let emberDebt = 0;
    let bubbleDebt = 0;
    let t = 0;
    let last = performance.now();
    let raf = 0;

    const drawTile = (W: number, H: number, ox: number, oy: number, scale: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      ctx.fillStyle = pattern;
      ctx.fillRect(-ox / scale, -oy / scale, W / scale + 2, H / scale + 2);
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const dpr = canvas.width / canvas.clientWidth || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const st = stateRef.current;
      const dread = fixedSurface !== undefined ? 0.3 : st.dread;
      const base = fixedSurface !== undefined ? H * fixedSurface : H + st.cam - st.level; // screen y of the surface
      const visible = base < H + 24;

      if (st.surge !== lastSurge) { // a wrong answer: the lava heaves and spits
        lastSurge = st.surge;
        splash = 1;
        if (visible) for (let i = 0; i < (reduced ? 6 : 34); i++) {
          const x = rand() * W;
          embers.push({ x, y: base, vx: (rand() - 0.5) * 120, vy: -(90 + rand() * 190), life: 0, max: 0.9 + rand() * 1.4, size: 1.2 + rand() * 2.4, hot: rand() < 0.5, seed: rand() * 9 });
        }
      }
      splash = Math.max(0, splash - dt * 1.1);
      const amp = (reduced ? 0.4 : 1) * (1 + dread * 0.9) + splash * 2.4;
      const waveY = (x: number) =>
        base + amp * (3.2 * Math.sin(x * 0.017 + t * 1.2) + 2.1 * Math.sin(x * 0.043 - t * 1.8 + 1.7) + 1.1 * Math.sin(x * 0.11 + t * 2.9)) +
        splash * 9 * Math.sin(x * 0.03 - t * 6);

      // Light cast into the air above the lava (or up from below the screen edge while it is still out of sight).
      ctx.globalCompositeOperation = "lighter";
      if (visible) {
        const g = ctx.createLinearGradient(0, base - 300, 0, base + 10);
        g.addColorStop(0, "rgba(255,110,25,0)");
        g.addColorStop(1, `rgba(255,110,25,${0.26 + 0.28 * dread})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, base - 300, W, 310);
      } else {
        const a = Math.max(0, 1 - (base - H) / 700) * (0.2 + 0.32 * dread);
        if (a > 0.005) {
          const g = ctx.createLinearGradient(0, H - 260, 0, H);
          g.addColorStop(0, "rgba(255,90,20,0)");
          g.addColorStop(1, `rgba(255,100,25,${a})`);
          ctx.fillStyle = g;
          ctx.fillRect(0, H - 260, W, 260);
        }
      }
      ctx.globalCompositeOperation = "source-over";

      if (visible) {
        // ---- the body, clipped to the wavy surface ----
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, H + 12);
        for (let x = 0; x <= W + 6; x += 6) ctx.lineTo(x, waveY(x));
        ctx.lineTo(W, H + 12);
        ctx.closePath();
        ctx.clip();

        // Thin near the surface and dense with depth, so blocks just under the surface show through and deep ones fade away.
        const body = ctx.createLinearGradient(0, base - 12, 0, base + 700);
        body.addColorStop(0, "rgba(255,176,48,0.6)");
        body.addColorStop(0.1, "rgba(238,98,16,0.68)");
        body.addColorStop(0.4, "rgba(150,30,6,0.78)");
        body.addColorStop(1, "rgba(60,8,0,0.9)");
        ctx.fillStyle = body;
        ctx.fillRect(0, base - 20, W, H + 40);

        // Cooling plates and glowing cracks, drifting at two depths so the surface seems to churn.
        const drift = reduced ? 0 : t;
        drawTile(W, H, drift * 11, base + 4, 1.15, 0.44);
        drawTile(W, H, 90 - drift * 6, base * 0.6 + 50, 2.3, 0.24);

        const deep = ctx.createLinearGradient(0, base, 0, base + 520);
        deep.addColorStop(0, "rgba(30,4,0,0)");
        deep.addColorStop(1, "rgba(30,4,0,0.32)");
        ctx.fillStyle = deep;
        ctx.fillRect(0, base, W, H);

        const band = ctx.createLinearGradient(0, base - 4, 0, base + 34); // the molten edge
        band.addColorStop(0, "rgba(255,238,160,0.9)");
        band.addColorStop(1, "rgba(255,150,40,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, base - 6, W, 42);

        // Bubbles rise and pop.
        bubbleDebt += (reduced ? 0.4 : 1.5) * dt;
        while (bubbleDebt >= 1) {
          bubbleDebt -= 1;
          if (bubbles.length < 14) bubbles.push({ x: rand() * W, d: 40 + rand() * 180, v: 22 + rand() * 34, r: 2 + rand() * 5 });
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.d -= b.v * dt;
          b.x += Math.sin(t * 2 + i) * 4 * dt;
          const y = waveY(b.x) + b.d;
          if (b.d <= 1) {
            pops.push({ x: b.x, y: waveY(b.x), age: 0 });
            for (let k = 0; k < (reduced ? 0 : 3); k++) embers.push({ x: b.x, y: waveY(b.x), vx: (rand() - 0.5) * 70, vy: -(40 + rand() * 90), life: 0, max: 0.6 + rand() * 0.8, size: 1 + rand() * 1.4, hot: true, seed: rand() * 9 });
            bubbles.splice(i, 1);
            continue;
          }
          ctx.beginPath();
          ctx.arc(b.x, y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,200,100,0.14)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,226,150,0.55)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.35, y - b.r * 0.35, Math.max(0.6, b.r * 0.22), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,245,200,0.75)";
          ctx.fill();
        }
        ctx.restore();

        // ---- the glowing surface line ----
        ctx.beginPath();
        for (let x = 0; x <= W + 6; x += 6) (x === 0 ? ctx.moveTo(x, waveY(x)) : ctx.lineTo(x, waveY(x)));
        ctx.lineWidth = 9;
        ctx.strokeStyle = "rgba(255,120,20,0.4)";
        ctx.stroke();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = "#ffe7a0";
        ctx.shadowColor = "#ff7a1a";
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;

        for (let i = pops.length - 1; i >= 0; i--) { // little rings where bubbles burst
          const p = pops[i];
          p.age += dt;
          if (p.age > 0.3) { pops.splice(i, 1); continue; }
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 3 + p.age * 36, 1 + p.age * 9, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,230,160,${0.7 * (1 - p.age / 0.3)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // ---- embers lift off the surface ----
        emberDebt += (reduced ? 3 : 22 + dread * 40) * (W / 390) * dt;
        while (emberDebt >= 1) {
          emberDebt -= 1;
          if (embers.length < 280) {
            const x = rand() * W;
            embers.push({ x, y: waveY(x) - rand() * 4, vx: (rand() - 0.5) * 34, vy: -(24 + rand() * 78), life: 0, max: 1.6 + rand() * 2.4, size: 1.1 + rand() * 2.3, hot: rand() < 0.3, seed: rand() * 9 });
          }
        }
      }

      ctx.globalCompositeOperation = "lighter";
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life += dt;
        if (e.life >= e.max) { embers.splice(i, 1); continue; }
        e.x += (e.vx + Math.sin(t * 1.7 + e.seed * 3) * 12) * dt;
        e.y += e.vy * dt;
        e.vy *= 1 - 0.18 * dt;
        const k = e.life / e.max;
        const flicker = 0.65 + 0.35 * Math.sin(t * 19 + e.seed * 5);
        const a = Math.min(1, (1 - k) * flicker * 1.25);
        const r = e.size * (1 - 0.5 * k);
        ctx.fillStyle = e.hot ? `rgba(255,214,110,${a})` : `rgba(255,128,32,${a})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (e.hot) {
          ctx.fillStyle = `rgba(255,150,40,${a * 0.26})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); stopFit(); };
  }, [stateRef, fixedSurface]);

  return <canvas ref={ref} className="lava-canvas" aria-hidden />;
}
