// Works out where water flows, then traces rivers from wet highlands to the sea.
import type { Rng } from "../core/rng";
import { RIVER_MIN_LENGTH, RIVER_SOURCE_MIN_H, RIVER_SOURCE_MOISTURE, RIVER_SOURCE_PROB } from "./params";

/**
 * For each land cell, the neighbor its water drains into (−1 for water cells).
 *
 * "Priority flood": start from every water cell and grow inland, always
 * visiting the lowest unvisited cell next. Each cell drains back toward the
 * cell it was reached from. This always finds a way to the sea, even out of
 * dips in the terrain where a plain "go downhill" rule would get stuck.
 */
export function drainageMap(heights: Float32Array, isLand: boolean[], neighbors: number[][]): Int32Array {
  const downstream = new Int32Array(heights.length).fill(-1);
  const visited = new Uint8Array(heights.length);
  const queue = new MinHeap();

  isLand.forEach((land, i) => {
    if (!land) {
      visited[i] = 1;
      queue.push(i, heights[i]!);
    }
  });

  while (queue.size > 0) {
    const cell = queue.pop();
    for (const n of neighbors[cell]!) {
      if (visited[n]) continue;
      visited[n] = 1;
      downstream[n] = cell;
      queue.push(n, heights[n]!);
    }
  }
  return downstream;
}

/** Number of cells from `start` to the sea, following `downstream`. */
function pathLength(start: number, downstream: Int32Array): number {
  let length = 0;
  for (let c = start; c !== -1; c = downstream[c]!) length++;
  return length;
}

/**
 * How many river sources flow through each cell. 0 = no river.
 * Rivers that meet simply add up, so big rivers form where streams join.
 */
export function traceRivers(
  rng: Rng,
  elevation: Float32Array,
  moisture: Float32Array,
  downstream: Int32Array,
): Uint16Array {
  const flow = new Uint16Array(elevation.length);
  for (let i = 0; i < elevation.length; i++) {
    const eligible = elevation[i]! > RIVER_SOURCE_MIN_H && moisture[i]! > RIVER_SOURCE_MOISTURE;
    if (!eligible || !rng.chance(RIVER_SOURCE_PROB)) continue;
    if (pathLength(i, downstream) < RIVER_MIN_LENGTH) continue;
    for (let c = i; downstream[c] !== -1; c = downstream[c]!) flow[c]!++;
  }
  return flow;
}

/**
 * A min-heap: a list that always hands back its smallest item first, quickly.
 * Stored as a tree squashed into an array: item k's children sit at 2k+1 and 2k+2.
 */
export class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, key: number): void {
    this.ids.push(id);
    this.keys.push(key);
    let k = this.ids.length - 1;
    // Bubble up while smaller than the parent.
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.keys[parent]! <= this.keys[k]!) break;
      this.swap(k, parent);
      k = parent;
    }
  }

  pop(): number {
    const top = this.ids[0]!;
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      // Sink down while bigger than a child.
      let k = 0;
      for (;;) {
        const left = 2 * k + 1;
        const right = left + 1;
        let smallest = k;
        if (left < this.ids.length && this.keys[left]! < this.keys[smallest]!) smallest = left;
        if (right < this.ids.length && this.keys[right]! < this.keys[smallest]!) smallest = right;
        if (smallest === k) break;
        this.swap(k, smallest);
        k = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b]!, this.ids[a]!];
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
  }
}
