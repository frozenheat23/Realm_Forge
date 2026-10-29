// Step 2, second half (SPEC §4.11): each cell's slow-changing memory of what has happened to it.
import type { WorldState } from "../core/types";
import { clamp } from "../core/math";
import { traits } from "../gen/races";
import { isCore } from "./helpers";
import { SIM } from "./params";

/**
 * Updates every cell's unrest and devastation for the year. `control` is this
 * year's control map from updateTotals.
 *
 * Unrest grows where the capital's grip is weak, under rulers of another race
 * and in war-torn land, and fades by itself (twice as fast in core land).
 * Devastation heals a share of itself every year, owned or not.
 */
export function updateLand(state: WorldState, control: Float32Array): void {
  const { owner, race, unrest, devastation } = state.state;
  for (let c = 0; c < owner.length; c++) {
    devastation[c] = devastation[c]! * (1 - SIM.DEVASTATION_HEAL);

    const nation = state.nations.get(owner[c]!);
    if (!nation) continue;
    const ruler = traits(nation.race);
    const foreign = race[c] !== nation.race ? SIM.UNREST_FOREIGN_K / ruler.tolerance : 0;
    const decay = SIM.UNREST_DECAY * (isCore(state, c) ? 2 : 1);
    unrest[c] = clamp(
      unrest[c]! + SIM.UNREST_CONTROL_K * (1 - control[c]!) + foreign + SIM.UNREST_DEVASTATION_K * devastation[c]! - decay,
      0,
      1,
    );
  }
}
