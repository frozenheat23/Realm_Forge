// Shared data shapes used across gen/, sim/ and render/.

export type CellId = number;

// Biomes as named numbers. `as const` freezes the values so TypeScript knows
// each name maps to one exact number (handy for typed arrays later).
export const Biome = {
  Water: 0,
  Grassland: 1,
  TemperateForest: 2,
  Savanna: 3,
  TropicalForest: 4,
  Shrubland: 5,
  Taiga: 6,
  Wetland: 7,
  Desert: 8,
  Tundra: 9,
  Ice: 10,
} as const;

/** One of the numbers in `Biome`, e.g. Biome.Desert (8). */
export type BiomeId = (typeof Biome)[keyof typeof Biome];

/** Races as named numbers, like Biome. 0 = nobody lives there. */
export const Race = {
  None: 0,
  Human: 1,
  LightElf: 2,
  DarkElf: 3,
  Dwarf: 4,
  Orc: 5,
} as const;

/** One of the numbers in `Race`, e.g. Race.Dwarf (4). */
export type RaceId = (typeof Race)[keyof typeof Race];

/** Any race except None: the ones that have traits. */
export type PlayableRace = Exclude<RaceId, typeof Race.None>;

/** Resource deposits as named numbers, like Biome (SPEC §4.11). 0 = no deposit. */
export const Resource = {
  None: 0,
  Grain: 1,
  Timber: 2,
  Iron: 3,
  Gold: 4,
  Horses: 5,
  Mithril: 6,
} as const;

export type ResourceId = (typeof Resource)[keyof typeof Resource];
export type ResourceKind = Exclude<ResourceId, typeof Resource.None>;

/** One row of the RESOURCES table. */
export interface ResourceInfo {
  name: string;
  /** Multiplier at full access (owning none = 1.0). See SPEC §4.11 for what each multiplies. */
  effect: number;
  /** How likely this type is, among the ones that fit a cell. */
  weight: number;
}

/** Related races share a family, which decides how their nations' names sound. */
export type RaceFamily = "human" | "elf" | "dwarf" | "orc";

/**
 * What makes a race different (SPEC §4.10). Every number is a multiplier:
 * 1.0 = the same as Humans. Table and meanings in docs/PARAMS.md "Races".
 */
export interface RaceTraits {
  name: string;
  /** Plural used in event text, e.g. "Dark Elves". */
  plural: string;
  family: RaceFamily;
  growth: number;
  martial: number;
  defense: number;
  aggression: number;
  endurance: number;
  cohesion: number;
  unrest: number;
  tolerance: number;
  /** Capacity multiplier per biome (missing = 1). */
  affinity: Partial<Record<BiomeId, number>>;
  mountainAffinity: number;
  /** Move-cost multiplier per biome when this race expands (missing = 1). */
  terrainCost: Partial<Record<BiomeId, number>>;
  mountainCost: number;
  /** Resources this race prizes: worth more to it when picking what to fight for. */
  favoredResources: ResourceKind[];
}

/** A map cell (one Voronoi polygon). Fixed after generation. */
export interface Cell {
  id: CellId;
  /** Center point, in map pixels. */
  site: [number, number];
  neighbors: CellId[];
  /** Raw elevation 0..1 from the heightmap. Land if above the sea level. */
  h: number;
  /** Height above the sea, 0 (coast) .. 1 (highest peak). Always 0 for water. */
  elevation: number;
  isLand: boolean;
  /** Land cell touching a water cell. */
  coastal: boolean;
  /** Land cell with elevation above MOUNTAIN_H. */
  mountain: boolean;
  /** Roughly °C. */
  temp: number;
  /** 0 (bone dry) .. 1 (soaking). */
  moisture: number;
  biome: BiomeId;
  /** Next cell water flows into on its way to the sea (−1 for water cells). */
  downstream: CellId;
  /** How many river sources flow through this cell (0 = no river). */
  riverFlow: number;
  river: boolean;
  /** Max population this cell can hold. */
  capacity: number;
  /** Resource deposit here (Resource.None = none). */
  resource: ResourceId;
  /** How rich the deposit is, 0..1 (0 without one). */
  richness: number;
  /** How hard the cell is to take in war (~0.8..2): biome × mountain × river. */
  defensibility: number;
  /** Province id (−1 for water). Rebellions break along provinces. */
  province: number;
}

export type NationId = number; // 0 = unowned

/** Army.target when it has nowhere to go. */
export const NO_TARGET = -1;

