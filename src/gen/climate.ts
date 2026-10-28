// Temperature and moisture for each cell.
import { createNoise2D } from "simplex-noise";
import type { Rng } from "../core/rng";
import { clamp, lerp } from "../core/math";
import {
  COAST_MOISTURE_BONUS,
  COAST_MOISTURE_RANGE,
  EQUATOR_TEMP,
  LAPSE_RATE,
  MOISTURE_NOISE_SCALE,
  POLE_TEMP,
} from "./params";

/**
 * Temperature in °C. Warmest along the middle of the map (the equator),
 * coldest at the top and bottom edges, and colder the higher you go.
 */
export function temperatureAt(y: number, mapHeight: number, elevation: number): number {
  const latitude = Math.abs(y / mapHeight - 0.5) * 2; // 0 at equator, 1 at the poles
  return lerp(EQUATOR_TEMP, POLE_TEMP, latitude) - LAPSE_RATE * elevation;
}

/**
 * How many cell steps each cell is from the nearest water cell (0 for water).
 * Breadth-first search: start at all water cells and spread outwards one ring at a time.
 */
export function stepsFromWater(isLand: boolean[], neighbors: number[][]): Int32Array {
  const steps = new Int32Array(isLand.length).fill(-1);
  const queue: number[] = [];
  isLand.forEach((land, i) => {
    if (!land) {
      steps[i] = 0;
      queue.push(i);
    }
  });
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const n of neighbors[cell]!) {
      if (steps[n] === -1) {
        steps[n] = steps[cell]! + 1;
        queue.push(n);
      }
    }
  }
  return steps;
}

/** Moisture 0..1 per cell: patchy noise, plus a bonus that fades with distance from the coast. */
export function moistureForCells(
  rng: Rng,
  sites: [number, number][],
  coastSteps: Int32Array,
): Float32Array {
  const noise = createNoise2D(rng.next);
  const moisture = new Float32Array(sites.length);
  sites.forEach(([x, y], i) => {
    const nx = x * MOISTURE_NOISE_SCALE;
    const ny = y * MOISTURE_NOISE_SCALE;
    // Two noise layers: broad wet/dry regions plus some smaller variation.
    const n = noise(nx, ny) * 0.7 + noise(nx * 3, ny * 3) * 0.3;
    const coastFade = Math.max(0, 1 - coastSteps[i]! / COAST_MOISTURE_RANGE);
    moisture[i] = clamp((n + 1) / 2 + COAST_MOISTURE_BONUS * coastFade - 0.1, 0, 1);
  });
  return moisture;
}
