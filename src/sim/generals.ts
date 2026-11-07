// Generals (M18 part 3, docs/systems/realwar.md): every army is led by someone.
// A general's skill multiplies the army's power, victories sharpen it, a beaten
// general may die, and a realm keeps its best one between wars.
import { createRng, type Rng } from "../core/rng";
import type { Army, BattleReport, General, Nation, WorldState } from "../core/types";
import { makeGeneral } from "../gen/rulers";
import { SIM } from "./params";

/** × an army's power for its general: skill, sharpened by each victory (up to SIM.GENERAL_MAX_WINS). */
export function generalBonus(general: General | undefined): number {
  if (!general) return 1; // an army from an old save: an ordinary leader
  return general.skill * (1 + SIM.GENERAL_WIN_BONUS * Math.min(general.wins, SIM.GENERAL_MAX_WINS));
}

export function isFamous(general: General): boolean {
  return general.wins >= SIM.GENERAL_FAMOUS;
}

/** Still young enough to serve? */
function serving(state: WorldState, general: General): boolean {
  return state.year - general.since < SIM.GENERAL_CAREER;
}

/**
 * A leader for a new army: the realm's marshal if it has one still serving, or else
 * someone new. The dice are named after the army and `after` (who they replace), since a
 * fork depends only on its name: a replacement rolled from the army's name alone would be the same person.
 */
export function appointGeneral(state: WorldState, nation: Nation, armyId: number, after = ""): General {
  const marshal = nation.marshal;
  delete nation.marshal;
  if (marshal && serving(state, marshal)) return marshal;
  return makeGeneral(createRng(`${state.seed}/general-${armyId}-${after}`), nation.race, state.year, SIM.GENERAL_SPREAD);
}

/** An army goes home (or is destroyed and its general escapes): a general better known than the marshal takes their place. */
export function retireGeneral(state: WorldState, nation: Nation, general: General | undefined): void {
  if (!general || !nation.alive || !serving(state, general)) return;
  if (!nation.marshal || general.wins > nation.marshal.wins) nation.marshal = general;
}

/**
 * After a battle: the winner's general gains a victory, and the loser's may fall.
 * A famous general's renown or death goes into the battle's report, for the log.
 */
export function afterBattle(state: WorldState, winner: Army, loser: Army, routed: boolean, report: BattleReport, rng: Rng): void {
  const victor = winner.general;
  if (victor) {
    victor.wins++;
    if (victor.wins === SIM.GENERAL_FAMOUS) report.general = { name: victor.name, nation: winner.owner, news: "renown" };
  }
  const beaten = loser.general;
  if (!beaten) return;
  if (rng.chance(routed ? SIM.GENERAL_DEATH_ROUT : SIM.GENERAL_DEATH)) {
    if (isFamous(beaten)) report.general = { name: beaten.name, nation: loser.owner, news: "fell" };
    // An army still in the field gets a new leader at once; a destroyed one needs none.
    if (!routed) loser.general = appointGeneral(state, state.nations.get(loser.owner)!, loser.id, `${state.year}-${beaten.name}`);
  } else if (routed) {
    retireGeneral(state, state.nations.get(loser.owner)!, beaten); // escaped the rout
  }
}
