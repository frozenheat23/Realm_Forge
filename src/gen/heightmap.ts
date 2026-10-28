// Builds the heightmap: one elevation value (0..1) per pixel.
// Pure data, no drawing. render/terrain.ts turns this into colors.
import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import type { Rng } from "../core/rng";
import { lerp, smoothstep } from "../core/math";
import {
  DOMAIN_WARP,
  EDGE_FALLOFF,
  LAND_RATIO,
  NOISE_LACUNARITY,
  NOISE_OCTAVES,
  NOISE_PERSISTENCE,
  NOISE_SCALE,
  RIDGE_STRENGTH,
} from "./params";

export interface Heightmap {
  width: number;
  height: number;
  /** Elevation per pixel, 0..1, stored row by row: index = y * width + x. */
  data: Float32Array;
  /** Heights above this are land. Picked so about LAND_RATIO of the map is land. */
  seaLevel: number;
}

// How many of the biggest octaves get bent by domain warp. The smaller ones are
// left straight, otherwise warping stretches fine detail into streaks.
const WARPED_OCTAVES = 3;

// Fractal noise: several layers ("octaves") of noise added together, each
// smaller and fainter than the last. Big layers make continents, small ones
// make jagged coasts. Returns roughly -1..1.
// `firstOctave` lets us start partway down the stack (used for fine detail).
function fbm(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  firstOctave = 0,
): number {
  let total = 0;
  let amplitude = NOISE_PERSISTENCE ** firstOctave;
  let frequency = NOISE_LACUNARITY ** firstOctave;
  let maxTotal = 0;
  for (let i = firstOctave; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxTotal += amplitude;
    amplitude *= NOISE_PERSISTENCE;
    frequency *= NOISE_LACUNARITY;
  }
  return total / maxTotal;
}

// Ridged noise: folding noise at zero turns smooth hills into sharp crests,
// which look like mountain ranges. Returns 0..1.
function ridged(noise: NoiseFunction2D, x: number, y: number): number {
  const r = 1 - Math.abs(fbm(noise, x, y, 4));
  return r * r;
}

// How far a pixel is from the map center, 0 at the middle, ~1 at the edges.
function edgeDistance(x: number, y: number, width: number, height: number): number {
  const dx = Math.abs((x / width - 0.5) * 2);
  const dy = Math.abs((y / height - 0.5) * 2);
  // Half round, half square: round keeps corners deepest, square makes every edge drop off.
  return 0.5 * (Math.sqrt(dx * dx + dy * dy) / Math.SQRT2) + 0.5 * Math.max(dx, dy);
}

// Rescales all values so the lowest becomes 0 and the highest becomes 1.
function normalize(data: Float32Array): void {
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) data[i] = (data[i]! - min) / range;
}

/**
 * Finds the height where exactly `landRatio` of pixels are above it.
 * Uses a histogram (counting values into buckets) instead of sorting, which is much faster.
 */
export function findSeaLevel(data: Float32Array, landRatio: number): number {
  const buckets = 1024;
  const counts = new Uint32Array(buckets);
  for (const v of data) counts[Math.min(buckets - 1, Math.floor(v * buckets))]!++;

  const targetLand = data.length * landRatio;
  let landSoFar = 0;
  for (let b = buckets - 1; b >= 0; b--) {
    landSoFar += counts[b]!;
    if (landSoFar >= targetLand) return b / buckets;
  }
  return 0;
}

export function generateHeightmap(rng: Rng, width: number, height: number): Heightmap {
  // Separate noise fields, each with its own random stream.
  const baseNoise = createNoise2D(rng.fork("base").next);
  const warpX = createNoise2D(rng.fork("warpX").next);
  const warpY = createNoise2D(rng.fork("warpY").next);
  const ridgeNoise = createNoise2D(rng.fork("ridge").next);

  const data = new Float32Array(width * height);
  // How far domain warp can push a sample point, in noise units.
  const warpReach = DOMAIN_WARP;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x * NOISE_SCALE;
      const ny = y * NOISE_SCALE;

      // Domain warp: nudge where we sample the noise, so coasts bend and swirl.
      const sx = nx + warpReach * fbm(warpX, nx, ny, 3);
      const sy = ny + warpReach * fbm(warpY, nx, ny, 3);

      // Big shapes come from the warped point; fine detail from the original point.
      const shape = fbm(baseNoise, sx, sy, WARPED_OCTAVES);
      const detail = fbm(baseNoise, nx, ny, NOISE_OCTAVES, WARPED_OCTAVES);
      // Lowlands stay fairly smooth (plains); detail grows in the highlands.
      const roughness = 0.06 + 0.3 * smoothstep(-0.1, 0.5, shape);
      const base = (shape + detail * roughness + 1) / 2;
      // Mountain ridges only rise where the land is already fairly high.
      const ridge = ridged(ridgeNoise, sx * 1.5, sy * 1.5) * Math.max(0, base - 0.45);
      const falloff = EDGE_FALLOFF * edgeDistance(x, y, width, height) ** 2;

      data[y * width + x] = lerp(base, base + ridge * 2, RIDGE_STRENGTH) - falloff;
    }
  }

  normalize(data);
  return { width, height, data, seaLevel: findSeaLevel(data, LAND_RATIO) };
}
