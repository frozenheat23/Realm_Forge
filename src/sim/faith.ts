// Step 2, after the land (SPEC §4.14): faiths spread from neighbor to neighbor, and the Old Gods stir.
import type { Rng } from "../core/rng";
import { Faith, type CellId, type FaithId, type Nation, type NationId, type SimEvent, type WorldState } from "../core/types";
import { faithInfo } from "../gen/faiths";
import { traits } from "../gen/races";
import { conversionEvent, oldGodsEvent } from "./events";
import { livingNations } from "./helpers";
import { SIM } from "./params";

/** One slot per FaithId, 0 included. */
const FAITH_COUNT = Object.keys(Faith).length;

/** Yearly chance the people of `cell`, under `nation`, take up `faith` from a neighbor. 0 if they can't. */
export function conversionChance(state: WorldState, cell: CellId, faith: number, nation: Nation): number {
  const { race, unrest } = state.state;
  const people = traits(race[cell]!);
  const info = faithInfo(faith);
  if (info.races && !info.races.includes(race[cell]! as never)) return 0;
  let chance = SIM.FAITH_RATE * info.reach * people.conversion;
  if (faith !== nation.faith) chance *= SIM.FAITH_FOREIGN_SPREAD;
  if (faith === Faith.OldGods) {
    chance *= 1 + SIM.OLD_GODS_UNREST_REACH * unrest[cell]!; // they find their followers in troubled land
    if (people.family === "elf") chance *= SIM.OLD_GODS_ELF_SPREAD;
  }
  return chance;
}

/**
 * Each cell looks at one random neighbor and may take up its faith, which grows
 * solid blobs of belief. Capitals keep theirs. Very restless land may turn to the
 * Old Gods all by itself, even where they were long forgotten.
 */
export function spreadFaith(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const { owner, faith, unrest } = state.state;
  // Only a nation's first cult makes the news; after that it's old news.
  const haunted = new Set<number>();
  for (let c = 0; c < owner.length; c++) if (faith[c] === Faith.OldGods) haunted.add(owner[c]!);

  for (let c = 0; c < owner.length; c++) {
    const nation = state.nations.get(owner[c]!);
    if (!nation || c === nation.capital) continue;
    const neighbor = faith[rng.pick(state.cells[c]!.neighbors)]!;
    if (neighbor !== 0 && neighbor !== faith[c] && rng.chance(conversionChance(state, c, neighbor, nation))) faith[c] = neighbor;

    if (unrest[c]! >= SIM.OLD_GODS_MIN_UNREST && faith[c] !== Faith.OldGods && rng.chance(SIM.OLD_GODS_SPARK)) {
      faith[c] = Faith.OldGods;
      if (!haunted.has(nation.id)) events.push(oldGodsEvent(state.year, nation, state.cells[nation.capital]!.site, state.cells[c]!.site));
      haunted.add(nation.id);
    }
  }
  return events;
}

/** A nation whose people have mostly left its faith may follow them (SPEC §4.14). */
export function convertRealms(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const { owner, faith, pop } = state.state;
  // People per faith in each nation.
  const believers = new Map<NationId, Float64Array>();
  for (const nation of livingNations(state)) believers.set(nation.id, new Float64Array(FAITH_COUNT));
  for (let c = 0; c < owner.length; c++) {
    const tally = believers.get(owner[c]!);
    if (tally) tally[faith[c]!] = tally[faith[c]!]! + pop[c]!;
  }

  for (const [id, tally] of believers) {
    const nation = state.nations.get(id)!;
    const total = tally.reduce((sum, count) => sum + count, 0);
    // The biggest faith, if it isn't already the realm's.
    let rival: number = nation.faith;
    for (let f = 1; f < FAITH_COUNT; f++) if (tally[f]! > tally[rival]!) rival = f;
    if (rival === nation.faith || tally[rival]! < total * SIM.FAITH_MAJORITY || !rng.chance(SIM.FAITH_ADOPT)) continue;
    nation.faith = rival as FaithId;
    faith[nation.capital] = rival; // the throne goes first; capitals don't change on their own
    events.push(conversionEvent(state.year, nation));
  }
  return events;
}

/** The faith most people in `cells` hold (lowest id wins a tie). */
export function commonFaith(state: WorldState, cells: CellId[]): number {
  const believers = new Map<number, number>();
  for (const c of cells) believers.set(state.state.faith[c]!, (believers.get(state.state.faith[c]!) ?? 0) + state.state.pop[c]!);
  let best = 0;
  let most = -1;
  for (const [faith, count] of [...believers].sort((a, b) => a[0] - b[0])) {
    if (count > most) [best, most] = [faith, count];
  }
  return best;
}
