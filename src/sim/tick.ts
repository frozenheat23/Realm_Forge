// One year of history (SPEC §4). Steps always run in this order.
import type { Rng } from "../core/rng";
import type { SimEvent, WorldState } from "../core/types";
import { expand } from "./expansion";
import { growPopulation } from "./population";
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

  growPopulation(state); //                       1. Population
  updateTotals(state); //                         2. Totals
  //                                              3. Stability (M4b)
  expand(state, year.fork("expansion")); //       4. Expansion
  //                                              5–6. War (M5)
  //                                              7–9. Rebellion, collapse, emergence (M4b)

  state.events.push(...events); //                10. Events
  return events;
}
