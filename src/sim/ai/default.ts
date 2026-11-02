// The AI controller (M15): how every nation has made its choices so far, moved out
// of the rule files unchanged. Another controller (a player, a different personality)
// can take any nation's place; the rules stay the same for all of them.
import type { Rng } from "../../core/rng";
import { Faith, NO_TARGET, RulerType, type CellId, type Nation, type WarGoal, type WorldState } from "../../core/types";
import { blessing } from "../../gen/faiths";
import { traits } from "../../gen/races";
import { opinion } from "../diplomacy";
import { armyPower, fightingPower } from "../manpower";
import { goalCell, helping, homeCell, nearestHostile, nearestOf, supportCell } from "../marching";
import { SIM } from "../params";
import { greatBonus } from "../rulers";
import { claimedCells, conquestCells, openGoals } from "../warGoals";
import type { Controller, Controllers, View, WarContext } from "./controller";

/**
 * Yearly chance that `attacker` declares war on `defender` (SPEC §4.5).
 * `attackHelp` / `defendHelp` = fighting power the allies on each side are expected to bring.
 * `motive` multiplies it for reasons to fight (claims, rich border land).
 * A bigger gap makes war more tempting, and so do an aggressive ruling race and hatred.
 */
export function warChance(state: View, attacker: Nation, defender: Nation, attackHelp = 0, defendHelp = 0, motive = 1): number {
  const ratio = (fightingPower(state, attacker) + attackHelp) / Math.max(fightingPower(state, defender) + defendHelp, 1e-6);
  const mood = Math.max(0, 1 - opinion(state, attacker.id, defender.id) * SIM.OPINION_WAR_K);
  return Math.min(
    SIM.WAR_MAX_PROB,
    SIM.WAR_BASE_PROB * traits(attacker.race).aggression * blessing(attacker, Faith.RedHunger) * greatBonus(attacker, RulerType.Conqueror, SIM.GREAT_CONQUEROR_WAR) * ratio ** SIM.WAR_STRENGTH_EXP * (1 - attacker.warWeariness) * mood * motive,
  );
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

/** Only the side with more fighting power considers war (the first of an equal pair, by id). */
function stronger(view: View, me: Nation, them: Nation): boolean {
  const mine = fightingPower(view, me);
  const theirs = fightingPower(view, them);
  return mine > theirs || (mine === theirs && me.id < them.id);
}

export const AI: Controller = {
  declareWar(view, me, them, why, rng) {
    if (!stronger(view, me, them)) return null;
    // Weigh up whose allies would join in, and the reasons to fight.
    const help = (allies: Nation[], joinChance: number) => allies.reduce((sum, n) => sum + fightingPower(view, n) * joinChance, 0);
    const motive = (why.claim ? SIM.CLAIM_WAR_BONUS : 1) * (1 + SIM.WAR_VALUE_K * (why.prize?.value ?? 0));
    const chance = warChance(view, me, them, help(why.myHelpers, SIM.ALLY_ATTACK_PROB), help(why.theirHelpers, SIM.ALLY_DEFEND_PROB), motive);
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

  keepAlliance(view, me, other) {
    return opinion(view, me.id, other.id) >= SIM.ALLIANCE_BREAK_OPINION;
  },

  acceptPeace() {
    return true; // a won war is ended at once
  },

  mobilize(_view, me, wars) {
    // The same share of the reserve for each new war.
    const size = (me.reserve * SIM.MOBILIZE_SHARE) / Math.max(1, wars.length);
    return wars.map(() => size);
  },

  /** The ladder in SPEC §4.13: the first rule that gives somewhere the army can reach wins. */
  orderArmy(view, army, orders) {
    const foe = nearestHostile(view, army, orders.hostile);
    if (foe) {
      // Attack an enemy army it can beat; fall back from one it can't.
      const strong = armyPower(view, army) >= SIM.ENGAGE_RATIO * armyPower(view, foe);
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
