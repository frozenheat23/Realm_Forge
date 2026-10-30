// Step 2, second half (SPEC §4.11): each cell's slow-changing memory of what has happened to it.
import type { Rng } from "../core/rng";
import { Settlement, type CellId, type SimEvent, type WorldState } from "../core/types";
import { clamp } from "../core/math";
import { nameNationAt } from "../gen/nations";
import { traits } from "../gen/races";
import { cityFoundedEvent } from "./events";
import { isCore, takenNames } from "./helpers";
import { SIM } from "./params";
import { effectiveCapacity, grainBonuses } from "./resources";

/** Development needed for each settlement level. */
function threshold(level: number): number {
  if (level === Settlement.Village) return SIM.SETTLE_VILLAGE;
  if (level === Settlement.Town) return SIM.SETTLE_TOWN;
  if (level === Settlement.City) return SIM.SETTLE_CITY;
  return 0;
}

/** Is there a city within CITY_MIN_SPACING − 1 steps of `cell` (over land or water)? */
export function cityNearby(state: WorldState, cell: CellId): boolean {
  const settlement = state.state.settlement;
  const seen = new Set<CellId>([cell]);
  let ring = [cell];
  for (let step = 1; step < SIM.CITY_MIN_SPACING; step++) {
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of state.cells[c]!.neighbors) {
        if (seen.has(n)) continue;
        if (settlement[n] === Settlement.City) return true;
        seen.add(n);
        next.push(n);
      }
    }
    ring = next;
  }
  return false;
}

/**
 * Updates every cell's unrest, devastation, development and settlement for the
 * year. `control` is this year's control map from updateTotals. Returns the
 * year's `city_founded` events.
 *
 * - Unrest grows where the capital's grip is weak, under rulers of another race
 *   and in war-torn land, and fades by itself (twice as fast in core land).
 * - Devastation heals a share of itself every year, owned or not.
 * - Development grows in full, well-held, undamaged land and is worn away by devastation.
 * - Settlements grow a level when development passes the next threshold (towns
 *   and cities also need people; cities need room), and shrink only well below it.
 */
export function updateLand(state: WorldState, control: Float32Array, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const { owner, pop, race, unrest, devastation, development, settlement, occupier } = state.state;
  const grain = grainBonuses(state);
  for (let c = 0; c < owner.length; c++) {
    devastation[c] = devastation[c]! * (1 - SIM.DEVASTATION_HEAL);

    const nation = state.nations.get(owner[c]!);
    if (!nation) continue;
    const ruler = traits(nation.race);
    const foreign = race[c] !== nation.race ? SIM.UNREST_FOREIGN_K / ruler.tolerance : 0;
    const occupied = occupier[c] !== 0 ? SIM.UNREST_OCCUPIED : 0;
    const decay = SIM.UNREST_DECAY * (isCore(state, c) ? 2 : 1);
    unrest[c] = clamp(
      unrest[c]! + SIM.UNREST_CONTROL_K * (1 - control[c]!) + foreign + occupied + SIM.UNREST_DEVASTATION_K * devastation[c]! - decay,
      0,
      1,
    );

    const capacity = effectiveCapacity(state, c, grain);
    const full = capacity > 0 ? Math.min(1, pop[c]! / capacity) : 0;
    development[c] = clamp(
      development[c]! + SIM.DEV_GROWTH * full * control[c]! * (1 - devastation[c]!) - SIM.DEV_DEVASTATION_LOSS * devastation[c]!,
      0,
      1,
    );

    const level = settlement[c]!;
    if (level > 0 && development[c]! < threshold(level) * SIM.SETTLE_DOWN_FACTOR) {
      settlement[c] = level - 1;
    } else if (level < Settlement.City && development[c]! >= threshold(level + 1)) {
      const needsPeople = level + 1 >= Settlement.Town;
      if (needsPeople && full < SIM.SETTLE_MIN_POP_FRACTION) continue;
      if (level + 1 === Settlement.City && cityNearby(state, c)) continue;
      settlement[c] = level + 1;
      if (settlement[c] === Settlement.City && !state.cityNames.has(c)) {
        const [x, y] = state.cells[c]!.site;
        const taken = new Set([...takenNames(state), ...state.cityNames.values()]);
        state.cityNames.set(c, nameNationAt(rng.fork(`city-${c}`), state.cultureHomes, taken, x, y, nation.race));
        events.push(cityFoundedEvent(state.year, state.cityNames.get(c)!, nation));
      }
    }
  }
  return events;
}
