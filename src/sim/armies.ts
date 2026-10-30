// Armies (SPEC §4.13): raised for each war, reinforced from the reserve, marching
// across the map one season at a time, and sent home when their war ends.
// So far they only march: battles and sieges arrive in M11 step 3.
import { NO_TARGET, type Army, type CellId, type Nation, type NationId, type War, type WorldState } from "../core/types";
import { MinHeap } from "../gen/rivers";
import { allied, alliesOf } from "./diplomacy";
import { livingNations, moveCost } from "./helpers";
import { armiesOf } from "./manpower";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses } from "./resources";
import { frontCells } from "./war";

/** Armies standing in `cell`. */
export function armiesIn(state: WorldState, cell: CellId): Army[] {
  return state.armies.filter((a) => a.cell === cell);
}

/** The nation's own city nearest the enemy: its best settlement level, then the shortest distance. */
function musterCell(state: WorldState, nation: Nation, enemy: Nation): CellId {
  const { owner, settlement } = state.state;
  const [ex, ey] = state.cells[enemy.capital]!.site;
  let best = nation.capital;
  let bestLevel = -1;
  let bestDistance = Infinity;
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] !== nation.id || settlement[c]! === 0) continue;
    const [x, y] = state.cells[c]!.site;
    const distance = (x - ex) ** 2 + (y - ey) ** 2;
    if (settlement[c]! > bestLevel || (settlement[c]! === bestLevel && distance < bestDistance)) {
      best = c;
      bestLevel = settlement[c]!;
      bestDistance = distance;
    }
  }
  return best;
}

function raiseArmy(state: WorldState, nation: Nation, war: War, enemy: Nation, size: number): void {
  const cell = musterCell(state, nation, enemy);
  state.armies.push({ id: state.nextArmyId++, owner: nation.id, war: war.id, cell, size, morale: 1, target: NO_TARGET, path: [], trail: [cell] });
  nation.reserve -= size;
}

/** An army standing in its own or an ally's land can be sent fresh soldiers. */
function inSupply(state: WorldState, army: Army): boolean {
  const holder = state.state.owner[army.cell]!;
  return holder === army.owner || allied(state, holder, army.owner);
}

/** Step 5b: every war gets an army on each side, and armies in supply get fresh soldiers. */
export function musterArmies(state: WorldState): void {
  for (const nation of livingNations(state)) {
    const wars = state.wars.filter((w) => w.attacker === nation.id || w.defender === nation.id);
    const armies = armiesOf(state, nation.id);

    const unmanned = wars.filter((w) => !armies.some((a) => a.war === w.id));
    const size = (nation.reserve * SIM.MOBILIZE_SHARE) / Math.max(1, unmanned.length);
    for (const war of unmanned) {
      const enemy = state.nations.get(war.attacker === nation.id ? war.defender : war.attacker);
      if (enemy?.alive && size >= SIM.MIN_ARMY_SIZE) raiseArmy(state, nation, war, enemy, size);
    }

    const supplied = armies.filter((a) => inSupply(state, a));
    if (supplied.length === 0) continue;
    const sent = nation.reserve * SIM.REINFORCE_RATE;
    for (const army of supplied) army.size += sent / supplied.length;
    nation.reserve -= sent;
  }
}

/** Nations whose land an army of `id` may cross: its own, its allies' and its enemies'. Empty land (0) is open too. */
function marchRights(state: WorldState, id: NationId): Set<NationId> {
  const rights = new Set<NationId>([0, id, ...alliesOf(state, id)]);
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

/** The enemy's most valuable cell within SIM.RAID_RANGE steps of the border (its capital's area if they don't touch). */
function chooseTarget(state: WorldState, army: Army, enemy: Nation, grain: Float64Array): CellId {
  const owner = state.state.owner;
  const race = state.nations.get(army.owner)!.race;
  let ring = frontCells(state, enemy.id, army.owner);
  if (ring.length === 0 && owner[enemy.capital] === enemy.id) ring = [enemy.capital];

  // Spread inward from the border, one ring of enemy cells at a time.
  const seen = new Set(ring);
  for (let range = 0; range < SIM.RAID_RANGE; range++) {
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of state.cells[c]!.neighbors) {
        if (owner[n] !== enemy.id || seen.has(n)) continue;
        seen.add(n);
        next.push(n);
      }
    }
    ring = next;
  }

  let best = NO_TARGET;
  let bestValue = -Infinity;
  for (const c of seen) {
    const value = cellValue(state, c, race, effectiveCapacity(state, c, grain));
    if (value > bestValue || (value === bestValue && c < best)) {
      best = c;
      bestValue = value;
    }
  }
  return best;
}

/** Sets the army's target and the path there. With no way there, it stays put with no target. */
function retarget(state: WorldState, army: Army, enemy: Nation, grain: Float64Array): void {
  army.target = chooseTarget(state, army, enemy, grain);
  army.path = army.target === NO_TARGET ? [] : findPath(state, army.cell, army.target, army.owner);
  if (army.path.length === 0 && army.cell !== army.target) army.target = NO_TARGET;
}

/** One season's march: walk along the path until the move points run out. */
function walk(state: WorldState, army: Army): void {
  const race = state.nations.get(army.owner)!.race;
  const rights = marchRights(state, army.owner);
  let moves = SIM.ARMY_MOVE;
  while (moves > 0 && army.path.length > 0) {
    const next = army.path[0]!;
    // A border can close mid-march (a war ends, an alliance breaks): find another way.
    if (!rights.has(state.state.owner[next]!)) {
      army.path = findPath(state, army.cell, army.target, army.owner);
      if (army.path.length === 0) {
        army.target = NO_TARGET;
        return;
      }
      continue;
    }
    moves -= moveCost(state.cells[next]!, race);
    army.cell = next;
    army.trail.push(next);
    army.path.shift();
  }
}

/** Step 6: SIM.CAMPAIGN_STEPS seasons of choosing a target and marching. */
export function marchArmies(state: WorldState): void {
  if (state.armies.length === 0) return;
  const grain = grainBonuses(state);
  const wars = new Map(state.wars.map((w) => [w.id, w]));
  for (const army of state.armies) army.trail = [army.cell];

  for (let season = 0; season < SIM.CAMPAIGN_STEPS; season++) {
    for (const army of state.armies) {
      const war = wars.get(army.war);
      if (!war) continue;
      const enemy = state.nations.get(war.attacker === army.owner ? war.defender : war.attacker)!;
      if (!enemy.alive) continue;
      // Pick a new target when this one has fallen. An army with no way to its
      // enemy only tries again next year: searching the whole map is slow.
      const fallen = army.target !== NO_TARGET && state.state.owner[army.target] !== enemy.id;
      if (fallen || (army.target === NO_TARGET && season === 0)) retarget(state, army, enemy, grain);
      walk(state, army);
    }
  }
}

/** After the year's wars: armies with no war or too few soldiers go home. A dead nation's armies just melt away. */
export function disbandArmies(state: WorldState): void {
  const wars = new Set(state.wars.map((w) => w.id));
  state.armies = state.armies.filter((army) => {
    const nation = state.nations.get(army.owner)!;
    if (nation.alive && wars.has(army.war) && army.size >= SIM.MIN_ARMY_SIZE) return true;
    if (nation.alive) nation.reserve += army.size;
    return false;
  });
}
