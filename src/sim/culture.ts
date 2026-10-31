// Step 2, after the land (SPEC §4.14): conquered peoples slowly take on their rulers' ways.
import type { Rng } from "../core/rng";
import type { WorldState } from "../core/types";
import { traits } from "../gen/races";
import { isCore } from "./helpers";
import { SIM } from "./params";

/**
 * Each cell of the ruler's race but not its culture looks at one random neighbor,
 * and if that neighbor has the ruler's culture, may copy it. So a culture spreads
 * outward from its heartland in a solid blob. Only settled, calm, unoccupied land
 * changes. `control` is this year's control map from updateTotals.
 */
export function assimilate(state: WorldState, control: Float32Array, rng: Rng): void {
  const { owner, race, culture, unrest, occupier } = state.state;
  for (let c = 0; c < owner.length; c++) {
    const nation = state.nations.get(owner[c]!);
    if (!nation || culture[c] === nation.culture || race[c] !== nation.race) continue;
    if (unrest[c]! >= SIM.ASSIMILATE_MAX_UNREST || occupier[c] !== 0 || !isCore(state, c)) continue;
    const neighbor = rng.pick(state.cells[c]!.neighbors);
    if (culture[neighbor] !== nation.culture) continue;
    if (rng.chance(SIM.CULTURE_RATE * traits(race[c]!).assimilation * control[c]!)) culture[c] = nation.culture;
  }
}
