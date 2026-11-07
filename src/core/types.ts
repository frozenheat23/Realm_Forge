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

/** Faiths as named numbers, like Biome (SPEC §4.14). 0 = nobody lives there. */
export const Faith = {
  None: 0,
  OldGods: 1,
  RadiantCovenant: 2,
  EvergreenVow: 3,
  SilverChoir: 4,
  HollowMother: 5,
  DeepAncestors: 6,
  AnvilOath: 7,
  RedHunger: 8,
  BoneDrums: 9,
} as const;

/** One of the numbers in `Faith`. */
export type FaithId = (typeof Faith)[keyof typeof Faith];
export type FaithKind = Exclude<FaithId, typeof Faith.None>;

/** The five kinds of great ruler (docs/systems/rulers.md). 0 means an ordinary ruler. */
export const RulerType = {
  Conqueror: 1,
  Lawgiver: 2,
  Builder: 3,
  Prophet: 4,
  Schemer: 5,
} as const;
export type RulerTypeId = (typeof RulerType)[keyof typeof RulerType];

export interface Ruler {
  name: string;
  /** "House Varrin". */
  dynasty: string;
  /** Changes the title and name only, never their power. */
  female: boolean;
  /** Year crowned. */
  crowned: number;
  /** Year the reign ends, rolled at coronation. */
  ends: number;
  /** Only great rulers have a type. */
  great?: RulerTypeId;
  /**
   * × how strong this ruler believes their realm is against a rival (M18 misjudgment).
   * Rolled at coronation from the race's `temper`: above 1 is bold, below 1 timid.
   */
  boldness: number;
}

/** One row of the FAITHS table. */
export interface FaithInfo {
  name: string;
  /** × FAITH_RATE: how fast it spreads. */
  reach: number;
  /** × UNREST_FAITH_K: how hard its believers resent rulers of another faith. */
  fervor: number;
  /** Strength of its one small gift to nations of this faith. SPEC §4.14 and PARAMS.md say what each one multiplies. */
  blessing: number;
  /** If set, only these races can take it up. */
  races?: RaceId[];
}

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
  /** × START_CORE_SIZE: how much land its nations hold at year 0. */
  startSize: number;
  /** × CULTURE_RATE: how readily these people take on the ways of rulers of their own race. */
  assimilation: number;
  /** × FAITH_RATE: how readily these people change faith. */
  conversion: number;
  /** The faiths its homelands start with, in turn. */
  faiths: FaithKind[];
  /** Average years on the throne. */
  reign: number;
  /** × CRISIS_BASE: how badly its handovers of power go. */
  succession: number;
  /** × PACT_FADE and NEW_RULER_BREAK: how readily its rulers let an alliance go. */
  fickleness: number;
  /** × its estimate of its strength against a rival (M18): above 1 overrates itself. */
  confidence: number;
  /** How much its rulers' boldness varies: each is between e^-temper and e^+temper. */
  temper: number;
  /** Chance a ruler of this race is a woman. Changes the title and name only. */
  femaleChance: number;
  /** "House", "Clan"... */
  dynastyWord: string;
  /** × GREAT_RULER_CHANCE, per type of great ruler. */
  greatOdds: Record<RulerTypeId, number>;
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

/** A battle fought this year, kept so the map and log can show it. */
export interface BattleReport {
  cell: CellId;
  winner: NationId;
  loser: NationId;
  /** Soldiers killed on both sides. */
  lost: number;
  /** Was the loser's army destroyed? */
  routed: boolean;
  /** A famous general's news from this battle, for the log. */
  general?: { name: string; nation: NationId; news: "renown" | "fell" };
}

/** Army.target when it has nowhere to go. */
export const NO_TARGET = -1;

/** One side's soldiers in one war, marching across the map (SPEC §4.13). */
/** Who leads an army (M18 part 3, docs/systems/realwar.md). */
export interface General {
  name: string;
  female: boolean;
  /** × the army's power, rolled when appointed (between e^-GENERAL_SPREAD and e^+GENERAL_SPREAD). */
  skill: number;
  /** Battles won. Each sharpens them a little; GENERAL_FAMOUS of them make them famous. */
  wins: number;
  /** Year appointed. They retire GENERAL_CAREER years later. */
  since: number;
}

