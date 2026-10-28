// "Cel-shaded" terrain style: flat elevation bands, 3-step shading and ink lines,
// like a hand-illustrated game map. Only reads the heightmap; never changes it.
import type { Heightmap } from "../gen/heightmap";
import { hexToRgb, mixRgb, scaleRgb, type Rgb } from "./color";
import { hillshade, lightDirection } from "./shading";
import {
  CEL_BAND_LINE_ALPHA,
  CEL_COAST_WIDTH,
  CEL_DEEP_COLOR,
  CEL_FIRST_SHADED_BAND,
  CEL_HIGHLIGHT,
  CEL_INK_COLOR,
  CEL_LAND_BANDS,
  CEL_RIPPLE_COLOR,
  CEL_RIPPLES,
  CEL_SHADE_THRESHOLD,
  CEL_SHADOW,
  CEL_SHALLOW_COLOR,
  CEL_SHALLOW_WIDTH,
  CEL_SMOOTH_RADIUS,
  HILLSHADE_EXAGGERATION,
} from "./palette";

// Box blur: each pixel becomes the average of its neighbors within `radius`.
// Done once across rows, then once down columns (much faster than a square at once).
export function boxBlur(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) {
        sum += src[y * width + k]!;
        count++;
      }
      tmp[y * width + x] = sum / count;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) {
        sum += tmp[k * width + x]!;
        count++;
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

/**
 * For every pixel, roughly how many pixels away the nearest coastline is.
 * Works on land and water alike. Uses a "chamfer" distance: two sweeps over
 * the image (forwards, then backwards), each copying distances from neighbors.
 */
export function distanceToCoast(map: Heightmap): Float32Array {
  const { width, height, data, seaLevel } = map;
  const dist = new Float32Array(width * height).fill(Infinity);
  const isLand = (i: number) => data[i]! > seaLevel;

  // Start: pixels sitting right on the land/water boundary are distance 0.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const land = isLand(i);
      if (
        (x > 0 && isLand(i - 1) !== land) ||
        (x < width - 1 && isLand(i + 1) !== land) ||
        (y > 0 && isLand(i - width) !== land) ||
        (y < height - 1 && isLand(i + width) !== land)
      ) {
        dist[i] = 0;
      }
    }
  }

  const DIAG = Math.SQRT2;
  const relax = (i: number, j: number, cost: number) => {
    if (dist[j]! + cost < dist[i]!) dist[i] = dist[j]! + cost;
  };
  // Forward sweep: look at neighbors above and to the left.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0) relax(i, i - 1, 1);
      if (y > 0) {
        relax(i, i - width, 1);
        if (x > 0) relax(i, i - width - 1, DIAG);
        if (x < width - 1) relax(i, i - width + 1, DIAG);
      }
    }
  }
  // Backward sweep: look at neighbors below and to the right.
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) relax(i, i + 1, 1);
      if (y < height - 1) {
        relax(i, i + width, 1);
        if (x < width - 1) relax(i, i + width + 1, DIAG);
        if (x > 0) relax(i, i + width - 1, DIAG);
      }
    }
  }
  return dist;
}

// Which flat band a land height (0 = coast, 1 = peak) falls into.
function bandIndex(t: number): number {
  for (let b = 0; b < CEL_LAND_BANDS.length; b++) {
    if (t <= CEL_LAND_BANDS[b]!.upTo) return b;
  }
  return CEL_LAND_BANDS.length - 1;
}

export function renderCelTerrain(map: Heightmap): ImageData {
  const { width, height, data, seaLevel } = map;
  const image = new ImageData(width, height);
  const px = image.data;

  // Smoothed heights give clean band edges and calm shading; the coastline
  // itself still uses the original detailed heights.
  const smooth = boxBlur(data, width, height, CEL_SMOOTH_RADIUS);
  const coastDist = distanceToCoast(map);
  const light = lightDirection();

  const bandColors = CEL_LAND_BANDS.map((b) => hexToRgb(b.color));
  const shallow = hexToRgb(CEL_SHALLOW_COLOR);
  const deep = hexToRgb(CEL_DEEP_COLOR);
  const ripple = hexToRgb(CEL_RIPPLE_COLOR);
  const ink = hexToRgb(CEL_INK_COLOR);

  // Band for each land pixel (−1 for water), so we can find band edges.
  const bands = new Int8Array(width * height).fill(-1);
  for (let i = 0; i < data.length; i++) {
    if (data[i]! > seaLevel) bands[i] = bandIndex((smooth[i]! - seaLevel) / (1 - seaLevel));
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dist = coastDist[i]!;
      let rgb: Rgb;

      if (bands[i]! >= 0) {
        // Land: flat band color. Hills and above snap shading to 3 tones;
        // lowlands stay flat so plains (and nation colors later) read cleanly.
        rgb = bandColors[bands[i]!]!;
        if (bands[i]! >= CEL_FIRST_SHADED_BAND) {
          const shade = hillshade(smooth, width, height, x, y, light, HILLSHADE_EXAGGERATION);
          if (shade > CEL_SHADE_THRESHOLD) rgb = scaleRgb(rgb, CEL_HIGHLIGHT);
          else if (shade < -CEL_SHADE_THRESHOLD) rgb = scaleRgb(rgb, CEL_SHADOW);
        }

        // Thin line where this band meets a higher one (to the right or below).
        const right = x < width - 1 ? bands[i + 1]! : -1;
        const down = y < height - 1 ? bands[i + width]! : -1;
        if (right > bands[i]! || down > bands[i]!) rgb = mixRgb(rgb, ink, CEL_BAND_LINE_ALPHA);

        // Bold inked coastline.
        if (dist < CEL_COAST_WIDTH) rgb = ink;
      } else {
        // Water: shallow strip by the coast, flat deep blue beyond, plus ripple lines.
        rgb = dist < CEL_SHALLOW_WIDTH ? shallow : deep;
        for (const r of CEL_RIPPLES) {
          if (Math.abs(dist - r) < 0.75) rgb = ripple;
        }
      }

      const p = i * 4;
      px[p] = rgb[0];
      px[p + 1] = rgb[1];
      px[p + 2] = rgb[2];
      px[p + 3] = 255;
    }
  }
  return image;
}
