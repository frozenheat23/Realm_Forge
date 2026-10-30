// Step 1 (SPEC §4.1): people multiply toward what the land can hold.
import { Race, type WorldState } from "../core/types";
import { traits } from "../gen/races";
import { SIM } from "./params";
import { effectiveCapacity, grainBonuses } from "./resources";

/**
 * Logistic growth: fast when a cell is nearly empty, slowing to zero as it
 * fills up to what its race can get out of the land. Each race grows at its own pace.
 * Unowned cells hold nobody (and no race, unrest, development or settlement).
 */
export function growPopulation(state: WorldState): void {
  const { pop, owner, race, unrest, development, settlement } = state.state;
  const grain = grainBonuses(state);
  for (let i = 0; i < pop.length; i++) {
    // Abandoned land is emptied of people, unrest and what they built; war damage stays and heals.
    if (owner[i] === 0) {
      race[i] = Race.None;
      unrest[i] = 0;
      development[i] = 0;
      settlement[i] = 0;
      pop[i] = 0;
      continue;
    }
    const capacity = effectiveCapacity(state, i, grain);
    if (capacity <= 0) {
      pop[i] = 0;
      continue;
    }
    const p = pop[i]!;
    // Over capacity (e.g. just devastated) shrinks back toward it the same way.
    pop[i] = p + SIM.POP_GROWTH * traits(race[i]!).growth * p * (1 - p / capacity);
  }
}