export interface Army {
  id: number;
  /** Who leads it. Missing in saves from before generals: an ordinary leader. */
  general?: General;
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
  /** Its best living general between wars, who leads its next army (M18). */
  marshal?: General;
  /** The ruling race. Fixed for the nation's whole life. */
  race: RaceId;
  /** Culture of its rulers: the id of the realm they descend from (SPEC §4.14). */
  culture: number;
  /** Faith of its rulers. Can change (SPEC §4.14). */
  faith: FaithId;
  /** Who rules it now (docs/systems/rulers.md). */
  ruler: Ruler;
  alive: boolean;
  /** Year it died. */
  fell?: number;
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

/** What a war is for. "support" = an ally who joined someone else's war. */
export type WarGoal = "conquer" | "reclaim" | "raid" | "support";

/** A change the gods make to history in the sandbox (docs/systems/sandbox.md). */
export type GodCommand =
  | { kind: "godWar"; nation: NationId; target: NationId; goal: Exclude<WarGoal, "support"> }
  /** `winner` null = white peace. */
  | { kind: "godPeace"; war: number; winner: NationId | null };

/** A god command and the year it was given (after that year's tick). */
export interface LoggedCommand {
  year: number;
  command: GodCommand;
}

export interface War {
  id: number;
  attacker: NationId;
  defender: NationId;
  startYear: number;
  /** Positive = attacker winning: battleScore plus what each side occupies, worked out each year. */
  score: number;
  /** Score from battles so far (same sign rule as `score`). */
  battleScore: number;
  /** Years the defender has held out: the attacker held none of what it came for (M18). Missing = 0. */
  heldOff?: number;
  goal: WarGoal;
  /** Cells the attacker went to war to take; empty for a raid or support. */
  goalCells: CellId[];
  /** Set if an ally joined someone else's war: the id of that main war. Ends when it ends. */
  joined?: number;
}

/** One battle, as a war remembers it. */
export interface BattleRecord {
  year: number;
  cell: CellId;
  winner: NationId;
  loser: NationId;
  /** Soldiers killed on both sides. */
  lost: number;
  routed: boolean;
}

/** How a war ended. */
export interface WarOutcome {
  how: "goal" | "decisive" | "exhausted" | "too long" | "side fell" | "imposed" | "terms";
  /** Missing for a white peace, or when a side fell. */
  winner?: NationId;
  /** The attacker won a raid: spoils, no land. */
  raid: boolean;
  /** Cells the winner took. */
  cells: number;
  /** The loser's whole realm fell with its capital. */
  wholeRealm: boolean;
  /** How the end read in the log. */
  text: string;
}

/**
 * Everything a war leaves behind, for the War Room (docs/systems/warroom.md).
 * Written as the war goes on; the simulation never reads it.
 */
export interface WarRecord {
  /** The war's id. Allies' joined wars fold into the record of the war they joined. */
  id: number;
  attacker: NationId;
  defender: NationId;
  allies: { nation: NationId; side: "attack" | "defend"; year: number }[];
  goal: WarGoal;
  start: number;
  /** Set when the war ends. */
  end?: number;
  /** The score at the end of each year (positive = attacker winning). */
  scores: number[];
  battles: BattleRecord[];
  /** Soldiers lost by each side, allies included. */
  fallen: { attack: number; defend: number };
  /** Turning points worth stopping for. */
  moments: { year: number; kind: "joined" | "rout" | "capital"; text: string }[];
  outcome?: WarOutcome;
}

/** Two nations pledged to fight beside each other (SPEC §4.12). `a` < `b`. */
export interface Alliance {
  a: NationId;
  b: NationId;
  since: number;
  /** Last year they fought a shared enemy. A pact left unused fades (SPEC §4.12). */
  renewed: number;
}

export interface SimEvent {
  year: number;
  type: "founded" | "war" | "peace" | "rebellion" | "collapse" | "annexed" | "capital_moved" | "alliance" | "alliance_ended" | "city_founded" | "battle" | "faith" | "ruler" | "general";
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
  /** Who holds this cell by force during a war (0 = nobody). The owner only changes at peace. */
  occupier: Int32Array;
  /** How far a siege of this cell has got, 0..1. */
  siege: Float32Array;
  /** Which realm's people live here (SPEC §4.14): the nation that first settled it or broke away. 0 = nobody. */
  culture: Uint16Array;
  /** FaithId of the people here (SPEC §4.14). 0 = nobody. */
  faith: Uint8Array;
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
  nextWarId: number;
  /** This year's battles (not saved: only the map needs them). */
  battles: BattleReport[];
  /** Every war declared so far, ongoing and over (docs/systems/warroom.md). Saved; never read by the simulation. */
  warRecords: WarRecord[];
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
  /** Every god command given so far, in order. History = seed + settings + this log (docs/systems/sandbox.md). */
  commands: LoggedCommand[];
}

/** How history opens (docs/systems/start.md): small nations in an empty world, or old kingdoms sharing all of it. */
export type StartOptions = { kind: "open" } | { kind: "settled"; kingdoms: number };
