// Where armies can go and what they'd go for (SPEC §4.13): read-only questions about
// the map, used by the marching rules in armies.ts and by controllers giving orders.
import { NO_TARGET, type Army, type CellId, type Nation, type NationId, type War, type WorldState } from "../core/types";
import { MinHeap } from "../gen/rivers";
import { friendsOf } from "./diplomacy";
import { frontCells, moveCost, pairKey } from "./helpers";
import { SIM } from "./params";
import { cellValue, effectiveCapacity } from "./resources";

/** Nations whose land an army of `id` may cross: its own, its allies' and crown's, and its enemies'. Empty land (0) is open too. */
export function marchRights(state: WorldState, id: NationId): Set<NationId> {
  const rights = new Set<NationId>([0, id, ...friendsOf(state, id)]);
  for (const w of state.wars) {
    if (w.attacker === id) rights.add(w.defender);
    if (w.defender === id) rights.add(w.attacker);
  }
  return rights;
}

/**
 * Cheapest way from `from` to `to` by move cost, as the cells to walk (not
 * counting `from`). Empty if there's no way there. Dijkstra's algorithm: always
 * look next at the cheapest cell reached so far, until that cell is the goal.
 */
export function findPath(state: WorldState, from: CellId, to: CellId, id: NationId): CellId[] {
  const { cells } = state;
  const owner = state.state.owner;
  const race = state.nations.get(id)!.race;
  const rights = marchRights(state, id);
  const cost = new Float64Array(cells.length).fill(Infinity);
  const cameFrom = new Int32Array(cells.length).fill(-1);
  const heap = new MinHeap();
  cost[from] = 0;
  heap.push(from, 0);

  while (heap.size > 0) {
    const c = heap.pop();
    if (c === to) break;
    for (const n of cells[c]!.neighbors) {
      if (!cells[n]!.isLand || !rights.has(owner[n]!)) continue;
      const next = cost[c]! + moveCost(cells[n]!, race);
      if (next < cost[n]!) {
        cost[n] = next;
        cameFrom[n] = c;
        heap.push(n, next);
      }
    }
  }
  if (cost[to] === Infinity) return [];

  const path: CellId[] = [];
  for (let c = to; c !== from; c = cameFrom[c]!) path.push(c);
  return path.reverse();
}

/** Cells within `range` steps of `from` that an army of `id` can walk to, nearest first, not counting `from` itself. */
export function landWithin(state: WorldState, from: CellId, range: number, id: NationId): CellId[] {
  const rights = marchRights(state, id);
  const owner = state.state.owner;
  const seen = new Set<CellId>([from]);
  const found: CellId[] = [];
  let ring = [from];
  for (let step = 0; step < range; step++) {
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of state.cells[c]!.neighbors) {
        if (seen.has(n) || !state.cells[n]!.isLand || !rights.has(owner[n]!)) continue;
        seen.add(n);
        next.push(n);
      }
    }
    found.push(...next);
    ring = next;
  }
  return found;
}

/** The nearest army at war with this one's nation within SIM.ENGAGE_RANGE steps, if any. */
export function nearestHostile(state: WorldState, army: Army, hostile: Set<number>): Army | undefined {
  const foes = state.armies.filter((a) => a.size > 0 && hostile.has(pairKey(army.owner, a.owner)));
  if (foes.length === 0) return undefined;
  const here = foes.find((a) => a.cell === army.cell);
  if (here) return here;
  for (const c of landWithin(state, army.cell, SIM.ENGAGE_RANGE, army.owner)) {
    const foe = foes.find((a) => a.cell === c);
    if (foe) return foe;
  }
  return undefined;
}

/** Where a beaten or outmatched army makes for: its nearest settlement, or else its capital. */
export function homeCell(state: WorldState, army: Army): CellId {
  const { owner, settlement } = state.state;
  if (army.target !== NO_TARGET && owner[army.target] === army.owner && settlement[army.target]! > 0) return army.target;
  const [ax, ay] = state.cells[army.cell]!.site;
  let best = state.nations.get(army.owner)!.capital;
  let bestDistance = Infinity;
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] !== army.owner || settlement[c] === 0) continue;
    const [x, y] = state.cells[c]!.site;
    const distance = (x - ax) ** 2 + (y - ay) ** 2;
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
    }
  }
  return best;
}

/** The nearest of `cells` to the army, or NO_TARGET if there are none. */
export function nearestOf(state: WorldState, army: Army, cells: CellId[]): CellId {
  const [ax, ay] = state.cells[army.cell]!.site;
  let best = NO_TARGET;
  let bestDistance = Infinity;
  for (const c of cells) {
    const [x, y] = state.cells[c]!.site;
    const distance = (x - ax) ** 2 + (y - ay) ** 2;
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
    }
  }
  return best;
}

/** Enemy cells this army could still take. */
export function takeable(state: WorldState, army: Army, enemy: Nation, c: CellId): boolean {
  return state.state.owner[c] === enemy.id && state.state.occupier[c] !== army.owner;
}

/** The most valuable of `cells`, as the army's race sees it (NO_TARGET if empty). */
export function richest(state: WorldState, army: Army, cells: Iterable<CellId>, grain: Float64Array): CellId {
  const race = state.nations.get(army.owner)!.race;
  let best = NO_TARGET;
  let bestValue = -Infinity;
  for (const c of cells) {
    const value = cellValue(state, c, race, effectiveCapacity(state, c, grain));
    if (value > bestValue || (value === bestValue && c < best)) {
      best = c;
      bestValue = value;
    }
  }
  return best;
}

/** The enemy's land along the border (or around its capital if they don't touch), as far in as SIM.RAID_RANGE. */
export function borderLand(state: WorldState, army: Army, enemy: Nation): CellId[] {
  const start = frontCells(state, enemy.id, army.owner);
  if (start.length === 0) start.push(enemy.capital);
  const cells = new Set(start);
  for (const c of start) for (const n of landWithin(state, c, SIM.RAID_RANGE, army.owner)) cells.add(n);
  return [...cells].filter((c) => takeable(state, army, enemy, c));
}

/** What the army marches on when there's no fighting to do: rich enemy land nearby, or else near the border. */
export function goalCell(state: WorldState, army: Army, enemy: Nation, grain: Float64Array): CellId {
  if (army.target !== NO_TARGET && takeable(state, army, enemy, army.target)) return army.target;
  const near = landWithin(state, army.cell, SIM.RAID_RANGE, army.owner).filter((c) => takeable(state, army, enemy, c));
  if (takeable(state, army, enemy, army.cell)) near.push(army.cell);
  return richest(state, army, near.length > 0 ? near : borderLand(state, army, enemy), grain);
}

/** Is this army an ally's, in a war it joined rather than one of the two who started it? */
export function helping(army: Army, main: War | undefined): main is War {
  return main !== undefined && army.owner !== main.attacker && army.owner !== main.defender;
}

/** Where a helping army goes: the friend's land the enemy holds, or else after the enemy's armies. */
export function supportCell(state: WorldState, army: Army, enemy: Nation, main: War, held: Map<NationId, CellId[]>): CellId {
  const friend = main.attacker === enemy.id ? main.defender : main.attacker;
  const lost = (held.get(friend) ?? []).filter((c) => state.state.occupier[c] === enemy.id);
  const prey = state.armies.filter((a) => a.owner === enemy.id && a.size > 0).map((a) => a.cell);
  return nearestOf(state, army, lost.length > 0 ? lost : prey);
}
