// Soldiers (SPEC §4.13 "Manpower"): each nation has a reserve of trained soldiers
// that refills slowly up to a cap, and shrinks when it loses battles.
import type { Nation, WorldState } from "../core/types";
import { clamp } from "../core/math";
import { SIM } from "./params";

/**
 * Sets the nation's cap from the fighting population it controls (`levyPop`:
 * people × martial × control, so far-off, loosely held provinces send few
 * soldiers) and refills its reserve. Called from Totals. A nation in its first year
 * starts with a full reserve, so new realms aren't defenceless.
 */
export function updateManpower(state: WorldState, nation: Nation, levyPop: number): void {
  nation.manpowerCap = levyPop * SIM.LEVY_SHARE;
  const gap = nation.manpowerCap - soldiers(nation);
  if (state.year - nation.founded <= 1) {
    nation.reserve = nation.manpowerCap;
  } else if (gap > 0) {
    // Unstable realms train new soldiers slowly.
    nation.reserve += gap * SIM.LEVY_REFILL * (0.5 + nation.stability);
  }
}

/** All the nation's soldiers. Armies are added in M11 step 2; for now it's just the reserve. */
export function soldiers(nation: Nation): number {
  return nation.reserve;
}

/** How well the nation's soldiers fight: a shaky realm fights badly (poor pay, deserters, quarrelling lords). */
export function fightingPower(nation: Nation, share = 1): number {
  return soldiers(nation) * share * (0.5 + nation.stability);
}

/** Removes soldiers killed in battle; heavy losses make the nation weary of war. */
export function loseSoldiers(nation: Nation, lost: number): void {
  const dead = Math.min(lost, nation.reserve);
  nation.reserve -= dead;
  if (nation.manpowerCap > 0) {
    nation.warWeariness = clamp(nation.warWeariness + (dead / nation.manpowerCap) * SIM.WEARINESS_LOSS_K, 0, 1);
  }
}

/**
 * Shares of each side's soldiers killed in one battle (SPEC §4.13 "Battle").
 * `ratio` = winner's power ÷ loser's power: a crushing win kills more of the
 * loser and fewer of the winner.
 */
export function battleLosses(ratio: number): { winner: number; loser: number } {
  const r = Math.max(ratio, 1e-6);
  return {
    loser: Math.min(SIM.BATTLE_MAX_LOSS, SIM.BATTLE_LOSS * r),
    winner: Math.min(SIM.BATTLE_MAX_LOSS, (SIM.BATTLE_LOSS * SIM.WINNER_LOSS_SHARE) / r),
  };
}
