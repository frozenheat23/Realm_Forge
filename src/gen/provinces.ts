// Provinces (SPEC §4.11): land split into regions of about PROVINCE_SIZE cells, made once at generation.
// Rebellions break along them; later they can carry names.
import type { Rng } from "../core/rng";
import type { Cell, CellId } from "../core/types";
import { BIOME_STATS, MOUNTAIN_COST_MULT, PROVINCE_SIZE, RIVER_COST_MULT } from "./params";
import { MinHeap } from "./rivers";

/** How hard a cell is to cross (the same rule the simulation uses, without race). */
function travelCost(cell: Cell): number {
  return BIOME_STATS[cell.biome].moveCost * (cell.mountain ? MOUNTAIN_COST_MULT : 1) * (cell.river ? RIVER_COST_MULT : 1);
}

/**
 * Seeds are at least this many land steps apart. Measured on real maps,
 * provinces come out at about spacing² cells, so spacing = √PROVINCE_SIZE.
 */
export function provinceSpacing(): number {
  return Math.max(1, Math.round(Math.sqrt(PROVINCE_SIZE)));
}

/**
 * Gives every land cell a province id (water gets −1), filling `cell.province`.
 * 1. Seeds: land cells in random order, each kept only if no earlier seed is
 *    within provinceSpacing() steps over land (so every island gets its own).
 * 2. Every seed grows outward at once by travel cost, so mountains and marshes
 *    tend to become province borders. Returns how many provinces there are.
 */
export function placeProvinces(rng: Rng, cells: Cell[], spacing = provinceSpacing()): number {
  for (const cell of cells) cell.province = -1;
  const land = cells.filter((c) => c.isLand).map((c) => c.id);
  // Shuffle (Fisher–Yates) so seeds aren't biased toward any corner.
  for (let i = land.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [land[i], land[j]] = [land[j]!, land[i]!];
  }

  const tooClose = new Uint8Array(cells.length);
  const seeds: CellId[] = [];
  for (const id of land) {
    if (tooClose[id]) continue;
    seeds.push(id);
    // Mark land within `spacing` − 1 steps (walking over land only).
    const dist = new Map<CellId, number>([[id, 0]]);
    const queue = [id];
    tooClose[id] = 1;
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!;
      if (dist.get(c)! + 1 >= spacing) continue;
      for (const n of cells[c]!.neighbors) {
        if (dist.has(n) || !cells[n]!.isLand) continue;
        dist.set(n, dist.get(c)! + 1);
        tooClose[n] = 1;
        queue.push(n);
      }
    }
  }

  // Grow all provinces at once, cheapest travel first (Dijkstra from many starts).
  const cost = new Float64Array(cells.length).fill(Infinity);
  const heap = new MinHeap();
  seeds.forEach((id, province) => {
    cells[id]!.province = province;
    cost[id] = 0;
    heap.push(id, 0);
  });
  while (heap.size > 0) {
    const c = heap.pop();
    for (const n of cells[c]!.neighbors) {
      if (!cells[n]!.isLand) continue;
      const next = cost[c]! + travelCost(cells[n]!);
      if (next < cost[n]!) {
        cost[n] = next;
        cells[n]!.province = cells[c]!.province;
        heap.push(n, next);
      }
    }
  }
  return seeds.length;
}
