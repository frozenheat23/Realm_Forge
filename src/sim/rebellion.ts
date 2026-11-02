// Step 7 (SPEC §4.6): unstable nations lose far-off provinces to rebels, subject peoples first.
import type { Rng } from "../core/rng";
import type { CellId, FaithId, Nation, RaceId, SimEvent, WorldState } from "../core/types";
import { traits } from "../gen/races";
import { raiseArmy } from "./armies";
import { carryOut, done, refuse, type Controllers } from "./ai/controller";
import type { CommandOf, CommandResult } from "./commands";
import { commonFaith } from "./faith";
import { rebellionEvent, rebornEvent, warEvent } from "./events";
import { cellsByNation, hopsFromCapital, livingNations, pairKey, setOwner, weightedPick } from "./helpers";
import { SIM } from "./params";
import { addNation, bestCapital, type Heritage } from "./newNation";
import { startWar, warsOf } from "./war";
import { claimedCells } from "./warGoals";

/**
 * Grows a region outward from `seed` through `nation`'s cells, up to `max` cells,
 * never taking the capital. Only enters cells of the seed's culture: rebels are one people.
 * Fills the seed's own province first and only then spills into neighboring ones,
 * so breakaways follow old regional lines.
 */
export function floodFill(state: WorldState, nation: Nation, seed: CellId, max: number): CellId[] {
  const { owner, culture } = state.state;
  const people = culture[seed];
  const home = state.cells[seed]!.province;
  const region: CellId[] = [];
  const seen = new Set<CellId>([seed]);
  // Two queues: cells in the seed's province are always taken before cells outside it.
  const near = [seed];
  const far: CellId[] = [];
  let nearHead = 0;
  let farHead = 0;
  while (region.length < max && (nearHead < near.length || farHead < far.length)) {
    const cell = nearHead < near.length ? near[nearHead++]! : far[farHead++]!;
    region.push(cell);
    for (const n of state.cells[cell]!.neighbors) {
      if (!seen.has(n) && owner[n] === nation.id && culture[n] === people && n !== nation.capital) {
        seen.add(n);
        (state.cells[n]!.province === home ? near : far).push(n);
      }
    }
  }
  return region;
}

/** Picks where a revolt starts among `candidates`, most restless first. Null if it can't grow big enough to be a nation. */
function revoltRegion(state: WorldState, nation: Nation, candidates: CellId[], maxCells: number, rng: Rng): CellId[] | null {
  if (candidates.length === 0) return null;
  const seed = weightedPick(rng, candidates, candidates.map((c) => state.state.unrest[c]!));
  const region = floodFill(state, nation, seed, maxCells);
  return region.length >= SIM.MIN_AREA ? region : null;
}

/**
 * What rebels of culture `people` inherit. The ruling people breaking away become a new
 * culture. A conquered people carry on as themselves, and if no living nation rules
 * that culture, their old realm returns under its old name and color.
 */
function rebelHeritage(state: WorldState, nation: Nation, people: number): Heritage | undefined {
  if (people === nation.culture) return undefined;
  const kin = livingNations(state).some((n) => n.culture === people);
  const founder = state.nations.get(people)!;
  return kin ? { culture: people } : { culture: people, name: founder.name, color: founder.color };
}

/** Did this nation bring back a fallen realm? Then how long ago did that realm last fall. */
function yearsSinceFall(state: WorldState, rebels: Nation): number | null {
  const founder = state.nations.get(rebels.culture)!;
  if (founder.id === rebels.id || founder.name !== rebels.name) return null;
  let fell = 0;
  for (const n of state.nations.values()) if (n.culture === rebels.culture && n.fell !== undefined) fell = Math.max(fell, n.fell);
  return state.year - fell;
}

/**
 * Tries to start one rebellion in `nation`. Returns the new rebel nation, or
 * null if no province is far enough away or the breakaway would be too small.
 */
export function rebel(state: WorldState, nation: Nation, cells: CellId[], rng: Rng, maxCells = SIM.REBEL_MAX_CELLS): Nation | null {
  const hops = hopsFromCapital(state, nation);
  // Rebels start far from the capital, or in land the capital can't even reach.
  const farAway = cells.filter((c) => hops[c]! === -1 || hops[c]! >= SIM.REBEL_MIN_CAPITAL_DIST);
  // Subject peoples rise first. If there are too few of them to form a nation, the ruling people rise instead.
  const foreign = farAway.filter((c) => state.state.culture[c] !== nation.culture);
  const region = revoltRegion(state, nation, foreign, maxCells, rng) ?? revoltRegion(state, nation, farAway, maxCells, rng);
  if (!region) return null;

  // The rebels are ruled by their own people. (`as RaceId`: the typed array only knows it's a number.)
  const rebelRace = state.state.race[region[0]!]! as RaceId;
  const heritage = rebelHeritage(state, nation, state.state.culture[region[0]!]!);
  const rebelNation = addNation(state, rng.fork("name"), bestCapital(state, region), SIM.REBEL_START_STABILITY, rebelRace, nation.id, heritage);
  rebelNation.faith = commonFaith(state, region) as FaithId;
  for (const c of region) {
    setOwner(state, c, rebelNation.id);
    state.state.culture[c] = rebelNation.culture;
    state.state.unrest[c] = 0; // free at last
  }
  // Rebels and their old rulers start out bitter (SPEC §4.12).
  state.relations.set(pairKey(rebelNation.id, nation.id), SIM.REBEL_OPINION);
  return rebelNation;
}

