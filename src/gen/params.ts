// Tunable numbers for world generation. See docs/PARAMS.md for what each one does.
import {
  Biome,
  Race,
  Resource,
  type BiomeId,
  type PlayableRace,
  type RaceTraits,
  type ResourceInfo,
  type ResourceKind,
} from "../core/types";

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

/** Base capacity (1 = grassland), move cost and defense per biome. Table in docs/PARAMS.md. */
export const BIOME_STATS: Record<BiomeId, { name: string; capacity: number; moveCost: number; defense: number }> = {
  [Biome.Water]: { name: "Water", capacity: 0, moveCost: Infinity, defense: 1.0 },
  [Biome.Grassland]: { name: "Grassland", capacity: 1.0, moveCost: 1.0, defense: 1.0 },
  [Biome.TemperateForest]: { name: "Temperate forest", capacity: 0.8, moveCost: 1.5, defense: 1.2 },
  [Biome.Savanna]: { name: "Savanna", capacity: 0.7, moveCost: 1.2, defense: 1.0 },
  [Biome.TropicalForest]: { name: "Tropical forest", capacity: 0.6, moveCost: 2.5, defense: 1.3 },
  [Biome.Shrubland]: { name: "Shrubland", capacity: 0.5, moveCost: 1.3, defense: 1.0 },
  [Biome.Taiga]: { name: "Taiga", capacity: 0.4, moveCost: 2.0, defense: 1.2 },
  [Biome.Wetland]: { name: "Wetland", capacity: 0.4, moveCost: 2.5, defense: 1.3 },
  [Biome.Desert]: { name: "Desert", capacity: 0.15, moveCost: 3.0, defense: 1.1 },
  [Biome.Tundra]: { name: "Tundra", capacity: 0.15, moveCost: 2.5, defense: 1.0 },
  [Biome.Ice]: { name: "Ice", capacity: 0, moveCost: 10, defense: 1.0 },
};

// --- Terrain defense (SPEC §4.11) ---
/** × defensibility of mountain cells. */
export const MOUNTAIN_DEFENSE = 1.5;
/** × defensibility of river cells. */
export const RIVER_DEFENSE = 1.2;

// --- Provinces (SPEC §4.11) ---
/** Rough number of cells per province. */
export const PROVINCE_SIZE = 20;

// --- Resources (SPEC §4.11) ---
/** Share of land cells with a resource deposit. */
export const RESOURCE_PROB = 0.04;
/** Richness = random ^ this, so higher = mostly poor deposits with a few rich ones. */
export const RICHNESS_SKEW = 2;
/** Land elevation (0 = coast, 1 = peak) where hills start; hills end at MOUNTAIN_H. Iron is found in hills. */
export const HILL_H = 0.4;
/** Land elevation where high mountains start. Mithril is only found there. */
export const HIGH_MOUNTAIN_H = 0.8;

