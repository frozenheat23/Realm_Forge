// Step 7 (SPEC §4.6): unstable nations lose far-off provinces to rebels, subject peoples first.
import type { Rng } from "../core/rng";
import type { CellId, Nation, RaceId, SimEvent, WorldState } from "../core/types";
import { rebellionEvent } from "./events";
import { cellsByNation, hopsFromCapital, livingNations, pairKey } from "./helpers";
import { SIM } from "./params";
import { addNation, mostPopulous } from "./newNation";

/**
 * Grows a region outward from `seed` through `nation`'s cells, up to `max` cells,
 * never taking the capital. Only enters cells of the seed's race: rebels are one people.
 */
export function floodFill(state: WorldState, nation: Nation, seed: CellId, max: number): CellId[] {
  const { owner, race } = state.state;
  const people = race[seed];
  const region: CellId[] = [];
  const seen = new Set<CellId>([seed]);
  const queue = [seed];
  for (let head = 0; head < queue.length && region.length < max; head++) {
    const cell = queue[head]!;
    region.push(cell);
    for (const n of state.cells[cell]!.neighbors) {
      if (!seen.has(n) && owner[n] === nation.id && race[n] === people && n !== nation.capital) {
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
  const farAway = cells.filter((c) => hops[c]! === -1 || hops[c]! >= SIM.REBEL_MIN_CAPITAL_DIST);
  // Subject peoples rise first: if any far-off cell is of another race, the seed is one of those.
  const foreign = farAway.filter((c) => state.state.race[c] !== nation.race);
  const candidates = foreign.length > 0 ? foreign : farAway;
  if (candidates.length === 0) return null;

  const seed = rng.pick(candidates);
  const region = floodFill(state, nation, seed, SIM.REBEL_MAX_CELLS);
  if (region.length < SIM.MIN_AREA) return null;

  // The rebels are ruled by their own people. (`as RaceId`: the typed array only knows it's a number.)
  const rebelRace = state.state.race[seed]! as RaceId;
  const rebelNation = addNation(state, rng.fork("name"), mostPopulous(state, region), SIM.REBEL_START_STABILITY, rebelRace, nation.id);
  for (const c of region) state.state.owner[c] = rebelNation.id;
  // Rebels and their old rulers start out bitter (SPEC §4.12).
  state.relations.set(pairKey(rebelNation.id, nation.id), SIM.REBEL_OPINION);
  return rebelNation;
}

export function rebellions(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const groups = cellsByNation(state);
  // Only nations that existed at the start of this step can rebel (not this year's rebels).
  for (const nation of livingNations(state)) {
    if (nation.stability >= SIM.REBEL_THRESHOLD) continue;
    const nationRng = rng.fork(`nation-${nation.id}`);
    // Restless peoples (high average unrest) rise more often.
    if (!nationRng.chance(SIM.REBEL_PROB * nation.unrest)) continue;
    const rebelNation = rebel(state, nation, groups.get(nation.id) ?? [], nationRng);
    if (rebelNation) events.push(rebellionEvent(state.year, rebelNation, nation));
  }
  return events;
}
