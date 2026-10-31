// Step 9 (SPEC §4.8): new nations rise in large empty regions.
import type { Rng } from "../core/rng";
import type { CellId, SimEvent, WorldState } from "../core/types";
import { claimCore } from "../gen/nations";
import { START_POP_FRACTION, START_STABILITY } from "../gen/params";
import { raceAt, raceCapacity } from "../gen/races";
import { foundedEvent } from "./events";
import { SIM } from "./params";
import { addNation } from "./newNation";

/** Groups of connected, empty, habitable land cells. */
export function emptyRegions(state: WorldState): CellId[][] {
  const { cells } = state;
  const owner = state.state.owner;
  const habitableEmpty = (c: CellId) => cells[c]!.isLand && cells[c]!.capacity > 0 && owner[c] === 0;
  const visited = new Uint8Array(cells.length);
  const regions: CellId[][] = [];

  for (const start of cells) {
    if (visited[start.id] || !habitableEmpty(start.id)) continue;
    const region: CellId[] = [];
    const queue = [start.id];
    visited[start.id] = 1;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head]!;
      region.push(cell);
      for (const n of cells[cell]!.neighbors) {
        if (!visited[n] && habitableEmpty(n)) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
    regions.push(region);
  }
  return regions;
}

export function emergence(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  emptyRegions(state).forEach((region, index) => {
    if (region.length < SIM.EMERGENCE_MIN_REGION) return;
    const regionRng = rng.fork(`region-${index}`);
    if (!regionRng.chance(SIM.EMERGENCE_PROB)) return;

    // Found it on the region's best land.
    let capital = region[0]!;
    for (const c of region) if (state.cells[c]!.capacity > state.cells[capital]!.capacity) capital = c;

    // The people who rise here are the race whose homeland is nearest.
    const race = raceAt(state.raceHomes, ...state.cells[capital]!.site);
    const nation = addNation(state, regionRng, capital, START_STABILITY, race);
    for (const c of claimCore(capital, nation.id, SIM.EMERGENCE_CORE_SIZE, race, state.cells, state.state.owner)) {
      // claimCore (shared with generation) sets the owner directly, so record the change here.
      state.state.prevOwner[c] = 0;
      state.state.ownedSince[c] = state.year;
      state.state.race[c] = race;
      state.state.culture[c] = nation.culture;
      state.state.faith[c] = nation.faith;
      state.state.pop[c] = raceCapacity(state.cells[c]!, race) * START_POP_FRACTION;
    }
    events.push(foundedEvent(state.year, nation, "in the wilderness"));
  });
  return events;
}