/** One side's soldiers in one war, marching across the map (SPEC §4.13). */
export interface Army {
  id: number;
  owner: NationId;
  /** The war it was raised for. */
  war: number;
  cell: CellId;
  /** Soldiers, in pop units. */
  size: number;
  /** 0..1 */
  morale: number;
  /** Where it's heading, or NO_TARGET. */
  target: CellId;
  /** Cells still to walk to reach the target, next first. */
  path: CellId[];
  /** Cells walked this year, starting where it stood, so the map can animate the march. */
  trail: CellId[];
}

export interface Nation {
  id: NationId;
  name: string;
  /** Stays the same for the nation's whole life. */
  color: string;
  capital: CellId;
  /** Year founded. */
  founded: number;
  /** Set if born from a rebellion. */
  parent?: NationId;
  /** The ruling race. Fixed for the nation's whole life. */
  race: RaceId;
  alive: boolean;
  /** 0..1 */
  stability: number;
  /** 0..1 */
  warWeariness: number;
  /** Trained soldiers not yet in an army, in pop units (SPEC §4.13). */
  reserve: number;
  // Recomputed every year by the simulation:
  area: number;
  pop: number;
  strength: number;
  /** Most soldiers the nation can keep: militaryPop × LEVY_SHARE (SPEC §4.13). */
  manpowerCap: number;
  /** Share of the population that isn't the ruling race, 0..1. */
  foreignShare: number;
  /** Population-weighted average of the `unrest` trait of everyone living there. */
  unrest: number;
  /** Population-weighted average control over its cells, 0..1 (SPEC §4.2). */
  control: number;
  /** Access to each resource: sum of richness over its deposits, indexed by ResourceId (SPEC §4.11). */
  access: number[];
}

export interface War {
  id: number;
  attacker: NationId;
  defender: NationId;
  startYear: number;
  /** Positive = attacker winning. */
  score: number;
  /** Set if an ally joined someone else's war: the id of that main war. Ends when it ends. */
  joined?: number;
  /** Cells with a resource deposit captured during this war, and by whom (for the peace text). */
  prizes?: { cell: CellId; by: NationId }[];
}

/** Two nations pledged to fight beside each other (SPEC §4.12). `a` < `b`. */
export interface Alliance {
  a: NationId;
  b: NationId;
  since: number;
}

export interface SimEvent {
  year: number;
  type: "founded" | "war" | "peace" | "rebellion" | "collapse" | "annexed" | "capital_moved" | "alliance" | "alliance_ended" | "city_founded";
  actors: NationId[];
  text: string;
}

/** Per-cell data that changes every year. Typed arrays for speed. */
export interface CellState {
  /** People per cell. */
  pop: Float32Array;
  /** NationId per cell (0 = unowned). */
  owner: Int32Array;
  /** RaceId of the people living in each cell (0 = nobody). */
  race: Uint8Array;
  /** How restless each cell's people are, 0..1 (SPEC §4.11). Rebellions start where it's high. */
  unrest: Float32Array;
  /** War damage, 0..1. Cuts capacity; heals slowly. */
  devastation: Float32Array;
  /** Year the current owner took the cell. */
  ownedSince: Int32Array;
  /** Who owned the cell before the current owner (0 = nobody). Gives claims to reconquer. */
  prevOwner: Int32Array;
  /** Farms, roads and buildings, 0..1. Grows slowly in full, well-held, peaceful land. */
  development: Float32Array;
  /** 0 none, 1 village, 2 town, 3 city (see Settlement). */
  settlement: Uint8Array;
}

/** Settlement levels, from development (SPEC §4.11). */
export const Settlement = { None: 0, Village: 1, Town: 2, City: 3 } as const;

/** A race's homeland point: new nations nearby are of that race. */
export interface RaceHome {
  race: RaceId;
  at: [number, number];
}

/** Everything the simulation reads and changes, year by year. */
export interface WorldState {
  seed: string;
  year: number;
  cells: Cell[];
  state: CellState;
  nations: Map<NationId, Nation>;
  wars: War[];
  armies: Army[];
  /** Id for the next army raised. */
  nextArmyId: number;
  truces: { a: NationId; b: NationId; until: number }[];
  events: SimEvent[];
  /** Each name culture's home point on the map; new nations take the nearest one's names. */
  cultureHomes: [number, number][];
  /** Starting hue (0..360) for nation colors, so new nations' colors follow on from the first ones. */
  colorHue: number;
  /** Each race's homeland points (SPEC §4.10). */
  raceHomes: RaceHome[];
  /** Opinion between two nations that have met, −1 (hatred) .. 1 (friendship), keyed by `pairKey` (SPEC §4.12). */
  relations: Map<number, number>;
  alliances: Alliance[];
  /** Names of cells that have grown into cities (kept if the city shrinks, so it keeps its name if it regrows). */
  cityNames: Map<CellId, string>;
}
