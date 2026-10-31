// Places the starting nations (SPEC §3.8): capitals, small home territories, names and colors.
import type { Rng } from "../core/rng";
import type { Cell, CellId, Nation, NationId, RaceHome, RaceId, SimEvent } from "../core/types";
import { buildChain, generateName } from "./names";
import { FAMILY_NAMES, NAME_CULTURES } from "./nameCorpus";
import { PLAYABLE_RACES, raceAt, raceCapacity, traits } from "./races";
import { RESOURCE_KINDS } from "./resources";
import { MinHeap } from "./rivers";
import {
  NATION_LIGHTNESS,
  NATION_SATURATION,
  START_CORE_SIZE,
  START_HOME_RANGE,
  START_MIN_SPACING,
  START_NATIONS,
  START_POP_FRACTION,
  START_STABILITY,
} from "./params";

/** Marks every cell fewer than `steps` steps from `start` (breadth-first). */
function markNearby(start: CellId, steps: number, cells: Cell[], marked: Uint8Array): void {
  const dist = new Map<CellId, number>([[start, 0]]);
  const queue = [start];
  marked[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const d = dist.get(cell)!;
    if (d + 1 >= steps) continue;
    for (const n of cells[cell]!.neighbors) {
      if (dist.has(n)) continue;
      dist.set(n, d + 1);
      marked[n] = 1;
      queue.push(n);
    }
  }
}

/**
 * Picks capital cells: best land first (highest capacity), skipping any cell
 * too close to a capital already chosen. A little randomness breaks ties, so
 * equally good cells don't always win in the same order.
 */
export function placeCapitals(rng: Rng, cells: Cell[], count: number, spacing: number): CellId[] {
  const candidates = cells
    .filter((c) => c.isLand && c.capacity > 0)
    .map((c) => ({ id: c.id, score: c.capacity + rng.next() * 0.05 }))
    .sort((a, b) => b.score - a.score);

  const tooClose = new Uint8Array(cells.length);
  const capitals: CellId[] = [];
  for (const { id } of candidates) {
    if (capitals.length >= count) break;
    if (tooClose[id]) continue;
    capitals.push(id);
    markNearby(id, spacing, cells, tooClose);
  }
  return capitals;
}

/**
 * The best home for a race within START_HOME_RANGE steps of `capital`: its most
 * hospitable free land, so elves settle in forest and dwarves in the hills.
 */
export function homeCell(capital: CellId, race: RaceId, cells: Cell[], owner: Int32Array, taken: Set<CellId>): CellId {
  let best = capital;
  const seen = new Set<CellId>([capital]);
  let ring = [capital];
  for (let step = 0; step < START_HOME_RANGE; step++) {
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of cells[c]!.neighbors) {
        if (seen.has(n) || !cells[n]!.isLand || owner[n] !== 0) continue;
        seen.add(n);
        next.push(n);
        if (!taken.has(n) && raceCapacity(cells[n]!, race) > raceCapacity(cells[best]!, race)) best = n;
      }
    }
    ring = next;
  }
  return best;
}

/** What a step onto `cell` costs a race when claiming its first land: cheap terrain is claimed first. */
function claimCost(cell: Cell, race: RaceId): number {
  const t = traits(race);
  return (t.terrainCost[cell.biome] ?? 1) * (cell.mountain ? t.mountainCost : 1);
}

/**
 * Claims up to `size` unowned land cells around the capital, cheapest to reach for
 * its race first, so elves spread along their forests. Returns them.
 */
export function claimCore(capital: CellId, nationId: NationId, size: number, race: RaceId, cells: Cell[], owner: Int32Array): CellId[] {
  const claimed: CellId[] = [];
  const cost = new Map<CellId, number>([[capital, 0]]);
  const heap = new MinHeap();
  heap.push(capital, 0);
  while (heap.size > 0 && claimed.length < size) {
    const cell = heap.pop();
    if (owner[cell] !== 0) continue; // another nation's land: go no further this way
    owner[cell] = nationId;
    claimed.push(cell);
    for (const n of cells[cell]!.neighbors) {
      if (!cells[n]!.isLand) continue;
      const next = cost.get(cell)! + claimCost(cells[n]!, race);
      if (next >= (cost.get(n) ?? Infinity)) continue;
      cost.set(n, next);
      heap.push(n, next);
    }
  }
  return claimed;
}

