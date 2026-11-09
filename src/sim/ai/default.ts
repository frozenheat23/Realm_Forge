// The AI controller: national strategy and army decisions under imperfect information.
// Another controller can take any nation's place; the rules stay the same for everyone.
import type { Rng } from "../../core/rng";
import { Faith, NO_TARGET, RulerType, type Army, type CellId, type Nation, type WarGoal, type WorldState } from "../../core/types";
import { blessing } from "../../gen/faiths";
import { traits } from "../../gen/races";
import { opinion } from "../diplomacy";
import { groundBonus } from "../battle";
import { armyPower, fightingPower } from "../manpower";
import { goalCell, helping, homeCell, nearestHostile, nearestOf, supportCell } from "../marching";
import { SIM } from "../params";
import { greatBonus } from "../rulers";
import { siegeResistance } from "../siege";
import { claimedCells, conquestCells, openGoals } from "../warGoals";
import type { Controller, Controllers, View, WarContext } from "./controller";

/**
 * Yearly chance that `attacker` declares war on `defender` (SPEC §4.5), given `ratio`:
 * how much stronger the attacker believes it is, allies included (see `estimate`).
 * `motive` multiplies it for reasons to fight (claims, rich border land).
 * A bigger gap makes war more tempting, and so do an aggressive ruling race and hatred.
 */
export function warChance(state: View, attacker: Nation, defender: Nation, ratio: number, motive = 1): number {
  const mood = Math.max(0, 1 - opinion(state, attacker.id, defender.id) * SIM.OPINION_WAR_K);
  return Math.min(
    SIM.WAR_MAX_PROB,
    SIM.WAR_BASE_PROB * traits(attacker.race).aggression * blessing(attacker, Faith.RedHunger) * greatBonus(attacker, RulerType.Conqueror, SIM.GREAT_CONQUEROR_WAR) * ratio ** SIM.WAR_STRENGTH_EXP * (1 - attacker.warWeariness) * mood * motive,
  );
}

/**
 * How much stronger `me` believes it is than `them` (M18 misjudgment, docs/systems/realwar.md):
 * the true ratio of fighting power (allies' expected help included), × the race's confidence,
 * × the ruler's boldness, × this year's error, which is bigger against another race.
 */
export function estimate(me: Nation, them: Nation, trueRatio: number, rng: Rng): number {
  const error = SIM.INTEL_ERROR * (me.race === them.race ? 1 : SIM.INTEL_FOREIGN);
  return trueRatio * traits(me.race).confidence * me.ruler.boldness * Math.exp(rng.range(-error, error));
}

/**
 * The general's estimate when considering an attack on `foe` at its current position.
 * Scouting can misjudge effective enemy strength, including its ground advantage.
 * The foe may move before battle; this is a plan, not knowledge of the battle's roll.
 */
export function engagementEstimate(view: View, army: Army, foe: Army, rng: Rng): number {
  const report = rng.fork(`foe-${foe.id}`).range(-SIM.ENGAGE_INTEL_ERROR, SIM.ENGAGE_INTEL_ERROR);
  const opposition = armyPower(view, foe) * groundBonus(view, foe) * Math.exp(report);
  const confidence = army.general?.boldness ?? 1;
  return armyPower(view, army) * confidence / Math.max(opposition, 1e-6);
}

/** The goal to fight for: lost land if there's a claim; otherwise a raid (likelier for aggressive races, and when there's nothing worth taking) or a conquest. */
function goalFor(attacker: Nation, why: WarContext, rng: Rng): WarGoal {
  if (why.claim) return "reclaim";
  if (why.prize === undefined || rng.chance(SIM.RAID_CHANCE * traits(attacker.race).aggression)) return "raid";
  return "conquer";
}

/**
 * The AI's goal and goal cells together, as the rules would work them out.
 * `prize` is the defender's most valuable border cell, as the attacker sees it.
 */
export function chooseGoal(
  state: WorldState,
  attacker: Nation,
  defender: Nation,
  claim: boolean,
  prize: CellId | undefined,
  rng: Rng,
): { goal: WarGoal; goalCells: CellId[] } {
  const why: WarContext = { claim, myHelpers: [], theirHelpers: [], ...(prize === undefined ? {} : { prize: { cell: prize, value: 0 } }) };
  const goal = goalFor(attacker, why, rng);
  if (goal === "reclaim") return { goal, goalCells: claimedCells(state, attacker, defender) };
  if (goal === "raid") return { goal, goalCells: [] };
  return { goal, goalCells: conquestCells(state, attacker, defender, prize!) };
}

