// Step 3 (SPEC §4.3): big, loosely held, war-weary or many-raced nations become unstable.
import { Faith, Resource, type Nation, type WorldState } from "../core/types";
import { clamp } from "../core/math";
import { blessing } from "../gen/faiths";
import { traits } from "../gen/races";
import { SIM } from "./params";
import { resourceBonus } from "./resources";

/** How much land a nation can rule well: young realms can hold far more, and that vigor fades with age. */
export function adminCap(state: WorldState, nation: Nation): number {
  const age = state.year - nation.founded;
  return SIM.ADMIN_CAP_BASE * traits(nation.race).cohesion * (1 + SIM.VIGOR_BONUS * Math.exp(-age / SIM.VIGOR_YEARS));
}

export function updateStability(state: WorldState): void {
  const atWar = new Set(state.wars.flatMap((w) => [w.attacker, w.defender]));

  for (const nation of state.nations.values()) {
    if (!nation.alive) continue;
    const ruler = traits(nation.race);

    // War weariness builds up during war (slower for enduring races) and fades in peace.
    nation.warWeariness = clamp(
      nation.warWeariness + (atWar.has(nation.id) ? SIM.WEARINESS_GAIN / ruler.endurance : -SIM.WEARINESS_DECAY),
      0,
      1,
    );

    const overextension = Math.max(0, nation.area - adminCap(state, nation)) * SIM.OVEREXT_K;
    // Land the capital barely reaches (far, or behind mountains and marshes) is hard to rule.
    const controlPenalty = Math.max(0, SIM.CONTROL_FREE - nation.control) * SIM.CONTROL_STAB_K;
    // Ruling many people of other races is hard, less so for tolerant rulers.
    const foreignPenalty = (Math.max(0, nation.foreignShare - SIM.FOREIGN_FREE) * SIM.FOREIGN_K) / ruler.tolerance;

    nation.stability = clamp(
      nation.stability +
        SIM.STAB_RECOVERY * resourceBonus(nation, Resource.Gold) * blessing(nation, Faith.RadiantCovenant) - // gold pays for order
        overextension -
        nation.warWeariness * SIM.WEARINESS_STAB_K -
        controlPenalty -
        foreignPenalty,
      0,
      1,
    );
  }
}
