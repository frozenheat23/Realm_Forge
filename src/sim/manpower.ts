// Soldiers (SPEC §4.13 "Manpower"): each nation has a reserve of trained soldiers
// that refills slowly up to a cap, and shrinks when it loses battles.
import type { Army, Nation, WorldState } from "../core/types";
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
  const gap = nation.manpowerCap - soldiers(state, nation);
  if (state.year - nation.founded <= 1) {
    nation.reserve = nation.manpowerCap;
  } else if (gap > 0) {
    // Unstable realms train new soldiers slowly.
    nation.reserve += gap * SIM.LEVY_REFILL * (0.5 + nation.stability);
  }
}

/** The nation's armies in the field. */
export function armiesOf(state: WorldState, id: number): Army[] {
  return state.armies.filter((a) => a.owner === id);
}

/** All the nation's soldiers: the reserve plus everyone in an army. */
export function soldiers(state: WorldState, nation: Nation): number {
  let total = nation.reserve;
  for (const army of state.armies) if (army.owner === nation.id) total += army.size;
  return total;
}

/** How well the nation's soldiers fight: a shaky realm fights badly (poor pay, deserters, quarrelling lords). */
export function fightingPower(state: WorldState, nation: Nation, share = 1): number {
  return soldiers(state, nation) * share * (0.5 + nation.stability);
}

/**
 * Removes soldiers killed in battle; heavy losses make the nation weary of war.
 * They come first from the army fighting `warId`, then the reserve, then its other armies.
 */
export function loseSoldiers(state: WorldState, nation: Nation, lost: number, warId?: number): void {
  const dead = Math.min(lost, soldiers(state, nation));
  let left = dead;
  const armies = armiesOf(state, nation.id);
  const fromArmy = (army: Army) => {
    const taken = Math.min(left, army.size);
    army.size -= taken;
    left -= taken;
  };
  const here = armies.find((a) => a.war === warId);
  if (here) fromArmy(here);
  const fromReserve = Math.min(left, nation.reserve);
  nation.reserve -= fromReserve;
  left -= fromReserve;
  armies.forEach(fromArmy);
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
