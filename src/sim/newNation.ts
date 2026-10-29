// Creating a nation in the middle of history (rebels and newly emerged states).
import type { Rng } from "../core/rng";
import type { CellId, Nation, NationId, RaceId, WorldState } from "../core/types";
import { nameNationAt, nationColor } from "../gen/nations";
import { traits } from "../gen/races";
import { nextNationId, takenNames } from "./helpers";
import { emptyAccess } from "./resources";

/** Makes a new nation of `race` with a fresh name and color, adds it to the state, and returns it. */
export function addNation(
  state: WorldState,
  rng: Rng,
  capital: CellId,
  stability: number,
  race: RaceId,
  parent?: NationId,
): Nation {
  const id = nextNationId(state);
  const [x, y] = state.cells[capital]!.site;
  const nation: Nation = {
    id,
    name: nameNationAt(rng, state.cultureHomes, takenNames(state), x, y, race),
    color: nationColor(state.colorHue, id),
    capital,
    founded: state.year,
    race,
    alive: true,
    stability,
    warWeariness: 0,
    reserve: 0, // filled up in its first year (sim/manpower.ts)
    area: 0,
    pop: 0,
    strength: 0,
    manpowerCap: 0,
    foreignShare: 0,
    unrest: traits(race).unrest,
    control: 1,
    access: emptyAccess(),
  };
  if (parent !== undefined) nation.parent = parent;
  state.nations.set(id, nation);
  return nation;
}

/** Where to put a capital among `cells`: the biggest settlement, then the most populous (lowest id wins a tie). */
export function bestCapital(state: WorldState, cells: CellId[]): CellId {
  const level = state.state.settlement;
  let top = 0;
  for (const c of cells) top = Math.max(top, level[c]!);
  return mostPopulous(
    state,
    cells.filter((c) => level[c] === top),
  );
}

/** The most populous of `cells` (lowest id wins a tie). */
export function mostPopulous(state: WorldState, cells: CellId[]): CellId {
  let best = cells[0]!;
  for (const c of cells) {
    const p = state.state.pop[c]!;
    const bestPop = state.state.pop[best]!;
    if (p > bestPop || (p === bestPop && c < best)) best = c;
  }
  return best;
}
