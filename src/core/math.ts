// Small math helpers shared across the project.

/** Keeps `value` between `min` and `max`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Blends from `a` (t = 0) to `b` (t = 1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth 0..1 curve between `edge0` and `edge1` (eases in and out). */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
