// Step 2 (SPEC §4.2): add up each nation's size, people, strength and grip on its land.
import { Resource, type WorldState } from "../core/types";
import { traits } from "../gen/races";
import { controlMap } from "./control";
import { cellsByNation } from "./helpers";
import { updateManpower } from "./manpower";
import { SIM } from "./params";
import { emptyAccess, resourceBonus } from "./resources";

/** Updates every living nation's totals. Returns this year's control map (used again later in the year). */
export function updateTotals(state: WorldState): Float32Array {
  const groups = cellsByNation(state);
  const control = controlMap(state);
  const { pop, race, occupier } = state.state;
  for (const nation of state.nations.values()) {
    if (!nation.alive) continue;
    const cells = groups.get(nation.id) ?? [];

    // One pass over the nation's cells adds up everything race-related too.
    let total = 0;
    let militaryPop = 0; // people × how good their race is at fighting
    let levyPop = 0; // the same, but only as much as the nation controls them (who it can call up)
    let foreign = 0; // people who aren't the ruling race
    let unrestSum = 0; // people × their race's unrest
    let controlSum = 0; // people × how firmly they're held
    const access = emptyAccess(); // total richness of each resource the nation owns
    for (const c of cells) {
      const p = pop[c]!;
      const t = traits(race[c]!);
      total += p;
      militaryPop += p * t.martial;
      if (occupier[c] === 0) levyPop += p * t.martial * control[c]!; // no recruits from occupied land
      unrestSum += p * t.unrest;
      controlSum += p * control[c]!;
      if (race[c] !== nation.race) foreign += p;
      const deposit = state.cells[c]!.resource;
      if (deposit !== 0 && occupier[c] === 0) access[deposit] = access[deposit]! + state.cells[c]!.richness;
    }
    nation.access = access;
    militaryPop *= resourceBonus(nation, Resource.Iron); // iron arms the troops

    nation.area = cells.length;
    nation.pop = total;
    nation.foreignShare = total > 0 ? foreign / total : 0;
    nation.unrest = total > 0 ? unrestSum / total : traits(nation.race).unrest;
    nation.control = total > 0 ? controlSum / total : 1;
    // Bigger (and more martial) population = stronger, with diminishing returns; a stable nation fights better.
    nation.strength = militaryPop ** SIM.STRENGTH_POP_EXP * (0.5 + nation.stability);
    updateManpower(state, nation, levyPop * resourceBonus(nation, Resource.Iron));
  }
  return control;
}
