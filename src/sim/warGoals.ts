// War goals (SPEC §4.13): what a war is fought for, and what the winner gets at peace.
import type { Rng } from "../core/rng";
import type { CellId, Nation, War, WarGoal, WorldState } from "../core/types";
import { traits } from "../gen/races";
import { clamp } from "../core/math";
import { setOwner } from "./helpers";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses } from "./resources";

/** Cells `defender` holds that `attacker` lost to it recently: what a claim is about. */
function claimedCells(state: WorldState, attacker: Nation, defender: Nation): CellId[] {
  const { owner, prevOwner, ownedSince } = state.state;
  const cells: CellId[] = [];
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === defender.id && prevOwner[c] === attacker.id && state.year - ownedSince[c]! <= SIM.CLAIM_YEARS) cells.push(c);
  }
  return cells;
}

/** The defender's land in the province around `prize`. */
function provinceCells(state: WorldState, defender: Nation, prize: CellId): CellId[] {
  const province = state.cells[prize]!.province;
  return state.cells.filter((c) => c.province === province && state.state.owner[c.id] === defender.id).map((c) => c.id);
}

/** Picks a war's goal. `prize` is the defender's most valuable border cell, as the attacker sees it. */
export function chooseGoal(
  state: WorldState,
  attacker: Nation,
  defender: Nation,
  claim: boolean,
  prize: CellId | undefined,
  rng: Rng,
): { goal: WarGoal; goalCells: CellId[] } {
  if (claim) return { goal: "reclaim", goalCells: claimedCells(state, attacker, defender) };
  if (prize === undefined || rng.chance(SIM.RAID_CHANCE * traits(attacker.race).aggression)) return { goal: "raid", goalCells: [] };
  return { goal: "conquer", goalCells: provinceCells(state, defender, prize) };
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

/** Peace terms: the goal cells the winner holds, then up to SIM.PEACE_EXTRA_CELLS more that touch its land. Returns all it took. */
export function takeLand(state: WorldState, war: War, winner: Nation, loser: Nation): CellId[] {
  const { owner, occupier } = state.state;
  const taken = war.attacker === winner.id ? goalsStanding(state, war).filter((c) => occupier[c] === winner.id) : [];
  for (const c of taken) takeCell(state, c, winner);

  const grain = grainBonuses(state);
  const value = (c: CellId) => cellValue(state, c, winner.race, effectiveCapacity(state, c, grain));
  const others: CellId[] = [];
  for (let c = 0; c < owner.length; c++) if (owner[c] === loser.id && occupier[c] === winner.id) others.push(c);
  others.sort((a, b) => value(b) - value(a) || a - b);

  // Each new cell can make the next one touch, so look again from the most valuable after every taking.
  const touching = (c: CellId) => state.cells[c]!.neighbors.some((n) => owner[n] === winner.id);
  for (let extra = 0; extra < SIM.PEACE_EXTRA_CELLS; extra++) {
    const next = others.find((c) => owner[c] === loser.id && touching(c));
    if (next === undefined) break;
    takeCell(state, next, winner);
    taken.push(next);
  }
  return taken;
}

/** A won raid takes no land: the loser is shaken and the winner grows bolder. */
export function payTribute(winner: Nation, loser: Nation): void {
  loser.stability = clamp(loser.stability - SIM.RAID_TRIBUTE, 0, 1);
  winner.stability = clamp(winner.stability + SIM.RAID_TRIBUTE, 0, 1);
}
