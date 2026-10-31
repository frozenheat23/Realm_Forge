// Armies (SPEC §4.13): raised for each war, reinforced from the reserve, marching
// across the map one season at a time, fighting and besieging as they go, and sent
// home when their war ends.
import type { Rng } from "../core/rng";
import { Biome, NO_TARGET, type Army, type CellId, type Nation, type NationId, type War, type WorldState } from "../core/types";
import { MinHeap } from "../gen/rivers";
import { fightBattles } from "./battle";
import { allied, alliesOf } from "./diplomacy";
import { livingNations, moveCost, pairKey, warPairs } from "./helpers";
import { armiesOf, armyPower, loseSoldiers } from "./manpower";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses } from "./resources";
import { besiege, hostileNear, liberate, occupiedLand } from "./siege";
import { frontCells } from "./war";
import { openGoals } from "./warGoals";

/** Armies standing in `cell`. */
export function armiesIn(state: WorldState, cell: CellId): Army[] {
  return state.armies.filter((a) => a.cell === cell);
}

/**
 * Where an army musters: the nearest settlement to the front, reached over the
 * nation's own land, so it can always march from there. A nation's land can be in
 * pieces, and an army raised on the wrong piece could never reach the war.
 */
function musterCell(state: WorldState, nation: Nation, enemy: Nation): CellId {
  const { owner, settlement } = state.state;
  const front = frontCells(state, nation.id, enemy.id);
  if (front.length === 0) return nation.capital; // they don't touch: an ally's war
  const seen = new Set(front);
  let ring = front;
  while (ring.length > 0) {
    const town = ring.find((c) => settlement[c]! > 0);
    if (town !== undefined) return town;
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of state.cells[c]!.neighbors) {
        if (owner[n] !== nation.id || seen.has(n)) continue;
        seen.add(n);
        next.push(n);
      }
    }
    ring = next;
  }
  return front[0]!;
}

export function raiseArmy(state: WorldState, nation: Nation, war: War, enemy: Nation, size: number): void {
  const cell = musterCell(state, nation, enemy);
  state.armies.push({ id: state.nextArmyId++, owner: nation.id, war: war.id, cell, size, morale: 1, target: NO_TARGET, path: [], trail: [cell] });
  nation.reserve -= size;
}

