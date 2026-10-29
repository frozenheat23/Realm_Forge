// Save and load (SPEC §2 "Save files"): turns a WorldState into plain JSON data and back.
//
// `Map` and typed arrays don't survive JSON.stringify, so they're converted to plain
// arrays here. The map itself (cells, terrain) isn't saved: it's rebuilt from the seed,
// which always gives the same map.
import type { Alliance, Nation, RaceHome, SimEvent, War, WorldState } from "../core/types";
import type { GeneratedWorld } from "../gen";
import type { SimParams } from "./params";

/** Version 2 added races (M7); version 3 added opinions and alliances (M8). */
export const SNAPSHOT_VERSION = 3;

export interface Snapshot {
  version: number;
  seed: string;
  year: number;
  params: SimParams;
  owner: number[];
  pop: number[];
  race: number[];
  nations: Nation[];
  wars: War[];
  truces: { a: number; b: number; until: number }[];
  events: SimEvent[];
  cultureHomes: [number, number][];
  colorHue: number;
  raceHomes: RaceHome[];
  /** [pairKey, opinion] pairs. */
  relations: [number, number][];
  alliances: Alliance[];
}

export function toSnapshot(state: WorldState, params: SimParams): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    seed: state.seed,
    year: state.year,
    params: { ...params },
    owner: Array.from(state.state.owner),
    pop: Array.from(state.state.pop),
    race: Array.from(state.state.race),
    nations: [...state.nations.values()],
    wars: state.wars,
    truces: state.truces,
    events: state.events,
    cultureHomes: state.cultureHomes,
    colorHue: state.colorHue,
    raceHomes: state.raceHomes,
    relations: [...state.relations],
    alliances: state.alliances,
  };
}

/** Rebuilds a WorldState from a snapshot, on top of the world regenerated from the same seed. */
export function fromSnapshot(snapshot: Snapshot, world: GeneratedWorld): WorldState {
  if (snapshot.version === 1) throw new Error("This save is from before races were added and can't be loaded");
  if (snapshot.version === 2) throw new Error("This save is from before diplomacy was added and can't be loaded");
  if (snapshot.version !== SNAPSHOT_VERSION) throw new Error(`Unknown save version ${snapshot.version}`);
  if (snapshot.seed !== world.seed) throw new Error("Save file is for a different seed");
  if (snapshot.owner.length !== world.cells.length) throw new Error("Save file doesn't match this map");
  return {
    seed: snapshot.seed,
    year: snapshot.year,
    cells: world.cells,
    state: {
      owner: Int32Array.from(snapshot.owner),
      pop: Float32Array.from(snapshot.pop),
      race: Uint8Array.from(snapshot.race),
    },
    nations: new Map(snapshot.nations.map((n) => [n.id, { ...n }])),
    wars: snapshot.wars.map((w) => ({ ...w })),
    truces: snapshot.truces.map((t) => ({ ...t })),
    events: [...snapshot.events],
    cultureHomes: snapshot.cultureHomes,
    colorHue: snapshot.colorHue,
    raceHomes: snapshot.raceHomes,
    relations: new Map(snapshot.relations),
    alliances: snapshot.alliances.map((al) => ({ ...al })),
  };
}
