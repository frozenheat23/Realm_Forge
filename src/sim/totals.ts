// Step 2 (SPEC §4.2): add up each nation's size, people and strength.
import type { WorldState } from "../core/types";
import { traits } from "../gen/races";
import { cellsByNation } from "./helpers";
import { SIM } from "./params";

export function updateTotals(state: WorldState): void {
  const groups = cellsByNation(state);
  const { pop, race } = state.state;
  for (const nation of state.nations.values()) {
    if (!nation.alive) continue;
    const cells = groups.get(nation.id) ?? [];

    // One pass over the nation's cells adds up everything race-related too.
    let total = 0;
    let militaryPop = 0; // people × how good their race is at fighting
    let foreign = 0; // people who aren't the ruling race
    let unrestSum = 0; // people × their race's unrest
    for (const c of cells) {
      const p = pop[c]!;
      const t = traits(race[c]!);
      total += p;
      militaryPop += p * t.martial;
      unrestSum += p * t.unrest;
      if (race[c] !== nation.race) foreign += p;
    }

    nation.area = cells.length;
    nation.pop = total;
    nation.foreignShare = total > 0 ? foreign / total : 0;
    nation.unrest = total > 0 ? unrestSum / total : traits(nation.race).unrest;
    // Bigger (and more martial) population = stronger, with diminishing returns; a stable nation fights better.
    nation.strength = militaryPop ** SIM.STRENGTH_POP_EXP * (0.5 + nation.stability);
  }
}
