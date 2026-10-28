// Tunable numbers for world generation. See docs/PARAMS.md for what each one does.
import { Biome, type BiomeId } from "../core/types";

// --- World ---
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 900;
export const CELL_COUNT = 10000;

// --- Terrain ---
export const NOISE_SCALE = 0.0016;
export const NOISE_OCTAVES = 6;
export const NOISE_PERSISTENCE = 0.5;
export const NOISE_LACUNARITY = 2.0;
export const EDGE_FALLOFF = 0.9;
export const DOMAIN_WARP = 0.3;
export const RIDGE_STRENGTH = 0.35;
export const LAND_RATIO = 0.4;
/** Land elevation (0 = coast, 1 = peak) where mountains start. */
export const MOUNTAIN_H = 0.6;

// --- Cells ---
/** How far each cell center may wander from its grid square (0 = perfect grid, 1 = anywhere in it). */
export const CELL_JITTER = 0.8;

// --- Climate ---
export const EQUATOR_TEMP = 28;
export const POLE_TEMP = -6;
export const LAPSE_RATE = 22;
export const COAST_MOISTURE_BONUS = 0.2;
/** Cell steps inland over which the coast moisture bonus fades to nothing. */
export const COAST_MOISTURE_RANGE = 8;
/** Size of wet/dry regions (like NOISE_SCALE, but for moisture). */
export const MOISTURE_NOISE_SCALE = 0.0025;

// --- Biomes ---
// Whittaker-style lookup: temperature (°C) splits cold → hot, moisture (0..1) splits dry → wet.
export const ICE_TEMP = -10;
export const TUNDRA_TEMP = 0;
export const TAIGA_TEMP = 7;
export const HOT_TEMP = 19;
export const DRY_MOISTURE = 0.3;
export const SEMI_DRY_MOISTURE = 0.42;
export const FOREST_MOISTURE = 0.58;
export const WETLAND_MOISTURE = 0.8;
/** Wetlands only form on low ground (land elevation below this). */
export const WETLAND_MAX_ELEVATION = 0.12;

/** Base capacity (1 = grassland) and move cost per biome. Table in docs/PARAMS.md. */
export const BIOME_STATS: Record<BiomeId, { name: string; capacity: number; moveCost: number }> = {
  [Biome.Water]: { name: "Water", capacity: 0, moveCost: Infinity },
  [Biome.Grassland]: { name: "Grassland", capacity: 1.0, moveCost: 1.0 },
  [Biome.TemperateForest]: { name: "Temperate forest", capacity: 0.8, moveCost: 1.5 },
  [Biome.Savanna]: { name: "Savanna", capacity: 0.7, moveCost: 1.2 },
  [Biome.TropicalForest]: { name: "Tropical forest", capacity: 0.6, moveCost: 2.5 },
  [Biome.Shrubland]: { name: "Shrubland", capacity: 0.5, moveCost: 1.3 },
  [Biome.Taiga]: { name: "Taiga", capacity: 0.4, moveCost: 2.0 },
  [Biome.Wetland]: { name: "Wetland", capacity: 0.4, moveCost: 2.5 },
  [Biome.Desert]: { name: "Desert", capacity: 0.15, moveCost: 3.0 },
  [Biome.Tundra]: { name: "Tundra", capacity: 0.15, moveCost: 2.5 },
  [Biome.Ice]: { name: "Ice", capacity: 0, moveCost: 10 },
};

export const RIVER_CAP_MULT = 1.5;
export const COAST_CAP_MULT = 1.2;
export const MOUNTAIN_CAP_MULT = 0.3;
export const MOUNTAIN_COST_MULT = 3.0;
export const RIVER_COST_MULT = 0.7;

// --- Rivers ---
export const RIVER_SOURCE_MOISTURE = 0.6;
/** Land elevation (0 = coast, 1 = peak) a river must start above. */
export const RIVER_SOURCE_MIN_H = 0.35;
export const RIVER_MIN_LENGTH = 6;
/** Chance each eligible cell actually starts a river (keeps rivers from carpeting the map). */
export const RIVER_SOURCE_PROB = 0.08;
