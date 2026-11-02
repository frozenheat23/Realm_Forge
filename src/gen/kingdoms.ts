// Settled start (docs/systems/start.md): old kingdoms that share all the land at year 0.
// This draws them: capitals on race homelands, borders grown by travel cost, mixed peoples.
// `sim/start.ts` then ages them (development, towns and cities).
import type { Rng } from "../core/rng";
import type { Cell, CellId, Nation, NationId, RaceHome, RaceId } from "../core/types";
import { faithAt } from "./faiths";
import { homeCell, markNearby, nameNationAt, nationColor, type StartingNations } from "./nations";
import { NAME_CULTURES } from "./nameCorpus";
import { KINGDOM_MIN_LAND, KINGDOM_ROOM, KINGDOM_SPACING, MAX_KINGDOMS, MIN_KINGDOMS, OLD_REALM_YEARS, SETTLED_POP_FRACTION, START_STABILITY } from "./params";
import { travelCost } from "./provinces";
import { PLAYABLE_RACES, raceAt, raceCapacity, traits } from "./races";
import { RESOURCE_KINDS } from "./resources";
import { MinHeap } from "./rivers";
import { dynastyName, makeRuler, midReign } from "./rulers";

/** What old kingdoms add to a start: how long each cell has been held. */
export interface Kingdoms extends StartingNations {
  ownedSince: Int32Array;
}

/** Squared distance from a homeland to the nearest of `chosen` (Infinity if none). */
function spaceAround(home: RaceHome, chosen: RaceHome[]): number {
  let nearest = Infinity;
  for (const c of chosen) nearest = Math.min(nearest, (home.at[0] - c.at[0]) ** 2 + (home.at[1] - c.at[1]) ** 2);
  return nearest;
}

/**
 * Which homelands get a kingdom (`count`, between MIN_KINGDOMS and MAX_KINGDOMS).
 * Every race gets one; then the rest go to the spare homelands. Each pick takes the
 * homeland farthest from the kingdoms already placed, so no capital is squeezed in
 * beside another. The races take their turns in a random order.
 */
export function kingdomHomes(rng: Rng, homes: RaceHome[], count: number): RaceHome[] {
  const wanted = Math.max(MIN_KINGDOMS, Math.min(MAX_KINGDOMS, count, homes.length));
  const chosen: RaceHome[] = [];
  const farthest = (options: RaceHome[]) =>
    options.reduce((best, h) => (spaceAround(h, chosen) > spaceAround(best, chosen) ? h : best), options[0]!);

  // Races in a random order (Fisher–Yates), each taking its roomiest homeland.
  const order = [...PLAYABLE_RACES];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  for (const race of order) {
    const own = homes.filter((h) => h.race === race);
    if (own.length > 0) chosen.push(chosen.length === 0 ? rng.pick(own) : farthest(own));
  }
  while (chosen.length < wanted) {
    const spare = homes.filter((h) => !chosen.includes(h));
    if (spare.length === 0) break;
    chosen.push(farthest(spare));
  }
  return chosen;
}

/** How many habitable cells are in the same connected body of land as each cell (0 for water and ice). */
function landBodies(cells: Cell[]): Int32Array {
  const size = new Int32Array(cells.length);
  const seen = new Uint8Array(cells.length);
  const habitable = (c: Cell) => c.isLand && c.capacity > 0;
  for (const start of cells) {
    if (seen[start.id] || !habitable(start)) continue;
    const body = [start.id];
    seen[start.id] = 1;
    for (let head = 0; head < body.length; head++) {
      for (const n of cells[body[head]!]!.neighbors) {
        if (!seen[n] && habitable(cells[n]!)) {
          seen[n] = 1;
          body.push(n);
        }
      }
    }
    for (const c of body) size[c] = body.length;
  }
  return size;
}

/** Habitable cells within `steps` steps of `cell`, over habitable land: how much room there is around it. */
function roomAround(cells: Cell[], cell: CellId, steps: number): number {
  const seen = new Set<CellId>([cell]);
  let ring = [cell];
  for (let step = 0; step < steps; step++) {
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of cells[c]!.neighbors) {
        if (seen.has(n) || !cells[n]!.isLand || cells[n]!.capacity <= 0) continue;
        seen.add(n);
        next.push(n);
      }
    }
    ring = next;
  }
  return seen.size;
}

