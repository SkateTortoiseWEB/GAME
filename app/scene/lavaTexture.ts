import { mulberry32 } from "./types";

/**
 * A seamless tile of cooling lava: dark crust plates separated by glowing cracks (Worley noise).
 * Drawn over the lava body and scrolled slowly, so the surface looks like it is slowly churning.
 */
export function makeLavaTile(size = 256, seed = 11): HTMLCanvasElement {
  const grid = 6;
  const rand = mulberry32(seed);
  const pts: [number, number][] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) pts.push([(gx + 0.15 + rand() * 0.7) / grid, (gy + 0.15 + rand() * 0.7) / grid]);
  }
  const plateShade = pts.map(() => rand()); // each plate cools to a slightly different shade

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let d1 = 9;
      let d2 = 9;
      let nearest = 0;
      for (let i = 0; i < pts.length; i++) {
        let dx = Math.abs(u - pts[i][0]);
        let dy = Math.abs(v - pts[i][1]);
        if (dx > 0.5) dx = 1 - dx; // wrap around so the tile repeats without seams
        if (dy > 0.5) dy = 1 - dy;
        const d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; nearest = i; }
        else if (d < d2) d2 = d;
      }
      const edge = (d2 - d1) * grid; // ~0 on a crack, larger inside a plate
      const crack = Math.max(0, 1 - edge / 0.2);
      const glow = crack * crack * (3 - 2 * crack); // smoothstep
      const shade = plateShade[nearest];
      // crust: dark, slightly varied; crack: orange to near-white at the hottest centre
      const cr = 60 + shade * 60, cg = 12 + shade * 14, cb = 4;
      const hr = 255, hg = 120 + glow * 130, hb = 20 + glow * glow * 150;
      const k = Math.min(1, glow * 1.15);
      const o = (y * size + x) * 4;
      img.data[o] = cr * (1 - k) + hr * k;
      img.data[o + 1] = cg * (1 - k) + hg * k;
      img.data[o + 2] = cb * (1 - k) + hb * k;
      img.data[o + 3] = 255 * (0.5 + 0.45 * k); // plates are see-through-ish, cracks are bright and solid
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
