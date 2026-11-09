// War goals (SPEC §4.13): what a war is fought for, and what the winner gets at peace.
import { Faith, type CellId, type Nation, type Subjugation, type War, type WorldState } from "../core/types";
import { blessing } from "../gen/faiths";
import { clamp } from "../core/math";
import { setOwner } from "./helpers";
import { becomeVassal, overlordOf } from "./vassals";
import { fightingPower } from "./manpower";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses } from "./resources";

/** How long a nation remembers land it lost. */
export function claimYears(nation: Nation): number {
  return SIM.CLAIM_YEARS * blessing(nation, Faith.DeepAncestors);
}

/** Cells `defender` holds that `attacker` lost to it recently: what a claim is about. */
export function claimedCells(state: WorldState, attacker: Nation, defender: Nation): CellId[] {
  const { owner, prevOwner, ownedSince } = state.state;
  const cells: CellId[] = [];
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === defender.id && prevOwner[c] === attacker.id && state.year - ownedSince[c]! <= claimYears(attacker)) cells.push(c);
  }
  return cells;
}

/**
 * The defender's land in the province around `prize`, and in as many nearby provinces
 * as the attacker's strength lets it aim for: a much stronger nation wants far more.
 */
export function conquestCells(state: WorldState, attacker: Nation, defender: Nation, prize: CellId): CellId[] {
  const { cells } = state;
  const owner = state.state.owner;
  const ratio = fightingPower(state, attacker) / Math.max(fightingPower(state, defender), 1e-6);
  const wanted = clamp(Math.floor(ratio), 1, SIM.CONQUEST_MAX_PROVINCES);

  // Walk outward through the defender's land, adding each new province we meet.
  const provinces = new Set([cells[prize]!.province]);
  const seen = new Set([prize]);
  let ring = [prize];
  while (ring.length > 0 && provinces.size < wanted) {
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of cells[c]!.neighbors) {
        if (seen.has(n) || owner[n] !== defender.id) continue;
        seen.add(n);
        next.push(n);
        if (provinces.size < wanted) provinces.add(cells[n]!.province);
      }
    }
    ring = next;
  }
  const goal = cells.filter((c) => provinces.has(c.province) && owner[c.id] === defender.id).map((c) => c.id);
  // Far stronger? Then it goes for the throne: holding the capital at peace makes the nation its vassal.
  if (ratio >= SIM.SUBJUGATE_RATIO && !goal.includes(defender.capital)) goal.push(defender.capital);
  return goal;
}

/** Goal cells the defender still owns. A cell that broke away to rebels no longer counts. */
function goalsStanding(state: WorldState, war: War): CellId[] {
  return war.goalCells.filter((c) => state.state.owner[c] === war.defender);
}

/** Goal cells the attacker hasn't taken yet: where its army should go. */
export function openGoals(state: WorldState, war: War): CellId[] {
  return goalsStanding(state, war).filter((c) => state.state.occupier[c] !== war.attacker);
}

/** How many goal cells the attacker holds right now. */
export function goalsHeld(state: WorldState, war: War): number {
  return goalsStanding(state, war).filter((c) => state.state.occupier[c] === war.attacker).length;
}

/** Has the attacker taken everything it went to war for? */
export function goalAchieved(state: WorldState, war: War): boolean {
  return goalsHeld(state, war) > 0 && openGoals(state, war).length === 0;
}

function takeCell(state: WorldState, cell: CellId, winner: Nation): void {
  setOwner(state, cell, winner.id);
  state.state.unrest[cell] = Math.max(state.state.unrest[cell]!, SIM.UNREST_CONQUEST); // conquered people resent their new rulers
}

/** The winner holds the loser's capital: the whole nation is its, and the loser is gone. Returns all it took. */
function takeWholeNation(state: WorldState, winner: Nation, loser: Nation): CellId[] {
  const owner = state.state.owner;
  const taken: CellId[] = [];
  for (let c = 0; c < owner.length; c++) if (owner[c] === loser.id) taken.push(c);
  for (const c of taken) takeCell(state, c, winner);
  loser.alive = false;
  loser.fell = state.year;
  return taken;
}

/** Does the winner hold the loser's capital, so the peace can take the whole realm or make it a vassal? */
export function holdsCapital(state: WorldState, winner: Nation, loser: Nation, negotiated: boolean): boolean {
  return state.state.occupier[loser.capital] === winner.id && !negotiated;
}

/**
 * Peace terms: the goal cells the winner holds, then up to SIM.PEACE_EXTRA_CELLS more that
 * touch its land. `negotiated` terms, which the loser sued for (M18), give only the goal cells held.
 * `choice` (docs/systems/vassalage.md): holding the loser's capital, "annex" takes the whole nation
 * and anything else makes it a vassal; without it, "vassal" makes it submit too. A vassal keeps its
 * capital. One level only: a winner that is itself a vassal always annexes, and only an independent
 * realm can be made to submit without losing its capital. Returns all it took.
 */
export function takeLand(state: WorldState, war: War, winner: Nation, loser: Nation, negotiated = false, choice: Subjugation = "land"): CellId[] {
  const { owner, occupier } = state.state;
  const capitalHeld = holdsCapital(state, winner, loser, negotiated);
  if (capitalHeld && (overlordOf(state, winner.id) || choice === "annex")) return takeWholeNation(state, winner, loser);
  const submits = capitalHeld || (choice === "vassal" && !overlordOf(state, winner.id) && !overlordOf(state, loser.id));
  const keep = (c: CellId) => !submits || c !== loser.capital;
  const taken = war.attacker === winner.id ? goalsStanding(state, war).filter((c) => occupier[c] === winner.id && keep(c)) : [];
  for (const c of taken) takeCell(state, c, winner);
  if (negotiated) {
    if (submits) becomeVassal(state, loser, winner);
    return taken;
  }

  const grain = grainBonuses(state);
  const value = (c: CellId) => cellValue(state, c, winner.race, effectiveCapacity(state, c, grain));
  const others: CellId[] = [];
  for (let c = 0; c < owner.length; c++) if (owner[c] === loser.id && occupier[c] === winner.id && keep(c)) others.push(c);
  others.sort((a, b) => value(b) - value(a) || a - b);

  // Each new cell can make the next one touch, so look again from the most valuable after every taking.
  const touching = (c: CellId) => state.cells[c]!.neighbors.some((n) => owner[n] === winner.id);
  for (let extra = 0; extra < SIM.PEACE_EXTRA_CELLS; extra++) {
    const next = others.find((c) => owner[c] === loser.id && touching(c));
    if (next === undefined) break;
    takeCell(state, next, winner);
    taken.push(next);
  }
  if (submits) becomeVassal(state, loser, winner);
  return taken;
}

/** A won raid takes no land: the loser is shaken and the winner grows bolder. */
export function payTribute(winner: Nation, loser: Nation): void {
  loser.stability = clamp(loser.stability - SIM.RAID_TRIBUTE, 0, 1);
  winner.stability = clamp(winner.stability + SIM.RAID_TRIBUTE, 0, 1);
}