export const AI: Controller = {
  declareWar(view, me, them, why, rng) {
    // Weigh up whose allies would join in, then how the two sides compare, as this ruler sees it.
    const help = (allies: Nation[], joinChance: number) => allies.reduce((sum, n) => sum + fightingPower(view, n) * joinChance, 0);
    const mine = fightingPower(view, me) + help(why.myHelpers, SIM.ALLY_ATTACK_PROB);
    const theirs = fightingPower(view, them) + help(why.theirHelpers, SIM.ALLY_DEFEND_PROB);
    const ratio = estimate(me, them, mine / Math.max(theirs, 1e-6), rng);
    // Only a side that believes it's the stronger considers war; both may believe it.
    if (ratio <= 1) return null;
    const motive = (why.claim ? SIM.CLAIM_WAR_BONUS : 1) * (1 + SIM.WAR_VALUE_K * (why.prize?.value ?? 0));
    const chance = warChance(view, me, them, ratio, motive);
    if (!rng.chance(chance)) return null;
    return goalFor(me, why, rng);
  },

  joinWar(_view, _me, _friend, _enemy, side, rng) {
    return rng.chance(side === "defend" ? SIM.ALLY_DEFEND_PROB : SIM.ALLY_ATTACK_PROB);
  },

  proposeAlliance(view, me, other, rng) {
    if (opinion(view, me.id, other.id) < SIM.ALLIANCE_MIN_OPINION) return false;
    return rng.chance(SIM.ALLIANCE_PROB);
  },

  acceptAlliance(view, me, other) {
    return opinion(view, me.id, other.id) >= SIM.ALLIANCE_MIN_OPINION;
  },

  keepAlliance(view, me, other, idleYears, rng) {
    if (opinion(view, me.id, other.id) < SIM.ALLIANCE_BREAK_OPINION) return false;
    if (idleYears === 0) return true; // fighting side by side right now
    const fickleness = traits(me.race).fickleness;
    // A ruler crowned last year weighs the old pacts afresh, once.
    if (me.ruler.crowned === view.year - 1) {
      const schemer = me.ruler.great === RulerType.Schemer ? SIM.GREAT_SCHEMER_BREAK : 1;
      if (rng.chance(SIM.NEW_RULER_BREAK * fickleness * schemer)) return false;
    }
    // An unused pact fades: the longer since they last fought together, the likelier it lapses.
    return !rng.chance(SIM.PACT_FADE * idleYears * fickleness);
  },

  acceptPeace() {
    return true; // a won war is ended at once
  },

  suePeace(_view, me, _war, rng) {
    // The wearier the realm, the readier to cut its losses.
    return rng.chance(SIM.SUE_PROB * (1 + me.warWeariness));
  },

  acceptTerms(view, me, war, rng) {
    // Never while holding the loser's capital: the whole realm is about to fall.
    const loser = view.nations.get(war.attacker === me.id ? war.defender : war.attacker)!;
    if (view.state.occupier[loser.capital] === me.id) return false;
    return rng.chance(SIM.ACCEPT_PROB + me.warWeariness);
  },

  mobilize(_view, me, wars) {
    // The same share of the reserve for each new war.
    const size = (me.reserve * SIM.MOBILIZE_SHARE) / Math.max(1, wars.length);
    return wars.map(() => size);
  },

  orderSiege(view, army, target, rng) {
    if (target < 0 || army.morale < SIM.RETREAT_MORALE) return "wait";
    const resistance = siegeResistance(view, target);
    const report = Math.exp(rng.fork(`siege-${target}`).range(-SIM.ENGAGE_INTEL_ERROR, SIM.ENGAGE_INTEL_ERROR));
    const advantage = army.size * army.morale * (army.general?.boldness ?? 1) / (resistance * report);
    return advantage >= SIM.SIEGE_ASSAULT_RATIO ? "assault" : "wait";
  },

  /** The ladder in SPEC §4.13: the first rule that gives somewhere the army can reach wins. */
  orderArmy(view, army, orders, rng) {
    const foe = nearestHostile(view, army, orders.hostile);
    if (foe) {
      // Commit on an imperfect report, including the enemy's defensive position.
      const strong = engagementEstimate(view, army, foe, rng) >= SIM.ENGAGE_RATIO;
      const target = strong ? foe.cell : homeCell(view, army);
      if (orders.reach(target)) return target;
    }
    // Free its own land that this enemy holds.
    const lost = (orders.held.get(army.owner) ?? []).filter((c) => view.state.occupier[c] === orders.enemy.id);
    let target = nearestOf(view, army, lost);
    if (orders.reach(target)) return target;
    // An ally's army helps its friend.
    if (helping(army, orders.main)) {
      target = supportCell(view, army, orders.enemy, orders.main, orders.held);
      if (orders.reach(target)) return target;
    }
    // An army with no way to its enemy only tries again next year.
    if (army.target === NO_TARGET && orders.season > 0) return NO_TARGET;
    // The attacker goes for what the war is about.
    if (orders.war.attacker === army.owner) {
      const goals = openGoals(view, orders.war);
      target = goals.includes(army.target) ? army.target : nearestOf(view, army, goals);
      if (orders.reach(target)) return target;
    }
    // Otherwise: plunder.
    target = goalCell(view, army, orders.enemy, orders.grain);
    return orders.reach(target) ? target : NO_TARGET;
  },

  crushRevolt(_view, _me, _rebels, rng) {
    return rng.chance(SIM.REBEL_WAR_PROB);
  },

  adoptFaith(_view, _me, _faith, rng) {
    return rng.chance(SIM.FAITH_ADOPT);
  },
};

/** Every nation run by the AI: what the simulation uses unless told otherwise. */
export const everyoneAI: Controllers = () => AI;
