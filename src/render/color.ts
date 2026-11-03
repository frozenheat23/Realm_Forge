// Color helpers shared by the renderers.
import { clamp, lerp } from "../core/math";
import type { ColorStop, MapLook } from "./palette";

/** A color as [red, green, blue], each 0..255. */
export type Rgb = [number, number, number];

/** A color pulled toward a map style's tint, so it sits on that map. */
export function lookTint(hex: string, look: MapLook): Rgb {
  return mixRgb(hexToRgb(hex), hexToRgb(look.tintToward), look.tintShare);
}

/** The same color as a string canvases accept. */
export function cssColor(c: Rgb): string {
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
}

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

/** Pre-computes a color ramp into 256 colors so each pixel is just a lookup. */
export function buildRampTable(stops: ColorStop[]): Rgb[] {
  const rgbStops = stops.map((s) => ({ at: s.at, rgb: hexToRgb(s.color) }));
  const table: Rgb[] = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < rgbStops.length - 2 && t > rgbStops[k + 1]!.at) k++;
    const a = rgbStops[k]!;
    const b = rgbStops[k + 1]!;
    table.push(mixRgb(a.rgb, b.rgb, clamp((t - a.at) / (b.at - a.at), 0, 1)));
  }
  return table;
}

/** The ramp color for `t` (0..1). */
export function rampLookup(table: Rgb[], t: number): Rgb {
  return table[Math.round(clamp(t, 0, 1) * 255)]!;
}
