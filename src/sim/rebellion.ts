// Step 7 (SPEC §4.6): unstable nations lose far-off provinces to rebels, subject peoples first.
import type { Rng } from "../core/rng";
import type { CellId, Nation, RaceId, SimEvent, WorldState } from "../core/types";
import { traits } from "../gen/races";
import { raiseArmy } from "./armies";
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
function revoltRegion(state: WorldState, nation: Nation, candidates: CellId[], rng: Rng): CellId[] | null {
  if (candidates.length === 0) return null;
  const seed = weightedPick(rng, candidates, candidates.map((c) => state.state.unrest[c]!));
  const region = floodFill(state, nation, seed, SIM.REBEL_MAX_CELLS);
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
export function rebel(state: WorldState, nation: Nation, cells: CellId[], rng: Rng): Nation | null {
  const hops = hopsFromCapital(state, nation);
  // Rebels start far from the capital, or in land the capital can't even reach.
  const farAway = cells.filter((c) => hops[c]! === -1 || hops[c]! >= SIM.REBEL_MIN_CAPITAL_DIST);
  // Subject peoples rise first. If there are too few of them to form a nation, the ruling people rise instead.
  const foreign = farAway.filter((c) => state.state.culture[c] !== nation.culture);
  const region = revoltRegion(state, nation, foreign, rng) ?? revoltRegion(state, nation, farAway, rng);
  if (!region) return null;

  // The rebels are ruled by their own people. (`as RaceId`: the typed array only knows it's a number.)
  const rebelRace = state.state.race[region[0]!]! as RaceId;
  const heritage = rebelHeritage(state, nation, state.state.culture[region[0]!]!);
  const rebelNation = addNation(state, rng.fork("name"), bestCapital(state, region), SIM.REBEL_START_STABILITY, rebelRace, nation.id, heritage);
  for (const c of region) {
    setOwner(state, c, rebelNation.id);
    state.state.culture[c] = rebelNation.culture;
    state.state.unrest[c] = 0; // free at last
  }
  // Rebels and their old rulers start out bitter (SPEC §4.12).
  state.relations.set(pairKey(rebelNation.id, nation.id), SIM.REBEL_OPINION);
  return rebelNation;
}

/**
 * Part of the old nation's soldiers go over to the rebels. The old nation may fight at
 * once to take the land back, and then the rebels stand up an army of their own.
 * Returns the war event, if it comes to that.
 */
function takeUpArms(state: WorldState, nation: Nation, rebels: Nation, rng: Rng): SimEvent | null {
  nation.reserve *= 1 - SIM.REBEL_LEVY;
  if (warsOf(state, nation.id) >= SIM.MAX_WARS_PER_NATION || !rng.chance(SIM.REBEL_WAR_PROB)) return null;

  const region = claimedCells(state, nation, rebels);
  const war = startWar(state, nation, rebels, "reclaim", region);
  const { pop, race } = state.state;
  const levy = region.reduce((sum, c) => sum + pop[c]! * traits(race[c]!).martial, 0) * SIM.REBEL_LEVY;
  rebels.reserve += levy;
  raiseArmy(state, rebels, war, nation, levy);
  return warEvent(state.year, nation, rebels, " to crush the rebellion");
}

/** Yearly chance of a first revolt: restless peoples, and a lot of restless land, raise it. */
function revoltChance(state: WorldState, nation: Nation, cells: CellId[]): number {
  const restlessLand = cells.reduce((sum, c) => sum + state.state.unrest[c]!, 0);
  return SIM.REBEL_PROB * nation.unrest * (restlessLand / SIM.REBEL_RESTLESS_CELLS);
}

export function rebellions(state: WorldState, rng: Rng): SimEvent[] {
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
      const rebelNation = rebel(state, nation, cells, nationRng.fork(`revolt-${revolt}`));
      if (!rebelNation) break;
      const yearsGone = yearsSinceFall(state, rebelNation);
      events.push(yearsGone === null ? rebellionEvent(state.year, rebelNation, nation) : rebornEvent(state.year, rebelNation, nation, yearsGone));
      const war = takeUpArms(state, nation, rebelNation, nationRng.fork(`arms-${revolt}`));
      if (war) events.push(war);
      cells = cells.filter((c) => state.state.owner[c] === nation.id);
      chance = SIM.REBEL_SPREAD;
    }
  }
  return events;
}