/** An army in its own or an ally's land, or land its side occupies, can be supplied. */
function inSupply(state: WorldState, army: Army): boolean {
  const holder = state.state.owner[army.cell]!;
  const occupier = state.state.occupier[army.cell]!;
  const friendly = (id: NationId) => id === army.owner || allied(state, id, army.owner);
  return friendly(holder) || (occupier !== 0 && friendly(occupier));
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

/** Cells within `range` steps of `from` that an army of `id` can walk to, nearest first, not counting `from` itself. */
function landWithin(state: WorldState, from: CellId, range: number, id: NationId): CellId[] {
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
function nearestHostile(state: WorldState, army: Army, hostile: Set<number>): Army | undefined {
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
function homeCell(state: WorldState, army: Army): CellId {
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
function nearestOf(state: WorldState, army: Army, cells: CellId[]): CellId {
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
function takeable(state: WorldState, army: Army, enemy: Nation, c: CellId): boolean {
  return state.state.owner[c] === enemy.id && state.state.occupier[c] !== army.owner;
}

/** The most valuable of `cells`, as the army's race sees it (NO_TARGET if empty). */
function richest(state: WorldState, army: Army, cells: Iterable<CellId>, grain: Float64Array): CellId {
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
function borderLand(state: WorldState, army: Army, enemy: Nation): CellId[] {
  const start = frontCells(state, enemy.id, army.owner);
  if (start.length === 0) start.push(enemy.capital);
  const cells = new Set(start);
  for (const c of start) for (const n of landWithin(state, c, SIM.RAID_RANGE, army.owner)) cells.add(n);
  return [...cells].filter((c) => takeable(state, army, enemy, c));
}

/** What the army marches on when there's no fighting to do: rich enemy land nearby, or else near the border. */
function goalCell(state: WorldState, army: Army, enemy: Nation, grain: Float64Array): CellId {
  if (army.target !== NO_TARGET && takeable(state, army, enemy, army.target)) return army.target;
  const near = landWithin(state, army.cell, SIM.RAID_RANGE, army.owner).filter((c) => takeable(state, army, enemy, c));
  if (takeable(state, army, enemy, army.cell)) near.push(army.cell);
  return richest(state, army, near.length > 0 ? near : borderLand(state, army, enemy), grain);
}

/** Points the army at `target`, finding the way only if that's a change. Returns false, changing nothing, if there's no way there. */
function aim(state: WorldState, army: Army, target: CellId): boolean {
  if (target === NO_TARGET) return false;
  if (target === army.target && (army.path.length > 0 || army.cell === target)) return true;
  // Land it may not enter can't be reached, and a failed search covers the whole map.
  if (!marchRights(state, army.owner).has(state.state.owner[target]!)) return false;
  const path = target === army.cell ? [] : findPath(state, army.cell, target, army.owner);
  if (path.length === 0 && target !== army.cell) return false;
  army.target = target;
  army.path = path;
  return true;
}

/** Is this army an ally's, in a war it joined rather than one of the two who started it? */
function helping(army: Army, main: War | undefined): main is War {
  return main !== undefined && army.owner !== main.attacker && army.owner !== main.defender;
}

/** Where a helping army goes: the friend's land the enemy holds, or else after the enemy's armies. */
function supportCell(state: WorldState, army: Army, enemy: Nation, main: War, held: Map<NationId, CellId[]>): CellId {
  const friend = main.attacker === enemy.id ? main.defender : main.attacker;
  const lost = (held.get(friend) ?? []).filter((c) => state.state.occupier[c] === enemy.id);
  const prey = state.armies.filter((a) => a.owner === enemy.id && a.size > 0).map((a) => a.cell);
  return nearestOf(state, army, lost.length > 0 ? lost : prey);
}

/** The rules in SPEC §4.13: the first that gives somewhere the army can reach wins. */
function direct(state: WorldState, army: Army, war: War, enemy: Nation, main: War | undefined, hostile: Set<number>, held: Map<NationId, CellId[]>, grain: Float64Array, season: number): void {
  if (army.morale < SIM.RETREAT_MORALE && aim(state, army, homeCell(state, army))) return;
  const foe = nearestHostile(state, army, hostile);
  if (foe) {
    const strong = armyPower(state, army) >= SIM.ENGAGE_RATIO * armyPower(state, foe);
    if (aim(state, army, strong ? foe.cell : homeCell(state, army))) return;
  }
  const lost = (held.get(army.owner) ?? []).filter((c) => state.state.occupier[c] === enemy.id);
  if (aim(state, army, nearestOf(state, army, lost))) return;
  if (helping(army, main) && aim(state, army, supportCell(state, army, enemy, main, held))) return;
  // An army with no way to its enemy only tries again next year.
  if (army.target === NO_TARGET && season > 0) return;
  if (war.attacker === army.owner) {
    const goals = openGoals(state, war);
    if (aim(state, army, goals.includes(army.target) ? army.target : nearestOf(state, army, goals))) return;
  }
  if (aim(state, army, goalCell(state, army, enemy, grain))) return;
  army.target = NO_TARGET;
  army.path = [];
}

/** One season's march: walk along the path until the move points run out or it meets the enemy. */
function walk(state: WorldState, army: Army, hostile: Set<number>, moved: Set<number>): void {
  const retreating = army.morale < SIM.RETREAT_MORALE;
  if (!retreating && hostileNear(state, army, army.cell, hostile)) return; // it stands and fights
  const { owner, devastation } = state.state;
  const race = state.nations.get(army.owner)!.race;
  const rights = marchRights(state, army.owner);
  let moves = SIM.ARMY_MOVE;
  while (moves > 0 && army.path.length > 0) {
    const next = army.path[0]!;
    // A border can close mid-march (a war ends, an alliance breaks): find another way.
    if (!rights.has(owner[next]!)) {
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
    moved.add(army.id);
    liberate(state, army, next, hostile);
    if (hostile.has(pairKey(army.owner, owner[next]!))) devastation[next] = Math.min(1, devastation[next]! + SIM.DEVASTATION_MARCH);
    if (hostileNear(state, army, next, hostile)) return;
  }
}

/** Season step: hunger and desertion outside supply; rest at home. */
function wearDown(state: WorldState, army: Army): void {
  const cell = state.cells[army.cell]!;
  if (!inSupply(state, army)) {
    const harsh = cell.mountain || cell.biome === Biome.Desert || cell.biome === Biome.Tundra || cell.biome === Biome.Ice;
    const lost = army.size * SIM.ARMY_ATTRITION * (harsh ? 2 : 1);
    loseSoldiers(state, state.nations.get(army.owner)!, lost, army.war);
  }
  if (state.state.owner[cell.id] === army.owner) army.morale = Math.min(1, army.morale + SIM.MORALE_RECOVERY);
}

/** Step 6: SIM.CAMPAIGN_STEPS seasons of choosing targets, marching, fighting and besieging. */
export function campaign(state: WorldState, rng: Rng): void {
  state.battles = [];
  if (state.armies.length === 0) return;
  const grain = grainBonuses(state);
  const wars = new Map(state.wars.map((w) => [w.id, w]));
  const hostile = warPairs(state);
  for (const army of state.armies) army.trail = [army.cell];

  for (let season = 0; season < SIM.CAMPAIGN_STEPS; season++) {
    const held = occupiedLand(state);
    const moved = new Set<number>();
    for (const army of state.armies) {
      const war = wars.get(army.war);
      if (!war) continue;
      const enemy = state.nations.get(war.attacker === army.owner ? war.defender : war.attacker)!;
      if (!enemy.alive) continue;
      const main = war.joined === undefined ? undefined : wars.get(war.joined);
      direct(state, army, war, enemy, main, hostile, held, grain, season);
      walk(state, army, hostile, moved);
    }
    fightBattles(state, hostile, moved, rng.fork(`season-${season}`));
    state.armies = state.armies.filter((a) => a.size > 0);
    besiege(state, hostile);
    for (const army of state.armies) wearDown(state, army);
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
