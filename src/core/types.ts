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
}

export type NationId = number; // 0 = unowned

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
  alive: boolean;
  /** 0..1 */
  stability: number;
  /** 0..1 */
  warWeariness: number;
  // Recomputed every year by the simulation:
  area: number;
  pop: number;
  strength: number;
}

export interface War {
  id: number;
  attacker: NationId;
  defender: NationId;
  startYear: number;
  /** Positive = attacker winning. */
  score: number;
}

export interface SimEvent {
  year: number;
  type: "founded" | "war" | "peace" | "rebellion" | "collapse" | "annexed" | "capital_moved";
  actors: NationId[];
  text: string;
}

/** Per-cell data that changes every year. Typed arrays for speed. */
export interface CellState {
  /** People per cell. */
  pop: Float32Array;
  /** NationId per cell (0 = unowned). */
  owner: Int32Array;
}

/** Everything the simulation reads and changes, year by year. */
export interface WorldState {
  seed: string;
  year: number;
  cells: Cell[];
  state: CellState;
  nations: Map<NationId, Nation>;
  wars: War[];
  truces: { a: NationId; b: NationId; until: number }[];
  events: SimEvent[];
  /** Each name culture's home point on the map; new nations take the nearest one's names. */
  cultureHomes: [number, number][];
  /** Starting hue (0..360) for nation colors, so new nations' colors follow on from the first ones. */
  colorHue: number;
}
