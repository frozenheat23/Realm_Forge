// Runs every generation step in order (SPEC §3) and returns the finished world.
import type { Delaunay } from "d3-delaunay";
import { Biome, type Cell, type WorldState } from "../core/types";
import { createRng } from "../core/rng";
import { cellCapacity, classifyBiome } from "./biomes";
import { buildCellGraph, jitteredGrid } from "./cells";
import { moistureForCells, stepsFromWater, temperatureAt } from "./climate";
import { generateHeightmap, type Heightmap } from "./heightmap";
import { CELL_COUNT, MAP_HEIGHT, MAP_WIDTH, MOUNTAIN_H } from "./params";
import { createStartingNations } from "./nations";
import { placeRaceHomes } from "./races";
import { drainageMap, traceRivers } from "./rivers";

export interface GeneratedWorld {
  seed: string;
  width: number;
  height: number;
  heightmap: Heightmap;
  cells: Cell[];
  /** For every pixel, which cell it belongs to. index = y * width + x. */
  pixelToCell: Int32Array;
  /** The Voronoi/Delaunay structure, kept for drawing cell outlines. */
  delaunay: Delaunay<Delaunay.Point>;
}

/** The map (never changes) plus the starting state of history (year 0). */
export interface Generated {
  world: GeneratedWorld;
  state: WorldState;
}

export function generateWorld(seed: string, width = MAP_WIDTH, height = MAP_HEIGHT): Generated {
  const rng = createRng(seed);

  // 1. Terrain
  const heightmap = generateHeightmap(rng.fork("terrain"), width, height);
  const { data, seaLevel } = heightmap;

  // 2. Cells
  const points = jitteredGrid(rng.fork("cells"), width, height, CELL_COUNT);
  const { delaunay, neighbors, pixelToCell } = buildCellGraph(points, width, height);
  const count = points.length / 2;

  // 3. Height at each cell center
  const sites: [number, number][] = [];
  const h = new Float32Array(count);
  const elevation = new Float32Array(count);
  const isLand: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const x = points[i * 2]!;
    const y = points[i * 2 + 1]!;
    sites.push([x, y]);
    h[i] = data[Math.floor(y) * width + Math.floor(x)]!;
    isLand.push(h[i]! > seaLevel);
    elevation[i] = isLand[i] ? (h[i]! - seaLevel) / (1 - seaLevel) : 0;
  }

  // 4. Climate
  const coastSteps = stepsFromWater(isLand, neighbors);
  const moisture = moistureForCells(rng.fork("moisture"), sites, coastSteps);

  // 5. Rivers
  const downstream = drainageMap(h, isLand, neighbors);
  const riverFlow = traceRivers(rng.fork("rivers"), elevation, moisture, downstream);

  // 6. Put it all together, cell by cell
  const cells: Cell[] = [];
  for (let i = 0; i < count; i++) {
    const [, y] = sites[i]!;
    const land = isLand[i]!;
    const temp = temperatureAt(y, height, elevation[i]!);
    const biome = land ? classifyBiome(temp, moisture[i]!, elevation[i]!) : Biome.Water;
    const coastal = land && coastSteps[i] === 1;
    const mountain = land && elevation[i]! > MOUNTAIN_H;
    const river = riverFlow[i]! > 0;
    cells.push({
      id: i,
      site: sites[i]!,
      neighbors: neighbors[i]!,
      h: h[i]!,
      elevation: elevation[i]!,
      isLand: land,
      coastal,
      mountain,
      temp,
      moisture: moisture[i]!,
      biome,
      downstream: downstream[i]!,
      riverFlow: riverFlow[i]!,
      river,
      capacity: land ? cellCapacity(biome, river, coastal, mountain) : 0,
    });
  }

  // 7. Race homelands, then starting nations
  const raceHomes = placeRaceHomes(rng.fork("races"), cells);
  const start = createStartingNations(rng.fork("nations"), cells, width, height, raceHomes);

  const world: GeneratedWorld = { seed, width, height, heightmap, cells, pixelToCell, delaunay };
  const state: WorldState = {
    seed,
    year: 0,
    cells,
    state: { pop: start.pop, owner: start.owner, race: start.race },
    nations: start.nations,
    wars: [],
    truces: [],
    events: start.events,
    cultureHomes: start.cultureHomes,
    colorHue: start.colorHue,
    raceHomes,
    relations: new Map(),
    alliances: [],
  };
  return { world, state };
}
