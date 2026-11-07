// Soldiers (SPEC §4.13 "Manpower"): each nation has a reserve of trained soldiers
// that refills slowly up to a cap, and shrinks when it loses battles.
import { Faith, RulerType, type Army, type Nation, type WorldState } from "../core/types";
import { clamp } from "../core/math";
import { blessing } from "../gen/faiths";
import { onlyDefending } from "./helpers";
import { SIM } from "./params";
import { greatBonus } from "./rulers";
import { recordLoss } from "./warRecords";

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
    // Unstable realms train new soldiers slowly; invaded ones rally to the banners.
    const rally = state.wars.some((w) => w.defender === nation.id) ? SIM.RALLY_REFILL : 1;
    nation.reserve += gap * SIM.LEVY_REFILL * rally * (0.5 + nation.stability) * blessing(nation, Faith.HollowMother);
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

/** How well a nation's soldiers fight: a shaky realm fights badly (poor pay, deserters, quarrelling lords), and a Conqueror leads them better. */
function fightingSpirit(nation: Nation): number {
  return (0.5 + nation.stability) * greatBonus(nation, RulerType.Conqueror, SIM.GREAT_CONQUEROR_POWER);
}

/** The nation's soldiers, weighed by how well they fight. */
export function fightingPower(state: WorldState, nation: Nation, share = 1): number {
  return soldiers(state, nation) * share * fightingSpirit(nation);
}

/** One army's strength in battle, before the ground helps: morale counts, and so does how shaky its realm is. */
export function armyPower(state: WorldState, army: Army): number {
  return army.size * army.morale * fightingSpirit(state.nations.get(army.owner)!);
}

/**
 * Removes soldiers killed in battle; heavy losses make the nation weary of war.
 * They come first from the army fighting `warId`, then the reserve, then its other armies.
 */
export function loseSoldiers(state: WorldState, nation: Nation, lost: number, warId?: number): void {
  const dead = Math.min(lost, soldiers(state, nation));
  if (warId !== undefined) recordLoss(state, warId, nation.id, dead);
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
    // A people only defending their homes bear losses better (SIM.DEFEND_WEARINESS).
    const resolve = onlyDefending(state, nation.id) ? SIM.DEFEND_WEARINESS : 1;
    nation.warWeariness = clamp(nation.warWeariness + (dead / nation.manpowerCap) * SIM.WEARINESS_LOSS_K * resolve, 0, 1);
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