/** The "crushRevolt" command: the old nation goes to war to take back land that broke away, and the rebels stand up an army of their own. */
export function applyCrushRevolt(state: WorldState, cmd: CommandOf<"crushRevolt">): CommandResult {
  const nation = state.nations.get(cmd.nation);
  const rebels = state.nations.get(cmd.rebels);
  if (!nation?.alive || !rebels?.alive) return refuse("there's no such pair of nations");
  if (rebels.parent !== nation.id) return refuse("they didn't break away from it");
  if (state.wars.some((w) => pairKey(w.attacker, w.defender) === pairKey(nation.id, rebels.id))) return refuse("they're already at war");
  if (warsOf(state, nation.id) >= SIM.MAX_WARS_PER_NATION) return refuse("it has too many wars");

  const region = claimedCells(state, nation, rebels);
  const war = startWar(state, nation, rebels, "reclaim", region);
  const { pop, race } = state.state;
  const levy = region.reduce((sum, c) => sum + pop[c]! * traits(race[c]!).martial, 0) * SIM.REBEL_LEVY;
  rebels.reserve += levy;
  raiseArmy(state, rebels, war, nation, levy);
  return done([warEvent(state.year, nation, rebels, " to crush the rebellion")], war);
}

/**
 * Part of the old nation's soldiers go over to the rebels. The old nation may fight at
 * once to take the land back (its controller decides). Returns the war event, if it comes to that.
 */
function takeUpArms(state: WorldState, nation: Nation, rebels: Nation, rng: Rng, controllers: Controllers): SimEvent | null {
  nation.reserve *= 1 - SIM.REBEL_LEVY;
  if (warsOf(state, nation.id) >= SIM.MAX_WARS_PER_NATION) return null;
  const controller = controllers(nation.id);
  if (!controller.crushRevolt(state, nation, rebels, rng)) return null;
  const cmd: CommandOf<"crushRevolt"> = { kind: "crushRevolt", nation: nation.id, rebels: rebels.id };
  const result = applyCrushRevolt(state, cmd);
  return carryOut(controller, cmd, result) ? result.events[0]! : null;
}

/**
 * One region of `nation` rises and takes up arms, if it can. Returns what happened,
 * or null if no region could break away. `rng` should be new to this uprising.
 */
export function uprising(state: WorldState, nation: Nation, cells: CellId[], rng: Rng, controllers: Controllers, maxCells = SIM.REBEL_MAX_CELLS): SimEvent[] | null {
  const rebelNation = rebel(state, nation, cells, rng.fork("revolt"), maxCells);
  if (!rebelNation) return null;
  const yearsGone = yearsSinceFall(state, rebelNation);
  const rose = yearsGone === null ? rebellionEvent(state.year, rebelNation, nation) : rebornEvent(state.year, rebelNation, nation, yearsGone);
  const war = takeUpArms(state, nation, rebelNation, rng.fork("arms"), controllers);
  return war ? [rose, war] : [rose];
}

/** Yearly chance of a first revolt: restless peoples, and a lot of restless land, raise it. */
function revoltChance(state: WorldState, nation: Nation, cells: CellId[]): number {
  const restlessLand = cells.reduce((sum, c) => sum + state.state.unrest[c]!, 0);
  return SIM.REBEL_PROB * nation.unrest * (restlessLand / SIM.REBEL_RESTLESS_CELLS);
}

export function rebellions(state: WorldState, rng: Rng, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];
  const groups = cellsByNation(state);
  // Only nations that existed at the start of this step can rebel (not this year's rebels).
  for (const nation of livingNations(state)) {
    if (nation.stability >= SIM.REBEL_THRESHOLD) continue;
    const nationRng = rng.fork(`nation-${nation.id}`);
    let cells = groups.get(nation.id) ?? [];
    let chance = revoltChance(state, nation, cells);
    // One revolt can set off the next: this is how a great empire falls in a few bad years.
    for (let revolt = 0; revolt < SIM.REBEL_MAX_SPREAD && nationRng.chance(chance); revolt++) {
      const happened = uprising(state, nation, cells, nationRng.fork(`revolt-${revolt}`), controllers);
      if (!happened) break;
      events.push(...happened);
      cells = cells.filter((c) => state.state.owner[c] === nation.id);
      chance = SIM.REBEL_SPREAD;
    }
  }
  return events;
}
