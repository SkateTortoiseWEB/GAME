import { mulberry32 } from "./types";

/** Seamless value noise: a lattice of random values, smoothly interpolated, wrapping at the tile edge. */
function makeNoise(rand: () => number) {
  const lattices = new Map<number, Float32Array>();
  const lattice = (period: number) => {
    let g = lattices.get(period);
    if (!g) { g = Float32Array.from({ length: period * period }, () => rand()); lattices.set(period, g); }
    return g;
  };
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, period: number) => {
    const g = lattice(period);
    const px = x * period, py = y * period;
    const x0 = Math.floor(px), y0 = Math.floor(py);
    const fx = smooth(px - x0), fy = smooth(py - y0);
    const at = (ix: number, iy: number) => g[mod(iy, period) * period + mod(ix, period)];
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/**
 * A seamless tile of smooth, flowing molten rock: domain-warped noise mapped from deep red through orange to
 * bright yellow, with soft glowing streaks. Drawn over the lava body and drifted slowly so the surface seems to flow.
 */
export function makeLavaTile(size = 256, seed = 11): HTMLCanvasElement {
  const noise = makeNoise(mulberry32(seed));
  const fbm = (x: number, y: number) => {
    let sum = 0, amp = 0.5, total = 0;
    for (let o = 0; o < 4; o++) {
      sum += amp * noise(x, y, 2 << o);
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  };

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // Warp the coordinates by more noise so the pattern swirls like a slow current instead of looking like clouds.
      const qx = fbm(u + 0.0, v + 0.0), qy = fbm(u + 0.37, v + 0.71);
      const n = fbm(u + 0.9 * (qx - 0.5), v + 0.9 * (qy - 0.5));
      const streak = Math.pow(1 - Math.abs(2 * fbm(u * 1 + 0.5 * qx, v * 1 + 0.5 * qy + 0.3) - 1), 3); // soft glowing flow lines
      const heat = Math.min(1, Math.max(0, (n - 0.25) * 1.9 + streak * 0.35));

      // deep red -> orange -> bright yellow
      const r = 150 + heat * 105;
      const g = 20 + heat * heat * 200;
      const b = 4 + heat * heat * heat * 90;
      const o = (y * size + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255 * (0.35 + 0.55 * heat); // cooler patches are darker and more solid, hot ones glow
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
