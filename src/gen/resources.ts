// Resources and terrain defense (SPEC §4.11): fixed facts about each cell, made once at generation.
import type { Rng } from "../core/rng";
import { Biome, Resource, type Cell, type ResourceKind } from "../core/types";
import {
  BIOME_STATS,
  HIGH_MOUNTAIN_H,
  HILL_H,
  MOUNTAIN_DEFENSE,
  RESOURCE_PROB,
  RESOURCES,
  RICHNESS_SKEW,
  RIVER_DEFENSE,
} from "./params";

/** Every resource type, in id order. */
export const RESOURCE_KINDS = Object.keys(RESOURCES).map(Number) as ResourceKind[];

/** Can this resource appear in this cell? */
export function fits(cell: Cell, resource: ResourceKind): boolean {
  if (!cell.isLand) return false;
  const b = cell.biome;
  switch (resource) {
    case Resource.Grain:
      return cell.river || b === Biome.Grassland;
    case Resource.Timber:
      return b === Biome.TemperateForest || b === Biome.TropicalForest || b === Biome.Taiga;
    case Resource.Iron:
      return !cell.mountain && cell.elevation >= HILL_H;
    case Resource.Gold:
      return cell.mountain;
    case Resource.Horses:
      return b === Biome.Grassland || b === Biome.Savanna || b === Biome.Shrubland;
    case Resource.Mithril:
      return cell.elevation >= HIGH_MOUNTAIN_H;
  }
}

/**
 * Gives about RESOURCE_PROB of land cells a deposit. The type is picked at
 * random among the ones that fit the cell, weighted by rarity; richness is
 * random ^ RICHNESS_SKEW, so most deposits are poor and a few are rich.
 */
export function placeResources(rng: Rng, cells: Cell[]): void {
  for (const cell of cells) {
    if (!cell.isLand || !rng.chance(RESOURCE_PROB)) continue;
    const options = RESOURCE_KINDS.filter((r) => fits(cell, r));
    if (options.length === 0) continue;
    const total = options.reduce((sum, r) => sum + RESOURCES[r].weight, 0);
    let target = rng.next() * total;
    let chosen = options[options.length - 1]!;
    for (const r of options) {
      target -= RESOURCES[r].weight;
      if (target <= 0) {
        chosen = r;
        break;
      }
    }
    cell.resource = chosen;
    cell.richness = rng.next() ** RICHNESS_SKEW;
  }
}

/** How hard a cell is to take in war: biome defense × mountain × river. */
export function defensibilityOf(cell: Cell): number {
  return BIOME_STATS[cell.biome].defense * (cell.mountain ? MOUNTAIN_DEFENSE : 1) * (cell.river ? RIVER_DEFENSE : 1);
}