/** The cell within KINGDOM_ROOM steps of `start` (and clear of other capitals) with the most room around it. */
function openCountry(cells: Cell[], start: CellId, tooClose: Uint8Array): CellId {
  let best = start;
  let bestRoom = roomAround(cells, start, KINGDOM_ROOM);
  const seen = new Set<CellId>([start]);
  let ring = [start];
  for (let step = 0; step < KINGDOM_ROOM; step++) {
    const next: CellId[] = [];
    for (const c of ring) {
      for (const n of cells[c]!.neighbors) {
        if (seen.has(n) || !cells[n]!.isLand || cells[n]!.capacity <= 0 || tooClose[n]) continue;
        seen.add(n);
        next.push(n);
        const room = roomAround(cells, n, KINGDOM_ROOM);
        if (room > bestRoom) [best, bestRoom] = [n, room];
      }
    }
    ring = next;
  }
  return best;
}

/** The habitable cell nearest a point, keeping clear of cells marked too close to another capital. */
function nearestHabitable(cells: Cell[], x: number, y: number, tooClose: Uint8Array): CellId {
  let best = -1;
  let bestDistance = Infinity;
  for (const c of cells) {
    if (!c.isLand || c.capacity <= 0 || tooClose[c.id]) continue;
    const d = (c.site[0] - x) ** 2 + (c.site[1] - y) ** 2;
    if (d < bestDistance) [best, bestDistance] = [c.id, d];
  }
  return best;
}

/**
 * Shares out the land: every kingdom takes one cell per round, in turn, always the
 * cheapest to reach from its own land (by travel cost), until no kingdom can reach
 * any more. So terrain shapes the borders, but a kingdom boxed in on a peninsula keeps
 * pace with the rest instead of being left with a scrap. Fills `owner`.
 */
function growKingdoms(cells: Cell[], capitals: CellId[], owner: Int32Array): void {
  const frontiers = capitals.map((capital) => {
    const heap = new MinHeap();
    heap.push(capital, 0);
    return { heap, cost: new Map<CellId, number>([[capital, 0]]) };
  });
  let growing = true;
  while (growing) {
    growing = false;
    frontiers.forEach(({ heap, cost }, i) => {
      // Take the cheapest cell nobody holds yet; cells others got first are skipped.
      while (heap.size > 0) {
        const c = heap.pop();
        if (owner[c] !== 0) continue;
        owner[c] = i + 1;
        growing = true;
        for (const n of cells[c]!.neighbors) {
          const cell = cells[n]!;
          if (!cell.isLand || cell.capacity <= 0 || owner[n] !== 0) continue;
          const next = cost.get(c)! + travelCost(cell);
          if (next >= (cost.get(n) ?? Infinity)) continue;
          cost.set(n, next);
          heap.push(n, next);
        }
        return;
      }
    });
  }
}

