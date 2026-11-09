// Read-only statistics for the Play tab, including year 0 before the first simulation tick.
import type { WorldState } from "../core/types";

interface RealmSize {
  cells: number;
  pop: number;
  unrest: number;
  foreignShare: number;
}

/** Counts the current inhabitants, so initial or recently changed ownership cannot show stale demographics. */
export function realmSizes(state: WorldState): Map<number, RealmSize> {
  const { owner, pop, unrest, race } = state.state;
  const sizes = new Map<number, RealmSize>();
  for (let c = 0; c < owner.length; c++) {
    const id = owner[c]!;
    if (id === 0) continue;
    const size = sizes.get(id) ?? { cells: 0, pop: 0, unrest: 0, foreignShare: 0 };
    size.cells++;
    size.pop += pop[c]!;
    size.unrest += unrest[c]!;
    if (race[c] !== state.nations.get(id)!.race) size.foreignShare += pop[c]!;
    sizes.set(id, size);
  }
  for (const size of sizes.values()) {
    size.unrest /= size.cells;
    size.foreignShare = size.pop > 0 ? size.foreignShare / size.pop : 0;
  }
  return sizes;
}
