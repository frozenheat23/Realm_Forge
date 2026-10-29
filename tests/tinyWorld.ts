// Builds tiny hand-made worlds for simulation tests.
import {
  Biome,
  Race,
  Resource,
  type BiomeId,
  type Cell,
  type Nation,
  type NationId,
  type RaceId,
  type ResourceId,
  type WorldState,
} from "../src/core/types";

export interface TinyCell {
  neighbors: number[];
  biome?: BiomeId;
  land?: boolean;
  mountain?: boolean;
  capacity?: number;
  resource?: ResourceId;
  richness?: number;
  defensibility?: number;
}

/** A row of `count` land cells, each linked to the cells beside it: [0]-[1]-[2]-... */
export function row(count: number, extra: Partial<TinyCell> = {}): TinyCell[] {
  return Array.from({ length: count }, (_, i) => ({
    neighbors: [i - 1, i + 1].filter((n) => n >= 0 && n < count),
    ...extra,
  }));
}

export function makeCells(spec: TinyCell[]): Cell[] {
  return spec.map((c, i) => {
    const land = c.land ?? true;
    return {
      id: i,
      site: [i * 10, 0] as [number, number],
      neighbors: c.neighbors,
      h: land ? 0.6 : 0.1,
      elevation: land ? 0.2 : 0,
      isLand: land,
      coastal: false,
      mountain: c.mountain ?? false,
      temp: 15,
      moisture: 0.5,
      biome: land ? (c.biome ?? Biome.Grassland) : Biome.Water,
      downstream: -1,
      riverFlow: 0,
      river: false,
      capacity: land ? (c.capacity ?? 1) : 0,
      resource: c.resource ?? Resource.None,
      richness: c.richness ?? 0,
      defensibility: c.defensibility ?? 1,
    };
  });
}

export function makeNation(id: NationId, capital: number, extra: Partial<Nation> = {}): Nation {
  return {
    id,
    name: `Nation${id}`,
    color: "#888888",
    capital,
    founded: 0,
    race: Race.Human,
    alive: true,
    stability: 0.8,
    warWeariness: 0,
    area: 0,
    pop: 0,
    strength: 0,
    foreignShare: 0,
    unrest: 1,
    control: 1,
    access: [0, 0, 0, 0, 0, 0, 0],
    ...extra,
  };
}

/**
 * A world state from cells, who owns what (0 = nobody), and the nations.
 * `races` gives each cell's race; by default every owned cell holds its owner's race.
 */
export function makeState(
  spec: TinyCell[],
  owners: number[],
  nations: Nation[],
  pop?: number[],
  races?: RaceId[],
): WorldState {
  const cells = makeCells(spec);
  const byId = new Map(nations.map((n) => [n.id, n]));
  return {
    seed: "tiny",
    year: 0,
    cells,
    state: {
      owner: Int32Array.from(owners),
      pop: Float32Array.from(pop ?? owners.map((o, i) => (o ? cells[i]!.capacity * 0.5 : 0))),
      race: Uint8Array.from(races ?? owners.map((o) => (o ? byId.get(o)!.race : Race.None))),
      unrest: new Float32Array(cells.length),
      devastation: new Float32Array(cells.length),
      ownedSince: new Int32Array(cells.length),
      prevOwner: new Int32Array(cells.length),
      development: new Float32Array(cells.length),
      settlement: new Uint8Array(cells.length),
    },
    nations: byId,
    wars: [],
    truces: [],
    events: [],
    cultureHomes: [[0, 0]],
    colorHue: 0,
    raceHomes: [{ race: Race.Human, at: [0, 0] }],
    relations: new Map(),
    alliances: [],
    cityNames: new Map(),
  };
}
