// One year of history (SPEC §4). Steps always run in this order.
import type { Rng } from "../core/rng";
import type { SimEvent, WorldState } from "../core/types";
import { disbandArmies, marchArmies, musterArmies } from "./armies";
import { collapses } from "./collapse";
import { diplomacy } from "./diplomacy";
import { emergence } from "./emergence";
import { expand } from "./expansion";
import { updateLand } from "./land";
import { growPopulation } from "./population";
import { rebellions } from "./rebellion";
import { updateStability } from "./stability";
import { updateTotals } from "./totals";
import { declareWars, fightWars } from "./war";

/**
 * Advances `state` by one year, changing it in place, and returns the events
 * that happened this year (they are also added to `state.events`).
 *
 * `rng` is the simulation's random stream. Each year (and each step within it)
 * gets its own fork, so adding randomness to one step never changes another.
 */
export function tick(state: WorldState, rng: Rng): SimEvent[] {
  state.year += 1;
  const year = rng.fork(`year-${state.year}`);
  const events: SimEvent[] = [];

  growPopulation(state); //                               1. Population
  const control = updateTotals(state); //                 2. Totals
  events.push(...updateLand(state, control, year.fork("land"))); // … and each cell's land
  updateStability(state); //                              3. Stability
  expand(state, year.fork("expansion")); //               4. Expansion
  events.push(...diplomacy(state, year.fork("diplomacy"))); // 4b. Diplomacy
  events.push(...declareWars(state, year.fork("declare"))); //  5. War declared
  musterArmies(state); //                                 5b. Armies raised and reinforced
  marchArmies(state); //                                  6. Armies march
  events.push(...fightWars(state, year.fork("fight"))); //      6b. War fought
  events.push(...rebellions(state, year.fork("rebellion"))); // 7. Rebellion
  events.push(...collapses(state)); //                    8. Collapse
  disbandArmies(state); //                                … armies whose war is over go home
  events.push(...emergence(state, year.fork("emergence"))); //  9. Emergence

  state.events.push(...events); //                        10. Events
  return events;
}
