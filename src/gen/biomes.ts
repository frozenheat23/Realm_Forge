// Picks a biome from temperature and moisture, and works out how many people a cell can hold.
import { Biome, type BiomeId } from "../core/types";
import {
  BIOME_STATS,
  COAST_CAP_MULT,
  DRY_MOISTURE,
  FOREST_MOISTURE,
  HOT_TEMP,
  ICE_TEMP,
  MOUNTAIN_CAP_MULT,
  RIVER_CAP_MULT,
  SEMI_DRY_MOISTURE,
  TAIGA_TEMP,
  TUNDRA_TEMP,
  WETLAND_MAX_ELEVATION,
  WETLAND_MOISTURE,
} from "./params";

/**
 * Whittaker-style lookup. Read it like a chart: first find the temperature row
 * (cold → hot), then the moisture column (dry → wet).
 */
export function classifyBiome(temp: number, moisture: number, elevation: number): BiomeId {
  if (temp < ICE_TEMP) return Biome.Ice;
  if (temp < TUNDRA_TEMP) return Biome.Tundra;
  if (moisture > WETLAND_MOISTURE && elevation < WETLAND_MAX_ELEVATION) return Biome.Wetland;

  if (temp < TAIGA_TEMP) {
    return moisture < DRY_MOISTURE ? Biome.Tundra : Biome.Taiga;
  }
  if (temp < HOT_TEMP) {
    if (moisture < DRY_MOISTURE) return Biome.Shrubland;
    if (moisture < FOREST_MOISTURE) return Biome.Grassland;
    return Biome.TemperateForest;
  }
  if (moisture < DRY_MOISTURE) return Biome.Desert;
  if (moisture < SEMI_DRY_MOISTURE) return Biome.Shrubland;
  if (moisture < FOREST_MOISTURE) return Biome.Savanna;
  return Biome.TropicalForest;
}

/** Max population for a cell (SPEC §3.7). */
export function cellCapacity(biome: BiomeId, river: boolean, coastal: boolean, mountain: boolean): number {
  return (
    BIOME_STATS[biome].capacity *
    (river ? RIVER_CAP_MULT : 1) *
    (coastal ? COAST_CAP_MULT : 1) *
    (mountain ? MOUNTAIN_CAP_MULT : 1)
  );
}
