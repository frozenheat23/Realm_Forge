// Starting a world (docs/systems/start.md). `createWorld` is how the app begins history:
// the map from the seed, and year 0 as the chosen start. For a settled start the old
// kingdoms are aged here, because development and settlements follow the simulation's rules.
import type { Rng } from "../core/rng";
import { createRng } from "../core/rng";
import { Settlement, type StartOptions, type WorldState } from "../core/types";
import { generateWorld, type Generated } from "../gen";
import { nameNationAt } from "../gen/nations";
import { MAX_KINGDOMS, MIN_KINGDOMS, SETTLED_DEV, START_KINGDOMS } from "../gen/params";
import { controlMap } from "./control";
import { takenNames } from "./helpers";
import { markCityArea, threshold } from "./land";
import { SIM } from "./params";
import { effectiveCapacity, grainBonuses } from "./resources";

/** The start the app uses unless told otherwise. */
export const DEFAULT_START: StartOptions = { kind: "settled", kingdoms: START_KINGDOMS };

/** The world for `seed`, opening with `start`. */
export function createWorld(seed: string, start: StartOptions = DEFAULT_START, width?: number, height?: number): Generated {
  const generated = generateWorld(seed, width, height, start);
  if (start.kind === "settled") ageKingdoms(generated.state, createRng(seed).fork("old-kingdoms"));
  return generated;
}

/**
 * Gives old kingdoms what centuries of rule would have built: development, highest where
 * the crown's grip is firm, and the villages, towns and cities that follow from it
 * (cities at least CITY_MIN_SPACING apart, each named). No events: they were always there.
 */
export function ageKingdoms(state: WorldState, rng: Rng): void {
  const { owner, pop, development, settlement } = state.state;
  const control = controlMap(state);
  const grain = grainBonuses(state);
  const owned: number[] = [];
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === 0) continue;
    development[c] = SETTLED_DEV * control[c]!;
    owned.push(c);
  }

  // The most developed land settles first, so cities stand where the crown is strongest.
  owned.sort((a, b) => development[b]! - development[a]! || a - b);
  const nearCity = new Uint8Array(owner.length);
  const taken = new Set([...takenNames(state)]);
  for (const c of owned) {
    const capacity = effectiveCapacity(state, c, grain);
    const peopled = capacity > 0 && pop[c]! / capacity >= SIM.SETTLE_MIN_POP_FRACTION;
    let level = 0;
    while (level < Settlement.City && development[c]! >= threshold(level + 1)) level++;
    if (level >= Settlement.Town && !peopled) level = Settlement.Village;
    if (level === Settlement.City && nearCity[c] === 1) level = Settlement.Town;
    settlement[c] = level;
    if (level !== Settlement.City) continue;
    markCityArea(state, c, nearCity);
    const nation = state.nations.get(owner[c]!)!;
    const [x, y] = state.cells[c]!.site;
    const name = nameNationAt(rng.fork(`city-${c}`), state.cultureHomes, taken, x, y, nation.race);
    taken.add(name);
    state.cityNames.set(c, name);
  }
}

/** A start from the page address: "open", or a number of kingdoms (anything else gives the default). */
export function startFromText(text: string | null): StartOptions {
  if (text === "open") return { kind: "open" };
  const kingdoms = Number(text);
  if (Number.isInteger(kingdoms) && kingdoms >= MIN_KINGDOMS && kingdoms <= MAX_KINGDOMS) return { kind: "settled", kingdoms };
  return DEFAULT_START;
}

/** How a start reads in the page address: "open" or the number of kingdoms. */
export function startToText(start: StartOptions): string {
  return start.kind === "open" ? "open" : String(start.kingdoms);
}
