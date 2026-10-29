// Races (SPEC §4.10): trait lookups, and placing each race's homelands on the map.
import type { Rng } from "../core/rng";
import { Race, type Cell, type PlayableRace, type RaceHome, type RaceId, type RaceTraits } from "../core/types";
import { RACE_HOME_FOCUS, RACE_HOMES_PER_RACE, RACES } from "./params";

/** Every race that has traits, in id order (Human first). */
export const PLAYABLE_RACES = Object.keys(RACES).map(Number) as PlayableRace[];

/**
 * A race's traits. Takes a plain number because per-cell races are stored in a
 * Uint8Array. Nobody (Race.None) counts as Human, the neutral baseline.
 */
export function traits(race: number): RaceTraits {
  return RACES[race as PlayableRace] ?? RACES[Race.Human];
}

/** How much more (or less) a race likes this cell's land: biome affinity × mountain affinity. */
export function affinityFactor(cell: Cell, race: number): number {
  const t = traits(race);
  return (t.affinity[cell.biome] ?? 1) * (cell.mountain ? t.mountainAffinity : 1);
}

/** How many people of `race` this cell can hold. */
export function raceCapacity(cell: Cell, race: number): number {
  return cell.capacity * affinityFactor(cell, race);
}

/** How much harder (above 1) or easier (below 1) this cell is for `race` to settle. */
export function raceTerrainCost(cell: Cell, race: number): number {
  const t = traits(race);
  return (t.terrainCost[cell.biome] ?? 1) * (cell.mountain ? t.mountainCost : 1);
}

/**
 * Picks RACE_HOMES_PER_RACE homeland cells for every race. Each pick is random,
 * but land the race likes is far more likely: weight = capacity × affinity ^ RACE_HOME_FOCUS.
 */
export function placeRaceHomes(rng: Rng, cells: Cell[]): RaceHome[] {
  const land = cells.filter((c) => c.isLand && c.capacity > 0);
  const homes: RaceHome[] = [];
  for (const race of PLAYABLE_RACES) {
    const weights = land.map((c) => c.capacity * affinityFactor(c, race) ** RACE_HOME_FOCUS);
    const total = weights.reduce((sum, w) => sum + w, 0);
    for (let k = 0; k < RACE_HOMES_PER_RACE; k++) {
      // Weighted pick: walk the list until the running total passes a random point.
      let target = rng.next() * total;
      let chosen = land[land.length - 1]!;
      for (let i = 0; i < land.length; i++) {
        target -= weights[i]!;
        if (target <= 0) {
          chosen = land[i]!;
          break;
        }
      }
      homes.push({ race, at: [...chosen.site] });
    }
  }
  return homes;
}

/** The race of the homeland point nearest to (x, y). */
export function raceAt(homes: RaceHome[], x: number, y: number): RaceId {
  let race: RaceId = Race.Human;
  let best = Infinity;
  for (const home of homes) {
    const d = (home.at[0] - x) ** 2 + (home.at[1] - y) ** 2;
    if (d < best) [best, race] = [d, home.race];
  }
  return race;
}
