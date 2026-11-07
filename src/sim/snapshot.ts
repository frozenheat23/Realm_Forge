// Save and load (SPEC §2 "Save files"): turns a WorldState into plain JSON data and back.
//
// `Map` and typed arrays don't survive JSON.stringify, so they're converted to plain
// arrays here. The map itself (cells, terrain) isn't saved: it's rebuilt from the seed,
// which always gives the same map.
import type { Alliance, Army, CellState, LoggedCommand, Nation, RaceHome, SimEvent, War, WarRecord, WorldState } from "../core/types";
import type { GeneratedWorld } from "../gen";
import type { SimParams } from "./params";

/** Version 2 added races (M7), 3 diplomacy (M8), 4 land and cell detail (M9), 5 armies (M11), 8 culture and faith (M12), 9 rulers (M13), 10 war records (M16), 11 the sandbox's command log (M17), 12 rulers' boldness (M18). */
export const SNAPSHOT_VERSION = 12;

/** Older versions that still load, with what they lack filled in. */
const STILL_LOADS = new Set([10, 11]);

/** Why older saves can't be loaded, by version. */
const TOO_OLD: Record<number, string> = {
  1: "races were added",
  2: "diplomacy was added",
  3: "land detail (unrest, resources, cities) was added",
  4: "armies were added",
  5: "battles, occupation and war goals were added",
  6: "rebel armies were added",
  7: "cultures and faiths were added",
  8: "rulers were added",
  9: "war records were added",
};

export interface Snapshot {
  version: number;
  seed: string;
  year: number;
  params: SimParams;
  /** Every per-cell array, as plain number lists. */
  cells: Record<keyof CellState, number[]>;
  nations: Nation[];
  wars: War[];
  armies: Army[];
  nextArmyId: number;
  nextWarId: number;
  truces: { a: number; b: number; until: number }[];
  events: SimEvent[];
  cultureHomes: [number, number][];
  colorHue: number;
  raceHomes: RaceHome[];
  /** [pairKey, opinion] pairs. */
  relations: [number, number][];
  alliances: Alliance[];
  /** [cell, name] pairs. */
  cityNames: [number, string][];
  warRecords: WarRecord[];
  /** Missing in v10 saves. */
  commands?: LoggedCommand[];
}

export function toSnapshot(state: WorldState, params: SimParams): Snapshot {
  const s = state.state;
  return {
    version: SNAPSHOT_VERSION,
    seed: state.seed,
    year: state.year,
    params: { ...params },
    cells: {
      pop: Array.from(s.pop),
      owner: Array.from(s.owner),
      race: Array.from(s.race),
      culture: Array.from(s.culture),
      faith: Array.from(s.faith),
      unrest: Array.from(s.unrest),
      devastation: Array.from(s.devastation),
      ownedSince: Array.from(s.ownedSince),
      prevOwner: Array.from(s.prevOwner),
      occupier: Array.from(s.occupier),
      siege: Array.from(s.siege),
      development: Array.from(s.development),
      settlement: Array.from(s.settlement),
    },
    nations: [...state.nations.values()],
    wars: state.wars,
    armies: state.armies,
    nextArmyId: state.nextArmyId,
    nextWarId: state.nextWarId,
    truces: state.truces,
    events: state.events,
    cultureHomes: state.cultureHomes,
    colorHue: state.colorHue,
    raceHomes: state.raceHomes,
    relations: [...state.relations],
    alliances: state.alliances,
    cityNames: [...state.cityNames],
    warRecords: state.warRecords,
    commands: state.commands,
  };
}

/** Rebuilds a WorldState from a snapshot, on top of the world regenerated from the same seed. */
export function fromSnapshot(snapshot: Snapshot, world: GeneratedWorld): WorldState {
  const tooOld = TOO_OLD[snapshot.version];
  if (tooOld) throw new Error(`This save is from before ${tooOld} and can't be loaded`);
  if (snapshot.version !== SNAPSHOT_VERSION && !STILL_LOADS.has(snapshot.version)) throw new Error(`Unknown save version ${snapshot.version}`);
  if (snapshot.seed !== world.seed) throw new Error("Save file is for a different seed");
  const c = snapshot.cells;
  if (c.owner.length !== world.cells.length) throw new Error("Save file doesn't match this map");
  return {
    seed: snapshot.seed,
    year: snapshot.year,
    cells: world.cells,
    state: {
      pop: Float32Array.from(c.pop),
      owner: Int32Array.from(c.owner),
      race: Uint8Array.from(c.race),
      culture: Uint16Array.from(c.culture),
      faith: Uint8Array.from(c.faith),
      unrest: Float32Array.from(c.unrest),
      devastation: Float32Array.from(c.devastation),
      ownedSince: Int32Array.from(c.ownedSince),
      prevOwner: Int32Array.from(c.prevOwner),
      occupier: Int32Array.from(c.occupier),
      siege: Float32Array.from(c.siege),
      development: Float32Array.from(c.development),
      settlement: Uint8Array.from(c.settlement),
    },
    // Rulers from saves before v12 had no boldness: they judge rivals plainly (1).
    nations: new Map(snapshot.nations.map((n) => [n.id, { ...n, ruler: { ...n.ruler, boldness: n.ruler.boldness ?? 1 } }])),
    wars: snapshot.wars.map((w) => ({ ...w })),
    armies: snapshot.armies.map((a) => ({ ...a, path: [...a.path], trail: [...a.trail] })),
    nextArmyId: snapshot.nextArmyId,
    nextWarId: snapshot.nextWarId,
    battles: [],
    warRecords: structuredClone(snapshot.warRecords),
    truces: snapshot.truces.map((t) => ({ ...t })),
    events: [...snapshot.events],
    cultureHomes: snapshot.cultureHomes,
    colorHue: snapshot.colorHue,
    raceHomes: snapshot.raceHomes,
    relations: new Map(snapshot.relations),
    // Saves from before pacts could fade have no `renewed`: count from when the pact was made.
    alliances: snapshot.alliances.map((al) => ({ ...al, renewed: al.renewed ?? al.since })),
    cityNames: new Map(snapshot.cityNames),
    commands: structuredClone(snapshot.commands ?? []),
  };
}
