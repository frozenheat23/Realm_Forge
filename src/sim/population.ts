// Step 1 (SPEC §4.1): people multiply toward what the land can hold.
import type { WorldState } from "../core/types";
import { POP_GROWTH } from "./params";

/**
 * Logistic growth: fast when a cell is nearly empty, slowing to zero as it
 * fills up to its capacity. Unowned cells hold nobody.
 * (War losses on the front line are added in M5.)
 */
export function growPopulation(state: WorldState): void {
  const { pop, owner } = state.state;
  for (let i = 0; i < pop.length; i++) {
    const capacity = state.cells[i]!.capacity;
    if (owner[i] === 0 || capacity <= 0) {
      pop[i] = 0;
      continue;
    }
    const p = pop[i]!;
    pop[i] = p + POP_GROWTH * p * (1 - p / capacity);
  }
}