/** Old kingdoms on the race homelands, sharing all the land they can reach. */
export function createKingdoms(rng: Rng, cells: Cell[], width: number, height: number, raceHomes: RaceHome[], count: number): Kingdoms {
  const owner = new Int32Array(cells.length);
  const pop = new Float32Array(cells.length);
  const cellRace = new Uint8Array(cells.length);
  const cellCulture = new Uint16Array(cells.length);
  const cellFaith = new Uint8Array(cells.length);
  const ownedSince = new Int32Array(cells.length);
  const nations = new Map<NationId, Nation>();

  const cultureHomes = NAME_CULTURES.map((): [number, number] => [rng.range(0, width), rng.range(0, height)]);
  const colorHue = rng.range(0, 360);
  const takenNames = new Set<string>();
  const nameRng = rng.fork("names");

  // 1. Capitals, on the chosen homelands.
  const homes = kingdomHomes(rng.fork("homes"), raceHomes, count);
  const capitals: CellId[] = [];
  const races: RaceId[] = [];
  const taken = new Set<CellId>();
  // Land within KINGDOM_SPACING steps of a capital is kept clear of other capitals.
  const tooClose = new Uint8Array(cells.length);
  // ...and from land too small to grow a kingdom on.
  const bodies = landBodies(cells);
  bodies.forEach((size, c) => {
    if (size < KINGDOM_MIN_LAND) tooClose[c] = 1;
  });
  for (const home of homes) {
    let near = nearestHabitable(cells, home.at[0], home.at[1], tooClose);
    if (near < 0) near = nearestHabitable(cells, home.at[0], home.at[1], Uint8Array.from(cells, (c) => (taken.has(c.id) ? 1 : 0)));
    if (near < 0) continue;
    // Shift toward land its race likes, but never into the space around another capital.
    const capital = openCountry(cells, homeCell(near, home.race, cells, Int32Array.from(tooClose), taken), tooClose);
    taken.add(capital);
    markNearby(capital, KINGDOM_SPACING, cells, tooClose);
    capitals.push(capital);
    races.push(home.race);
  }

  // 2. Land.
  growKingdoms(cells, capitals, owner);

  // 3. The kingdoms themselves.
  capitals.forEach((capital, i) => {
    const id: NationId = i + 1;
    const race = races[i]!;
    const [x, y] = cells[capital]!.site;
    const rulerRng = rng.fork(`ruler-${id}`);
    const surname = nameNationAt(rulerRng, cultureHomes, new Set(), x, y, race);
    nations.set(id, {
      id,
      name: nameNationAt(nameRng, cultureHomes, takenNames, x, y, race),
      color: nationColor(colorHue, id),
      capital,
      founded: -OLD_REALM_YEARS,
      race,
      culture: id,
      faith: faithAt(raceHomes, race, x, y),
      ruler: midReign(rulerRng, makeRuler(rulerRng, race, 0, dynastyName(race, surname))),
      alive: true,
      stability: START_STABILITY,
      warWeariness: 0,
      reserve: 0, // filled up in the simulation's first year
      area: 0,
      pop: 0,
      strength: 0,
      manpowerCap: 0,
      foreignShare: 0,
      unrest: traits(race).unrest,
      control: 1,
      access: new Array<number>(RESOURCE_KINDS.length + 1).fill(0),
    });
  });

  // 4. Peoples: the race of the nearest homeland, the culture of the nearest kingdom of that race,
  //    the faith of their homeland. Kingdoms that span other homelands hold subject peoples.
  const kingdomsOf = (race: RaceId) => capitals.map((c, i) => ({ c, id: i + 1 })).filter((k) => races[k.id - 1] === race);
  for (const cell of cells) {
    const id = owner[cell.id]!;
    if (id === 0) continue;
    const [x, y] = cell.site;
    const race = raceAt(raceHomes, x, y);
    let culture = id;
    let best = Infinity;
    for (const k of kingdomsOf(race)) {
      const d = (cells[k.c]!.site[0] - x) ** 2 + (cells[k.c]!.site[1] - y) ** 2;
      if (d < best) [best, culture] = [d, k.id];
    }
    cellRace[cell.id] = race;
    cellCulture[cell.id] = culture;
    cellFaith[cell.id] = faithAt(raceHomes, race, x, y);
    pop[cell.id] = raceCapacity(cell, race) * SETTLED_POP_FRACTION;
    ownedSince[cell.id] = -OLD_REALM_YEARS;
  }
  // A capital is always home to its own people.
  capitals.forEach((capital, i) => {
    cellRace[capital] = races[i]!;
    cellCulture[capital] = i + 1;
    cellFaith[capital] = nations.get(i + 1)!.faith;
    pop[capital] = raceCapacity(cells[capital]!, races[i]!) * SETTLED_POP_FRACTION;
  });

  // 5. One line in the log per kingdom.
  const area = new Map<NationId, number>();
  for (const id of owner) if (id !== 0) area.set(id, (area.get(id) ?? 0) + 1);
  const events = [...nations.values()].map((n) => ({
    year: 0,
    type: "founded" as const,
    actors: [n.id],
    text: `Year 0: ${n.name}, an ancient realm of ${traits(n.race).plural}, holds ${area.get(n.id) ?? 0} provinces.`,
  }));

  return { nations, owner, pop, race: cellRace, culture: cellCulture, faith: cellFaith, events, cultureHomes, colorHue, ownedSince };
}
