// Small lookups several simulation steps need.
import type { Cell, CellId, Nation, NationId, WorldState } from "../core/types";
import { BIOME_STATS, MOUNTAIN_COST_MULT, RIVER_COST_MULT } from "../gen/params";

/** Every living nation's cells, grouped by nation. */
export function cellsByNation(state: WorldState): Map<NationId, CellId[]> {
  const groups = new Map<NationId, CellId[]>();
  for (const nation of state.nations.values()) if (nation.alive) groups.set(nation.id, []);
  state.state.owner.forEach((owner, cell) => {
    if (owner !== 0) groups.get(owner)?.push(cell);
  });
  return groups;
}

/** Living nations in id order. Always looping in the same order keeps results repeatable. */
export function livingNations(state: WorldState): Nation[] {
  return [...state.nations.values()].filter((n) => n.alive).sort((a, b) => a.id - b.id);
}

/** How hard a cell is to move into (SPEC §4.4). Higher = harder. */
export function moveCost(cell: Cell): number {
  return (
    BIOME_STATS[cell.biome].moveCost *
    (cell.mountain ? MOUNTAIN_COST_MULT : 1) *
    (cell.river ? RIVER_COST_MULT : 1)
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