/** Turns hue (0..360), saturation and lightness (0..1) into a "#rrggbb" color. */
export function hslToHex(hue: number, sat: number, light: number): string {
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

// Stepping round the color wheel by the "golden angle" (~137.5°) keeps every
// new color far from the ones before it, however many nations there are.
const GOLDEN_ANGLE = 137.508;

/** Color for nation number `id`. Every new nation steps further round the color wheel. */
export function nationColor(colorHue: number, id: NationId): string {
  return hslToHex((colorHue + (id - 1) * GOLDEN_ANGLE) % 360, NATION_SATURATION, NATION_LIGHTNESS);
}

/** Which culture's names a nation at (x, y) uses: the one with the nearest home point. */
export function cultureAt(cultureHomes: [number, number][], x: number, y: number): number {
  let culture = 0;
  let best = Infinity;
  cultureHomes.forEach(([hx, hy], c) => {
    const d = (hx - x) ** 2 + (hy - y) ** 2;
    if (d < best) [best, culture] = [d, c];
  });
  return culture;
}

/**
 * Makes a new nation name for a nation of `race` whose capital is at (x, y).
 * Humans use the culture of the nearest home point; other races use their family's names.
 */
export function nameNationAt(
  rng: Rng,
  cultureHomes: [number, number][],
  taken: Set<string>,
  x: number,
  y: number,
  race: RaceId,
): string {
  const family = traits(race).family;
  const examples = family === "human" ? NAME_CULTURES[cultureAt(cultureHomes, x, y)]!.examples : FAMILY_NAMES[family];
  return generateName(rng, buildChain(examples), taken, examples);
}

/**
 * Which race each capital gets: the race of the nearest homeland. Then any race
 * left without a nation takes over the capital nearest its first homeland, so
 * every race is on the map at year 0 (SPEC §3.8).
 */
export function assignCapitalRaces(capitals: CellId[], cells: Cell[], homes: RaceHome[]): RaceId[] {
  const races = capitals.map((c) => raceAt(homes, ...cells[c]!.site));
  const counts = new Map<RaceId, number>();
  for (const r of races) counts.set(r, (counts.get(r) ?? 0) + 1);

  for (const race of PLAYABLE_RACES) {
    if (counts.get(race)) continue;
    const home = homes.find((h) => h.race === race)!;
    // Nearest capital whose race can spare one (so we never leave another race empty).
    let best = -1;
    let bestDist = Infinity;
    capitals.forEach((c, i) => {
      if ((counts.get(races[i]!) ?? 0) < 2) return;
      const [x, y] = cells[c]!.site;
      const d = (x - home.at[0]) ** 2 + (y - home.at[1]) ** 2;
      if (d < bestDist) [bestDist, best] = [d, i];
    });
    if (best < 0) continue; // fewer capitals than races: nothing to spare
    counts.set(races[best]!, counts.get(races[best]!)! - 1);
    counts.set(race, 1);
    races[best] = race;
  }
  return races;
}

export interface StartingNations {
  nations: Map<NationId, Nation>;
  owner: Int32Array;
  pop: Float32Array;
  race: Uint8Array;
  events: SimEvent[];
  cultureHomes: [number, number][];
  colorHue: number;
}

export function createStartingNations(
  rng: Rng,
  cells: Cell[],
  width: number,
  height: number,
  raceHomes: RaceHome[],
): StartingNations {
  const owner = new Int32Array(cells.length);
  const pop = new Float32Array(cells.length);
  const cellRace = new Uint8Array(cells.length);
  const nations = new Map<NationId, Nation>();
  const events: SimEvent[] = [];

  // Each culture gets a home point on the map; a human nation speaks the culture of the
  // nearest home point, so neighbors end up with related-sounding names.
  const cultureHomes = NAME_CULTURES.map((): [number, number] => [rng.range(0, width), rng.range(0, height)]);
  const takenNames = new Set<string>();
  const nameRng = rng.fork("names");
  const colorHue = rng.range(0, 360);

  const capitals = placeCapitals(rng.fork("capitals"), cells, START_NATIONS, START_MIN_SPACING);
  const capitalRaces = assignCapitalRaces(capitals, cells, raceHomes);
  const homes = new Set(capitals);
  capitals.forEach((placed, index) => {
    const id: NationId = index + 1; // 0 means "unowned"
    const race = capitalRaces[index]!;
    const capital = homeCell(placed, race, cells, owner, homes);
    homes.delete(placed);
    homes.add(capital);
    const [x, y] = cells[capital]!.site;

    const size = Math.round(START_CORE_SIZE * traits(race).startSize);
    const territory = claimCore(capital, id, size, race, cells, owner);
    let totalPop = 0;
    for (const cell of territory) {
      cellRace[cell] = race;
      pop[cell] = raceCapacity(cells[cell]!, race) * START_POP_FRACTION;
      totalPop += pop[cell]!;
    }

    const name = nameNationAt(nameRng, cultureHomes, takenNames, x, y, race);
    nations.set(id, {
      id,
      name,
      color: nationColor(colorHue, id),
      capital,
      founded: 0,
      race,
      alive: true,
      stability: START_STABILITY,
      warWeariness: 0,
      reserve: 0, // filled up in the simulation's first year
      area: territory.length,
      pop: totalPop,
      strength: 0, // worked out by the simulation each year (M4a)
      manpowerCap: 0,
      foreignShare: 0,
      unrest: traits(race).unrest,
      control: 1,
      access: new Array<number>(RESOURCE_KINDS.length + 1).fill(0), // worked out by the simulation each year
    });
    events.push({
      year: 0,
      type: "founded",
      actors: [id],
      text: `Year 0: ${name}, a realm of ${traits(race).plural}, is founded.`,
    });
  });

  return { nations, owner, pop, race: cellRace, events, cultureHomes, colorHue };
}
