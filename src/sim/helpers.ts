// Small lookups several simulation steps need.
import type { Rng } from "../core/rng";
import { Race, type Cell, type CellId, type Nation, type NationId, type RaceId, type WorldState } from "../core/types";
import { BIOME_STATS, MOUNTAIN_COST_MULT, RIVER_COST_MULT } from "../gen/params";
import { raceTerrainCost } from "../gen/races";
import { SIM } from "./params";

/** Every living nation's cells, grouped by nation. */
export function cellsByNation(state: WorldState): Map<NationId, CellId[]> {
  const groups = new Map<NationId, CellId[]>();
  for (const nation of state.nations.values()) if (nation.alive) groups.set(nation.id, []);
  state.state.owner.forEach((owner, cell) => {
    if (owner !== 0) groups.get(owner)?.push(cell);
  });
  return groups;
}

/**
 * Hands `cell` to nation `id` (0 = nobody), remembering who had it before and
 * since when. Every change of owner in the simulation goes through here.
 */
export function setOwner(state: WorldState, cell: CellId, id: NationId): void {
  const s = state.state;
  if (s.owner[cell] === id) return;
  s.prevOwner[cell] = s.owner[cell]!;
  s.ownedSince[cell] = state.year;
  s.owner[cell] = id;
}

/** Cells held for at least SIM.CORE_YEARS are the nation's heartland. */
export function isCore(state: WorldState, cell: CellId): boolean {
  return state.year - state.state.ownedSince[cell]! >= SIM.CORE_YEARS;
}

/** A random item where item i is picked with chance weights[i] / total. Uniform if every weight is 0. */
export function weightedPick<T>(rng: Rng, items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return rng.pick(items);
  let target = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    target -= weights[i]!;
    if (target <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** One number per pair of nations, the same whichever order they're given in. */
export function pairKey(a: NationId, b: NationId): number {
  return Math.min(a, b) * 100000 + Math.max(a, b);
}

/** Every pair of living nations whose land touches, smallest ids first. */
export function neighborPairs(state: WorldState): [NationId, NationId][] {
  const owner = state.state.owner;
  const seen = new Set<number>();
  const pairs: [NationId, NationId][] = [];
  for (const cell of state.cells) {
    const a = owner[cell.id]!;
    if (a === 0) continue;
    for (const n of cell.neighbors) {
      const b = owner[n]!;
      if (b === 0 || b === a) continue;
      const key = pairKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([Math.min(a, b), Math.max(a, b)]);
    }
  }
  return pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

/** Living nations in id order. Always looping in the same order keeps results repeatable. */
export function livingNations(state: WorldState): Nation[] {
  return [...state.nations.values()].filter((n) => n.alive).sort((a, b) => a.id - b.id);
}

/**
 * How hard a cell is to move into (SPEC §4.4). Higher = harder.
 * With a race, that race's terrain cost applies too (dwarves cross mountains easily).
 */
export function moveCost(cell: Cell, race: RaceId = Race.None): number {
  return (
    BIOME_STATS[cell.biome].moveCost *
    (cell.mountain ? MOUNTAIN_COST_MULT : 1) *
    (cell.river ? RIVER_COST_MULT : 1) *
    (race === Race.None ? 1 : raceTerrainCost(cell, race))
  );
}

/**
 * Steps from the nation's capital to each of its cells, walking only through
 * its own land. −1 = can't be reached that way (e.g. an island it owns).
 */
export function hopsFromCapital(state: WorldState, nation: Nation): Int32Array {
  const { cells } = state;
  const owner = state.state.owner;
  const hops = new Int32Array(cells.length).fill(-1);
  if (owner[nation.capital] !== nation.id) return hops;

  hops[nation.capital] = 0;
  const queue = [nation.capital];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const n of cells[cell]!.neighbors) {
      if (hops[n] === -1 && owner[n] === nation.id) {
        hops[n] = hops[cell]! + 1;
        queue.push(n);
      }
    }
  }
  return hops;
}

/** All names in use, living or dead, so new nations never repeat one. */
export function takenNames(state: WorldState): Set<string> {
  return new Set([...state.nations.values()].map((n) => n.name));
}

/** The next unused nation id. */
export function nextNationId(state: WorldState): NationId {
  let max = 0;
  for (const id of state.nations.keys()) max = Math.max(max, id);
  return max + 1;
}
