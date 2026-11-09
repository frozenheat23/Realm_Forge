// Sieges and occupation (SPEC §4.13): armies take enemy cells by force during a war.
// The owner doesn't change until peace; `occupier` records who holds the cell for now.
import { Settlement, type Army, type CellId, type NationId, type War, type WorldState } from "../core/types";
import { createRng, type Rng } from "../core/rng";
import { friendly } from "./diplomacy";
import { pairKey, warPairs } from "./helpers";
import { SIM } from "./params";
import { goalsHeld } from "./warGoals";
import { recordCapital, recordOf } from "./warRecords";
import { loseSoldiers } from "./manpower";
import { supplyStatus } from "./supply";

/** Seasons an army needs to take `cell`: empty land falls fast, cities and capitals hold out. */
export function siegeSteps(state: WorldState, cell: CellId): number {
  const owner = state.nations.get(state.state.owner[cell]!);
  return (
    SIM.SIEGE_STEPS *
    (1 + SIM.SIEGE_SETTLEMENT_K * state.state.settlement[cell]!) *
    state.cells[cell]!.defensibility *
    (owner?.capital === cell ? SIM.CAPITAL_SIEGE_MULT : 1)
  );
}

/** An abstract local garrison: walls and terrain help, accumulated siege pressure weakens it. */
export function siegeResistance(state: WorldState, cell: CellId): number {
  const population = state.state.pop[cell]! * SIM.SIEGE_GARRISON_SHARE;
  const walls = 1 + SIM.SIEGE_SETTLEMENT_K * state.state.settlement[cell]!;
  const capital = state.nations.get(state.state.owner[cell]!)?.capital === cell ? SIM.CAPITAL_SIEGE_MULT : 1;
  return Math.max(SIM.MIN_ARMY_SIZE, population * walls * state.cells[cell]!.defensibility * capital * (1 - state.state.siege[cell]!));
}

/** `id` takes the cell. Taking a town or city also brings in the open country around it. */
function occupy(state: WorldState, cell: CellId, id: NationId): void {
  const { owner, occupier, siege, settlement, devastation } = state.state;
  occupier[cell] = id;
  siege[cell] = 0;
  devastation[cell] = Math.min(1, devastation[cell]! + SIM.DEVASTATION_CAPTURE);

  // Losing the capital shakes the whole realm, though it only changes hands at peace.
  const holder = state.nations.get(owner[cell]!)!;
  if (holder.capital === cell) {
    holder.stability = Math.max(0, holder.stability - SIM.CAPITAL_LOSS_STAB_HIT);
    recordCapital(state, id, holder.id, cell);
  }

  if (settlement[cell]! < Settlement.Town) return;
  for (const n of state.cells[cell]!.neighbors) {
    if (owner[n] === holder.id && occupier[n] === 0 && settlement[n]! < Settlement.Town && n !== holder.capital &&
        !state.armies.some((a) => a.size > 0 && a.cell === n && a.owner === holder.id)) {
      occupier[n] = id;
      siege[n] = 0;
    }
  }
}

/** Is a hostile army in or next to `cell`? */
export function hostileNear(state: WorldState, army: Army, cell: CellId, hostile: Set<number>): boolean {
  const neighbors = state.cells[cell]!.neighbors;
  return state.armies.some(
    (other) =>
      other.size > 0 && hostile.has(pairKey(army.owner, other.owner)) && (other.cell === cell || neighbors.includes(other.cell)),
  );
}

