// Step 1 (SPEC §4.1): people multiply toward what the land can hold.
import { Race, type WorldState } from "../core/types";
import { raceCapacity, traits } from "../gen/races";
import { SIM } from "./params";
import { allFrontCells } from "./war";

/**
 * Logistic growth: fast when a cell is nearly empty, slowing to zero as it
 * fills up to what its race can get out of the land. Each race grows at its own pace.
 * Unowned cells hold nobody (and no race).
 * Cells on an active war front lose SIM.WAR_ATTRITION of their people.
 */
export function growPopulation(state: WorldState): void {
  const { pop, owner, race } = state.state;
  const front = state.wars.length > 0 ? allFrontCells(state) : new Set<number>();
  for (let i = 0; i < pop.length; i++) {
    if (owner[i] === 0) race[i] = Race.None;
    const capacity = raceCapacity(state.cells[i]!, race[i]!);
    if (owner[i] === 0 || capacity <= 0) {
      pop[i] = 0;
      continue;
    }
    const p = pop[i]!;
    pop[i] = p + SIM.POP_GROWTH * traits(race[i]!).growth * p * (1 - p / capacity);
    if (front.has(i)) pop[i] = pop[i]! * (1 - SIM.WAR_ATTRITION);
  }
}
