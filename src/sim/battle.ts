// Battles (SPEC §4.13): when hostile armies meet, one weighted roll decides it.
import type { Rng } from "../core/rng";
import { Resource, type Army, type CellId, type SimEvent, type WorldState } from "../core/types";
import { HILL_H } from "../gen/params";
import { traits } from "../gen/races";
import { battleEvent } from "./events";
import { pairKey } from "./helpers";
import { armyPower, battleLosses, loseSoldiers } from "./manpower";
import { SIM } from "./params";
import { resourceBonus } from "./resources";

/** Who holds the ground: the army that stood still, then the one at home, then the larger. */
function defenderOf(state: WorldState, a: Army, b: Army, moved: Set<number>): [Army, Army] {
  if (moved.has(a.id) !== moved.has(b.id)) return moved.has(a.id) ? [a, b] : [b, a];
  const owner = state.state.owner;
  const aHome = owner[a.cell] === a.owner;
  if (aHome !== (owner[b.cell] === b.owner)) return aHome ? [b, a] : [a, b];
  return a.size >= b.size ? [b, a] : [a, b];
}

/** How much the ground helps `army`, the defender: hills, walls, a stubborn people, mithril. */
export function groundBonus(state: WorldState, army: Army): number {
  const { owner, race, settlement } = state.state;
  const cell = state.cells[army.cell]!;
  let bonus = SIM.DEFENDER_BONUS * cell.defensibility * (1 + SIM.FORT_BONUS * settlement[army.cell]!);
  if (owner[army.cell] === army.owner) {
    bonus *= traits(race[army.cell]!).defense * resourceBonus(state.nations.get(army.owner), Resource.Mithril);
  }
  return bonus;
}

/** The beaten army falls back one cell: toward its own land if it can, and away from the winner. */
function fallBack(state: WorldState, army: Army, from: CellId): void {
  const { owner } = state.state;
  const [fx, fy] = state.cells[from]!.site;
  let best = army.cell;
  let bestScore = -Infinity;
  for (const n of state.cells[army.cell]!.neighbors) {
    const cell = state.cells[n]!;
    const free = owner[n] === 0 || owner[n] === army.owner || state.wars.some((w) => pairKey(w.attacker, w.defender) === pairKey(army.owner, owner[n]!));
    if (!cell.isLand || !free) continue;
    // Distance from the winner is in pixels, so being home outweighs any step of it.
    const score = (owner[n] === army.owner ? 1e7 : 0) + (cell.site[0] - fx) ** 2 + (cell.site[1] - fy) ** 2;
    if (score > bestScore) {
      best = n;
      bestScore = score;
    }
  }
  army.cell = best;
  army.trail.push(best);
  army.path = [];
}

/** Destroys an army if it has broken. Some of its soldiers straggle home. */
function checkRout(state: WorldState, army: Army): boolean {
  if (army.size >= SIM.MIN_ARMY_SIZE && army.morale >= SIM.ROUT_MORALE) return false;
  state.nations.get(army.owner)!.reserve += army.size * SIM.ROUT_RETURN;
  army.size = 0;
  return true;
}

function fight(state: WorldState, a: Army, b: Army, moved: Set<number>, rng: Rng): void {
  const [attacker, defender] = defenderOf(state, a, b, moved);
  const attack = armyPower(state, attacker);
  const defend = armyPower(state, defender) * groundBonus(state, defender);
  const attackerWins = rng.chance(attack + defend > 0 ? attack / (attack + defend) : 0.5);
  const [winner, loser] = attackerWins ? [attacker, defender] : [defender, attacker];
  const [winPower, losePower] = attackerWins ? [attack, defend] : [defend, attack];
  const site = defender.cell;

  const shares = battleLosses(winPower / Math.max(losePower, 1e-6));
  const winnerDead = winner.size * shares.winner;
  const loserDead = loser.size * shares.loser;
  loseSoldiers(state, state.nations.get(winner.owner)!, winnerDead, winner.war);
  loseSoldiers(state, state.nations.get(loser.owner)!, loserDead, loser.war);
  winner.morale = Math.min(1, winner.morale + SIM.MORALE_GAIN);
  loser.morale = Math.max(0, loser.morale - SIM.MORALE_LOSS);

  // Fighting wrecks the place it happens.
  const { pop, devastation } = state.state;
  pop[site] = pop[site]! * (1 - SIM.BATTLE_POP_LOSS);
  devastation[site] = Math.min(1, devastation[site]! + SIM.DEVASTATION_BATTLE);

  const routed = checkRout(state, loser);
  checkRout(state, winner);
  if (!routed) fallBack(state, loser, winner.cell);

  const war = state.wars.find((w) => pairKey(w.attacker, w.defender) === pairKey(a.owner, b.owner));
  if (war) {
    const points = SIM.BATTLE_SCORE + (routed ? SIM.ROUT_SCORE : 0);
    war.battleScore += war.attacker === winner.owner ? points : -points;
  }
  state.battles.push({ cell: site, winner: winner.owner, loser: loser.owner, lost: winnerDead + loserDead, routed });
}

/** Season step: every hostile pair of armies in or next to the same cell fights, each army once. */
export function fightBattles(state: WorldState, hostile: Set<number>, moved: Set<number>, rng: Rng): void {
  const armies = state.armies;
  const fought = new Set<number>();
  for (let i = 0; i < armies.length; i++) {
    for (let j = i + 1; j < armies.length; j++) {
      const a = armies[i]!;
      const b = armies[j]!;
      if (a.size <= 0 || b.size <= 0 || fought.has(a.id) || fought.has(b.id)) continue;
      if (!hostile.has(pairKey(a.owner, b.owner))) continue;
      if (a.cell !== b.cell && !state.cells[a.cell]!.neighbors.includes(b.cell)) continue;
      fought.add(a.id);
      fought.add(b.id);
      fight(state, a, b, moved, rng);
    }
  }
}

/** The nearest city's name within SIM.BATTLE_NAME_RANGE steps of `cell`, if there is one. */
function nearbyCity(state: WorldState, cell: CellId): string | undefined {
  const seen = new Set([cell]);
  let ring = [cell];
  for (let step = 0; step <= SIM.BATTLE_NAME_RANGE; step++) {
    const city = ring.find((c) => state.cityNames.has(c));
    if (city !== undefined) return state.cityNames.get(city);
    ring = ring.flatMap((c) => state.cells[c]!.neighbors).filter((n) => !seen.has(n) && seen.add(n));
  }
  return undefined;
}

/** Where a battle happened, as the start of a sentence. */
function battlePlace(state: WorldState, cell: CellId): string {
  const city = nearbyCity(state, cell);
  if (city) return `at the Battle of ${city}`;
  const { mountain, elevation } = state.cells[cell]!;
  const ground = mountain ? "mountains" : elevation >= HILL_H ? "hills" : "fields";
  const owner = state.nations.get(state.state.owner[cell]!);
  return owner ? `in the ${ground} of ${owner.name}` : `in the empty ${ground}`;
}

/** This year's battles, for the event log. */
export function battleEvents(state: WorldState): SimEvent[] {
  return state.battles.map((b) =>
    battleEvent(state.year, battlePlace(state, b.cell), state.nations.get(b.winner)!, state.nations.get(b.loser)!, b.lost, b.routed),
  );
}
