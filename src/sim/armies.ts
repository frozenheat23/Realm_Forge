// Armies (SPEC §4.13): raised for each war, reinforced from the reserve, marching
// across the map one season at a time, fighting and besieging as they go, and sent
// home when their war ends.
import type { Rng } from "../core/rng";
import { Biome, NO_TARGET, type Army, type CellId, type Nation, type NationId, type War, type WorldState } from "../core/types";
import { carryOut, done, refuse, type ArmyOrders, type Controllers } from "./ai/controller";
import { fightBattles } from "./battle";
import type { CommandOf, CommandResult } from "./commands";
import { allied } from "./diplomacy";
import { frontCells, livingNations, moveCost, pairKey, warPairs } from "./helpers";
import { armiesOf, loseSoldiers } from "./manpower";
import { findPath, homeCell, marchRights } from "./marching";
import { SIM } from "./params";
import { grainBonuses } from "./resources";
import { appointGeneral, retireGeneral } from "./generals";
import { besiege, hostileNear, liberate, occupiedLand } from "./siege";

// Moved to marching.ts; tests still import it from here.
export { findPath };

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
  const id = state.nextArmyId++;
  state.armies.push({ id, owner: nation.id, war: war.id, cell, size, morale: 1, target: NO_TARGET, path: [], trail: [cell], general: appointGeneral(state, nation, id) });
  nation.reserve -= size;
}

/** An army in its own or an ally's land, or land its side occupies, can be supplied. */
function inSupply(state: WorldState, army: Army): boolean {
  const holder = state.state.owner[army.cell]!;
  const occupier = state.state.occupier[army.cell]!;
  const friendly = (id: NationId) => id === army.owner || allied(state, id, army.owner);
  return friendly(holder) || (occupier !== 0 && friendly(occupier));
}

/** The "mobilize" command: raise `size` soldiers from the reserve as the nation's army in one of its wars. */
export function applyMobilize(state: WorldState, cmd: CommandOf<"mobilize">): CommandResult {
  const nation = state.nations.get(cmd.nation);
  const war = state.wars.find((w) => w.id === cmd.war);
  if (!nation?.alive) return refuse("there's no such nation");
  if (!war || (war.attacker !== nation.id && war.defender !== nation.id)) return refuse("it isn't in that war");
  if (state.armies.some((a) => a.owner === nation.id && a.war === war.id)) return refuse("it already has an army in that war");
  const enemy = state.nations.get(war.attacker === nation.id ? war.defender : war.attacker);
  if (!enemy?.alive) return refuse("the enemy is gone");
  if (!(cmd.size >= SIM.MIN_ARMY_SIZE)) return refuse("too few soldiers for an army");
  // A hair over the reserve is rounding, not a real overdraw.
  if (cmd.size > nation.reserve + 1e-9) return refuse("there aren't that many soldiers in the reserve");
  raiseArmy(state, nation, war, enemy, cmd.size);
  return done();
}

/** Step 5b: every war gets an army on each side (as many soldiers as the controller raises), and armies in supply get fresh soldiers. */
export function musterArmies(state: WorldState, controllers: Controllers): void {
  for (const nation of livingNations(state)) {
    const wars = state.wars.filter((w) => w.attacker === nation.id || w.defender === nation.id);
    const armies = armiesOf(state, nation.id);

    const unmanned = wars.filter((w) => !armies.some((a) => a.war === w.id));
    if (unmanned.length > 0) {
      const controller = controllers(nation.id);
      const sizes = controller.mobilize(state, nation, unmanned);
      unmanned.forEach((war, i) => {
        const enemy = state.nations.get(war.attacker === nation.id ? war.defender : war.attacker);
        const size = sizes[i] ?? 0;
        // An army smaller than SIM.MIN_ARMY_SIZE would only disband again: that's no army.
        if (!enemy?.alive || size < SIM.MIN_ARMY_SIZE) return;
        const cmd: CommandOf<"mobilize"> = { kind: "mobilize", nation: nation.id, war: war.id, size };
        carryOut(controller, cmd, applyMobilize(state, cmd));
      });
    }

    const supplied = armies.filter((a) => inSupply(state, a));
    if (supplied.length === 0) continue;
    const sent = nation.reserve * SIM.REINFORCE_RATE;
    for (const army of supplied) army.size += sent / supplied.length;
    nation.reserve -= sent;
  }
}

/** The way for `army` to `target` (empty if it's there already), or null if it can't get there. */
function wayTo(state: WorldState, army: Army, target: CellId): CellId[] | null {
  if (target < 0 || target >= state.cells.length) return null;
  // Land it may not enter can't be reached, and a failed search covers the whole map.
  if (!marchRights(state, army.owner).has(state.state.owner[target]!)) return null;
  if (target === army.cell) return [];
  const path = findPath(state, army.cell, target, army.owner);
  return path.length > 0 ? path : null;
}

/** Already heading for `target` on a good path (or standing on it)? Then there's no need to look for the way again. */
function onTheWay(army: Army, target: CellId): boolean {
  return target === army.target && (army.path.length > 0 || army.cell === target);
}

/**
 * The "orderArmy" command: point the army at `target`, or stand still for NO_TARGET.
 * `known` holds ways already found this season, so they aren't searched twice.
 */
export function applyOrderArmy(state: WorldState, cmd: CommandOf<"orderArmy">, known?: Map<CellId, CellId[]>): CommandResult {
  const army = state.armies.find((a) => a.id === cmd.army);
  if (!army) return refuse("there's no such army");
  if (cmd.target === NO_TARGET) {
    army.target = NO_TARGET;
    army.path = [];
    return done();
  }
  if (onTheWay(army, cmd.target)) return done();
  const path = known?.get(cmd.target) ?? wayTo(state, army, cmd.target);
  if (path === null) return refuse("the army can't get there");
  army.target = cmd.target;
  army.path = path;
  return done();
}

/** Points the army at `target` if it can get there. Returns false, changing nothing, if not. */
function aim(state: WorldState, army: Army, target: CellId): boolean {
  if (target === NO_TARGET) return false;
  if (onTheWay(army, target)) return true;
  const path = wayTo(state, army, target);
  if (path === null) return false;
  army.target = target;
  army.path = path;
  return true;
}

/**
 * Each season, an army gets its orders. Retreat is a rule: below SIM.RETREAT_MORALE
 * the soldiers make for home whatever their ruler says. Otherwise the controller decides.
 */
function direct(state: WorldState, army: Army, orders: Omit<ArmyOrders, "reach">, controllers: Controllers): void {
  if (army.morale < SIM.RETREAT_MORALE && aim(state, army, homeCell(state, army))) return;
  const known = new Map<CellId, CellId[]>();
  const reach = (cell: CellId): boolean => {
    if (cell === NO_TARGET) return false;
    if (onTheWay(army, cell)) return true;
    const path = wayTo(state, army, cell);
    if (path === null) return false;
    known.set(cell, path);
    return true;
  };
  const controller = controllers(army.owner);
  const target = controller.orderArmy(state, army, { ...orders, reach });
  const cmd: CommandOf<"orderArmy"> = { kind: "orderArmy", army: army.id, target };
  carryOut(controller, cmd, applyOrderArmy(state, cmd, known));
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
export function campaign(state: WorldState, rng: Rng, controllers: Controllers): void {
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
      direct(state, army, { war, enemy, main, hostile, held, grain, season }, controllers);
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
    retireGeneral(state, nation, army.general);
    return false;
  });
}