/** Every resource type (SPEC §4.11). Where each one appears is in gen/resources.ts. */
export const RESOURCES: Record<ResourceKind, ResourceInfo> = {
  [Resource.Grain]: { name: "grain", effect: 1.1, weight: 1.0 }, // × capacity of all the nation's cells
  [Resource.Timber]: { name: "timber", effect: 0.85, weight: 1.0 }, // × move cost when expanding
  [Resource.Iron]: { name: "iron", effect: 1.15, weight: 0.8 }, // × martial
  [Resource.Gold]: { name: "gold", effect: 1.3, weight: 0.5 }, // × STAB_RECOVERY
  [Resource.Horses]: { name: "horses", effect: 1.15, weight: 0.8 }, // × EXPANSION_RATE
  [Resource.Mithril]: { name: "mithril", effect: 1.2, weight: 0.15 }, // × defense on the war front
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

// --- Starting nations ---
export const START_NATIONS = 24;
export const START_MIN_SPACING = 12;
export const START_CORE_SIZE = 12;
export const START_POP_FRACTION = 0.3;
/** Stability every starting nation begins with (0..1). */
export const START_STABILITY = 0.8;
/** Nation colors: hue is spread around the color wheel; these fix how vivid and bright they are. */
export const NATION_SATURATION = 0.7;
export const NATION_LIGHTNESS = 0.52;

// --- Races ---
// Lives here (like BIOME_STATS) because both generation and the simulation use it.
/** Homeland points per race. */
export const RACE_HOMES_PER_RACE = 2;
/** How strongly homelands favor a race's preferred land (higher = more picky). */
export const RACE_HOME_FOCUS = 3;

/** Every race's traits (SPEC §4.10). All multipliers; Humans = 1.0. Table in docs/PARAMS.md "Races". */
export const RACES: Record<PlayableRace, RaceTraits> = {
  [Race.Human]: {
    name: "Human", plural: "Humans", family: "human",
    growth: 1.0, martial: 1.0, defense: 1.0, aggression: 1.0, endurance: 1.0, cohesion: 1.0, unrest: 1.0, tolerance: 1.0,
    affinity: {}, // the baseline: no land is better or worse for Humans than its biome says
    mountainAffinity: 1.0,
    terrainCost: {},
    mountainCost: 1.0,
    favoredResources: [Resource.Grain, Resource.Horses],
  },
  [Race.LightElf]: {
    name: "Light Elf", plural: "Light Elves", family: "elf",
    growth: 0.6, martial: 1.1, defense: 1.4, aggression: 0.5, endurance: 0.8, cohesion: 0.9, unrest: 0.6, tolerance: 0.6,
    affinity: { [Biome.TemperateForest]: 1.5, [Biome.TropicalForest]: 1.4, [Biome.Grassland]: 0.8, [Biome.Desert]: 0.5 },
    mountainAffinity: 1.0,
    terrainCost: { [Biome.TemperateForest]: 0.5, [Biome.TropicalForest]: 0.5 },
    mountainCost: 1.0,
    favoredResources: [Resource.Timber],
  },
  [Race.DarkElf]: {
    name: "Dark Elf", plural: "Dark Elves", family: "elf",
    growth: 0.7, martial: 1.3, defense: 1.1, aggression: 1.4, endurance: 0.9, cohesion: 0.7, unrest: 1.2, tolerance: 0.5,
    affinity: { [Biome.Taiga]: 1.6, [Biome.Wetland]: 1.4, [Biome.Grassland]: 0.8 },
    mountainAffinity: 1.5,
    terrainCost: { [Biome.Taiga]: 0.6, [Biome.Wetland]: 0.6 },
    mountainCost: 0.6,
    favoredResources: [Resource.Mithril],
  },
  [Race.Dwarf]: {
    name: "Dwarf", plural: "Dwarves", family: "dwarf",
    growth: 0.7, martial: 1.2, defense: 1.5, aggression: 0.7, endurance: 1.3, cohesion: 0.9, unrest: 0.6, tolerance: 0.7,
    affinity: { [Biome.Taiga]: 1.3, [Biome.Grassland]: 0.8, [Biome.TropicalForest]: 0.5 },
    mountainAffinity: 2.5,
    terrainCost: { [Biome.Taiga]: 0.7, [Biome.TemperateForest]: 1.3, [Biome.TropicalForest]: 1.3 },
    mountainCost: 0.4,
    favoredResources: [Resource.Iron, Resource.Gold, Resource.Mithril],
  },
  [Race.Orc]: {
    name: "Orc", plural: "Orcs", family: "orc",
    growth: 1.5, martial: 1.1, defense: 0.8, aggression: 1.6, endurance: 1.1, cohesion: 0.6, unrest: 1.5, tolerance: 1.1,
    affinity: { [Biome.Desert]: 2.5, [Biome.Shrubland]: 1.5, [Biome.Savanna]: 1.3, [Biome.TemperateForest]: 0.8 },
    mountainAffinity: 1.0,
    terrainCost: { [Biome.Desert]: 0.5, [Biome.Shrubland]: 0.7, [Biome.Savanna]: 0.7 },
    mountainCost: 1.0,
    favoredResources: [Resource.Iron, Resource.Horses],
  },
};

/**
 * How one race feels about another, −1 (hatred) .. 1 (kinship): the base of every
 * opinion between nations (SPEC §4.12). Row/column order: Human, Light Elf, Dark Elf, Dwarf, Orc.
 */
export const RACE_ATTITUDES: number[][] = [
  [0.2, 0, -0.2, 0, -0.3],
  [0, 0.3, -0.8, -0.1, -0.6],
  [-0.2, -0.8, 0.1, -0.6, -0.3],
  [0, -0.1, -0.6, 0.3, -0.6],
  [-0.3, -0.6, -0.3, -0.6, 0.1],
];

// --- Names ---
/** How many letters of context the name generator looks at (2 = pairs of letters). */
export const NAME_ORDER = 2;
export const NAME_MIN_LENGTH = 4;
export const NAME_MAX_LENGTH = 9;
