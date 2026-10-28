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
