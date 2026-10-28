// Step 2 (SPEC §4.2): add up each nation's size, people and strength.
import type { WorldState } from "../core/types";
import { cellsByNation } from "./helpers";
import { STRENGTH_POP_EXP } from "./params";

export function updateTotals(state: WorldState): void {
  const groups = cellsByNation(state);
  const pop = state.state.pop;
  for (const nation of state.nations.values()) {
    if (!nation.alive) continue;
    const cells = groups.get(nation.id) ?? [];
    nation.area = cells.length;
    nation.pop = cells.reduce((sum, c) => sum + pop[c]!, 0);
    // Bigger population = stronger, but with diminishing returns; a stable nation fights better.
    nation.strength = nation.pop ** STRENGTH_POP_EXP * (0.5 + nation.stability);
  }
}
