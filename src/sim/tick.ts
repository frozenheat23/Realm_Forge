// One year of history (SPEC §4). Steps always run in this order.
import type { Rng } from "../core/rng";
import type { SimEvent, WorldState } from "../core/types";
import { collapses } from "./collapse";
import { emergence } from "./emergence";
import { expand } from "./expansion";
import { growPopulation } from "./population";
import { rebellions } from "./rebellion";
import { updateStability } from "./stability";
import { updateTotals } from "./totals";

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
  updateTotals(state); //                                 2. Totals
  updateStability(state); //                              3. Stability
  expand(state, year.fork("expansion")); //               4. Expansion
  //                                                      5–6. War (M5)
  events.push(...rebellions(state, year.fork("rebellion"))); // 7. Rebellion
  events.push(...collapses(state)); //                    8. Collapse
  events.push(...emergence(state, year.fork("emergence"))); //  9. Emergence

  state.events.push(...events); //                        10. Events
  return events;
}
