/** What the scene canvases need each frame. Written by the game loop, read by the canvases (no React re-renders). */
export interface SceneState {
  /** Height of the lava surface above the bottom of the world, px (already eased). */
  level: number;
  /** How far the camera has climbed, px. */
  cam: number;
  /** 0 = calm, 1 = the magma is about to catch Cinder. */
  dread: number;
  /** Counts up every time the magma surges (a wrong answer); a change triggers a splash. */
  surge: number;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Canvas that tracks its parent's size and the device pixel ratio (capped, to keep phones fast). */
export function fitCanvas(canvas: HTMLCanvasElement, onResize?: () => void): () => void {
  const parent = canvas.parentElement!;
  const apply = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    onResize?.();
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(parent);
  return () => ro.disconnect();
}
