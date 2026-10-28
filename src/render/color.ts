// Color helpers shared by the renderers.
import { lerp } from "../core/math";

/** A color as [red, green, blue], each 0..255. */
export type Rgb = [number, number, number];

/** Turns "#a8c47a" into [168, 196, 122]. */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blends from color `a` (t = 0) to color `b` (t = 1). */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Makes a color brighter (factor > 1) or darker (factor < 1). */
export function scaleRgb(c: Rgb, factor: number): Rgb {
  return [c[0] * factor, c[1] * factor, c[2] * factor];
}
