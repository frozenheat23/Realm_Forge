// Step 3 (SPEC §4.3): big, sprawling, war-weary or many-raced nations become unstable.
import type { Nation, WorldState } from "../core/types";
import { clamp } from "../core/math";
import { traits } from "../gen/races";
import { cellsByNation, hopsFromCapital } from "./helpers";
import { SIM } from "./params";

/**
 * Average number of steps from the capital to the nation's cells.
 * Cells the capital can't reach over its own land (e.g. islands) count as
 * one step further than the farthest reachable cell.
 */
export function averageHopsToCapital(state: WorldState, nation: Nation, cells: number[]): number {
  if (cells.length === 0) return 0;
  const hops = hopsFromCapital(state, nation);
  let farthest = 0;
  for (const c of cells) farthest = Math.max(farthest, hops[c]!);
  let total = 0;
  for (const c of cells) total += hops[c]! >= 0 ? hops[c]! : farthest + 1;
  return total / cells.length;
}

export function updateStability(state: WorldState): void {
  const groups = cellsByNation(state);
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

    const overextension = Math.max(0, nation.area - SIM.ADMIN_CAP_BASE * ruler.cohesion) * SIM.OVEREXT_K;
    const avgHops = averageHopsToCapital(state, nation, groups.get(nation.id) ?? []);
    const distancePenalty = Math.max(0, avgHops - SIM.CAPITAL_DIST_FREE) * SIM.CAPITAL_DIST_K;
    // Ruling many people of other races is hard, less so for tolerant rulers.
    const foreignPenalty = (Math.max(0, nation.foreignShare - SIM.FOREIGN_FREE) * SIM.FOREIGN_K) / ruler.tolerance;

    nation.stability = clamp(
      nation.stability +
        SIM.STAB_RECOVERY -
        overextension -
        nation.warWeariness * SIM.WEARINESS_STAB_K -
        distancePenalty -
        foreignPenalty,
      0,
      1,
    );
  }
}
