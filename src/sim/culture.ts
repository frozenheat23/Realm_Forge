// Step 2, after the land (SPEC §4.14): conquered peoples slowly take on their rulers' ways.
import type { Rng } from "../core/rng";
import { Faith, type WorldState } from "../core/types";
import { blessing, faithAt, faithInfo } from "../gen/faiths";
import { FAITHS } from "../gen/params";
import { traits } from "../gen/races";
import { isCore } from "./helpers";
import { SIM } from "./params";

/**
 * Each cell of the ruler's race but not its culture looks at one random neighbor,
 * and if that neighbor has the ruler's culture, may copy it. So a culture spreads
 * outward from its heartland in a solid blob. Only settled, calm, unoccupied land
 * changes. On foreign core land the ruling people can gradually become the local majority.
 * `control` is this year's control map from updateTotals.
 */
export function assimilate(state: WorldState, control: Float32Array, rng: Rng): void {
  const { owner, race, culture, faith, unrest, occupier } = state.state;
  const settlers = rng.fork("settlers");
  for (let c = 0; c < owner.length; c++) {
    const nation = state.nations.get(owner[c]!);
    if (!nation || culture[c] === nation.culture) continue;
    if (unrest[c]! >= SIM.ASSIMILATE_MAX_UNREST || occupier[c] !== 0 || !isCore(state, c)) continue;
    if (race[c] !== nation.race) {
      // One cell records its majority. A change of majority carries the settlers' culture with it.
      if (state.state.pop[c]! > 0 && settlers.chance(SIM.PEOPLE_SETTLEMENT_RATE * control[c]!)) {
        race[c] = nation.race;
        culture[c] = nation.culture;
        // Local faith can cross peoples. An exclusive faith gives way to the settlers' homeland faith.
        const allowed = faithInfo(faith[c]!)?.races;
        if (allowed && !allowed.some((r) => r === nation.race)) {
          faith[c] = faithAt(state.raceHomes, nation.race, ...state.cells[c]!.site);
        }
      }
      continue;
    }
    const neighbor = rng.pick(state.cells[c]!.neighbors);
    if (culture[neighbor] !== nation.culture) continue;
    // Bone Drums rulers gather in the tribes; the Silver Choir sings of what its people were.
    const remembered = faith[c] === Faith.SilverChoir ? FAITHS[Faith.SilverChoir].blessing : 1;
    const chance = SIM.CULTURE_RATE * traits(race[c]!).assimilation * control[c]! * blessing(nation, Faith.BoneDrums) * remembered;
    if (rng.chance(chance)) culture[c] = nation.culture;
  }
}
