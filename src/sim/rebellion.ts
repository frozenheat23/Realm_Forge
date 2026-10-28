// Step 7 (SPEC §4.6): unstable nations lose far-off provinces to rebels.
import type { Rng } from "../core/rng";
import type { CellId, Nation, SimEvent, WorldState } from "../core/types";
import { rebellionEvent } from "./events";
import { cellsByNation, hopsFromCapital, livingNations } from "./helpers";
import { SIM } from "./params";
import { addNation, mostPopulous } from "./newNation";

/** Grows a region outward from `seed` through `nation`'s cells, up to `max` cells, never taking the capital. */
export function floodFill(state: WorldState, nation: Nation, seed: CellId, max: number): CellId[] {
  const owner = state.state.owner;
  const region: CellId[] = [];
  const seen = new Set<CellId>([seed]);
  const queue = [seed];
  for (let head = 0; head < queue.length && region.length < max; head++) {
    const cell = queue[head]!;
    region.push(cell);
    for (const n of state.cells[cell]!.neighbors) {
      if (!seen.has(n) && owner[n] === nation.id && n !== nation.capital) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return region;
}

/**
 * Tries to start one rebellion in `nation`. Returns the new rebel nation, or
 * null if no province is far enough away or the breakaway would be too small.
 */
export function rebel(state: WorldState, nation: Nation, cells: CellId[], rng: Rng): Nation | null {
  const hops = hopsFromCapital(state, nation);
  // Rebels start far from the capital, or in land the capital can't even reach.
  const candidates = cells.filter((c) => hops[c]! === -1 || hops[c]! >= SIM.REBEL_MIN_CAPITAL_DIST);
  if (candidates.length === 0) return null;

  const region = floodFill(state, nation, rng.pick(candidates), SIM.REBEL_MAX_CELLS);
  if (region.length < SIM.MIN_AREA) return null;

  const rebelNation = addNation(state, rng.fork("name"), mostPopulous(state, region), SIM.REBEL_START_STABILITY, nation.id);
  for (const c of region) state.state.owner[c] = rebelNation.id;
  return rebelNation;
}

export function rebellions(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const groups = cellsByNation(state);
  // Only nations that existed at the start of this step can rebel (not this year's rebels).
  for (const nation of livingNations(state)) {
    if (nation.stability >= SIM.REBEL_THRESHOLD) continue;
    const nationRng = rng.fork(`nation-${nation.id}`);
    if (!nationRng.chance(SIM.REBEL_PROB)) continue;
    const rebelNation = rebel(state, nation, groups.get(nation.id) ?? [], nationRng);
    if (rebelNation) events.push(rebellionEvent(state.year, rebelNation, nation));
  }
  return events;
}