/** Season step: each army standing unopposed in enemy land works at taking that cell. */
export function besiege(state: WorldState, hostile: Set<number>, rng: Rng = createRng(`${state.seed}/siege/${state.year}`)): void {
  const { owner, occupier, siege } = state.state;
  const maintained = new Set<CellId>();
  for (const army of state.armies) {
    const cell = army.cell;
    if (army.size < SIM.MIN_ARMY_SIZE || army.morale < SIM.RETREAT_MORALE || maintained.has(cell) || occupier[cell] !== 0 || !hostile.has(pairKey(army.owner, owner[cell]!))) continue;
    if (hostileNear(state, army, cell, hostile)) continue;
    maintained.add(cell);
    const strength = Math.min(1, army.size * army.morale / siegeResistance(state, cell));
    const provisions = 1 - supplyStatus(state, army).shortage / 2;
    siege[cell] = Math.min(1, siege[cell]! + strength * provisions / Math.max(siegeSteps(state, cell), 1e-6));
    if (siege[cell]! >= 1) {
      occupy(state, cell, army.owner);
      continue;
    }
    const fortified = state.state.settlement[cell]! >= Settlement.Town || state.nations.get(owner[cell]!)?.capital === cell;
    if (!fortified || army.siegeMode !== "assault") continue;
    // The decision uses an uncertain report; the actual assault gets its own weighted roll.
    const power = army.size * army.morale;
    const won = rng.fork(`assault-${army.id}-${cell}`).chance(power / (power + siegeResistance(state, cell)));
    loseSoldiers(state, state.nations.get(army.owner)!, army.size * SIM.SIEGE_ASSAULT_LOSS, army.war);
    army.morale = Math.max(0, Math.min(1, army.morale + (won ? SIM.MORALE_GAIN : -SIM.MORALE_LOSS)));
    const place = state.cityNames.get(cell) ?? `the stronghold of ${state.nations.get(owner[cell]!)!.name}`;
    recordOf(state, army.war)?.moments.push({ year: state.year, kind: "assault", text: `${state.nations.get(army.owner)!.name} ${won ? "storms" : "fails to storm"} ${place}.` });
    if (won) occupy(state, cell, army.owner);
  }
  // Relief or withdrawal lets the garrison recover; an abandoned siege cannot be banked forever.
  for (let cell = 0; cell < siege.length; cell++) {
    if (siege[cell]! > 0 && !maintained.has(cell)) siege[cell] = Math.max(0, siege[cell]! - SIM.SIEGE_RECOVERY);
  }
}

/** An army entering land its side owns frees it from the enemy at once. */
export function liberate(state: WorldState, army: Army, cell: CellId, hostile: Set<number>): void {
  const { owner, occupier, siege } = state.state;
  const holder = occupier[cell]!;
  if (holder === 0 || !hostile.has(pairKey(army.owner, holder))) return;
  if (owner[cell] === army.owner || friendly(state, owner[cell]!, army.owner)) {
    occupier[cell] = 0;
    siege[cell] = 0;
  }
}

/** Cells occupied by an enemy, grouped by the nation that owns them. */
export function occupiedLand(state: WorldState): Map<NationId, CellId[]> {
  const { owner, occupier } = state.state;
  const held = new Map<NationId, CellId[]>();
  for (let c = 0; c < occupier.length; c++) {
    if (occupier[c] === 0) continue;
    const list = held.get(owner[c]!);
    if (list) list.push(c);
    else held.set(owner[c]!, [c]);
  }
  return held;
}

/** Key for "who holds whose land": unlike pairKey, the order matters. */
function heldKey(occupier: NationId, owner: NationId): number {
  return occupier * 100000 + owner;
}

/** How many cells each nation occupies of each other's land, found in one pass over the map. */
export function occupationCounts(state: WorldState): Map<number, number> {
  const { owner, occupier } = state.state;
  const counts = new Map<number, number>();
  for (let c = 0; c < occupier.length; c++) {
    if (occupier[c] === 0) continue;
    const key = heldKey(occupier[c]!, owner[c]!);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** How many of `to`'s cells `from` occupies, from `occupationCounts`. */
export function occupiedBy(counts: Map<number, number>, from: NationId, to: NationId): number {
  return counts.get(heldKey(from, to)) ?? 0;
}

/** What occupation is worth to `war`'s score right now: positive favors the attacker. */
export function occupationScore(state: WorldState, war: War, counts: Map<number, number>): number {
  const { occupier } = state.state;
  const side = (from: NationId, to: NationId) => {
    const capital = state.nations.get(to)!.capital;
    return (counts.get(heldKey(from, to)) ?? 0) * SIM.SCORE_PER_OCCUPIED + (occupier[capital] === from ? SIM.CAPITAL_SCORE : 0);
  };
  const goalBonus = goalsHeld(state, war) * SIM.SCORE_PER_OCCUPIED * (SIM.GOAL_SCORE_MULT - 1);
  return side(war.attacker, war.defender) + goalBonus - side(war.defender, war.attacker);
}

/** After the year's wars: occupations with no war behind them end, and so do sieges of nations now at peace. */
export function releaseOccupations(state: WorldState): void {
  const { owner, occupier, siege } = state.state;
  const pairs = warPairs(state);
  const fighting = new Set(state.wars.flatMap((w) => [w.attacker, w.defender]));
  for (let c = 0; c < occupier.length; c++) {
    const holder = occupier[c]!;
    if (holder !== 0 && (!pairs.has(pairKey(holder, owner[c]!)) || !state.nations.get(holder)?.alive)) occupier[c] = 0;
    if (siege[c]! > 0 && !fighting.has(owner[c]!)) siege[c] = 0;
  }
}
