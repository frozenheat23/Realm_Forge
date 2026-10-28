// Creating a nation in the middle of history (rebels and newly emerged states).
import type { Rng } from "../core/rng";
import type { CellId, Nation, NationId, WorldState } from "../core/types";
import { nameNationAt, nationColor } from "../gen/nations";
import { nextNationId, takenNames } from "./helpers";

/** Makes a new nation with a fresh name and color, adds it to the state, and returns it. */
export function addNation(
  state: WorldState,
  rng: Rng,
  capital: CellId,
  stability: number,
  parent?: NationId,
): Nation {
  const id = nextNationId(state);
  const [x, y] = state.cells[capital]!.site;
  const nation: Nation = {
    id,
    name: nameNationAt(rng, state.cultureHomes, takenNames(state), x, y),
    color: nationColor(state.colorHue, id),
    capital,
    founded: state.year,
    alive: true,
    stability,
    warWeariness: 0,
    area: 0,
    pop: 0,
    strength: 0,
  };
  if (parent !== undefined) nation.parent = parent;
  state.nations.set(id, nation);
  return nation;
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
