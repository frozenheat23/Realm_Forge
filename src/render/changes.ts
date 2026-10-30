// Works out what to animate (SPEC §5.4g) from the world.
// Pure data in, data out: no canvas here, so it can be tested. Only reads the world.
import type { CellId, WorldState } from "../core/types";

/** Cells under siege right now (occupied ones are finished). */
export function siegeCells(state: WorldState): CellId[] {
  const { siege, occupier } = state.state;
  const found: CellId[] = [];
  for (let c = 0; c < siege.length; c++) if (siege[c]! > 0 && occupier[c] === 0) found.push(c);
  return found;
}

/** Owned cells whose value is at least `min` (e.g. devastated or restless land). */
export function hotCells(values: Float32Array, owner: Int32Array, min: number): CellId[] {
  const hot: CellId[] = [];
  for (let c = 0; c < values.length; c++) {
    if (owner[c]! > 0 && values[c]! >= min) hot.push(c);
  }
  return hot;
}

/**
 * Restless cells (unrest ≥ `min`) in nations unstable enough to rebel this year
 * (stability below `maxStability`). Only a `density` share of them is kept, picked
 * the same way every frame, so a whole empire doesn't turn orange.
 */
export function restlessCells(state: WorldState, min: number, maxStability: number, density: number): CellId[] {
  const { owner, unrest } = state.state;
  const restless: CellId[] = [];
  for (let c = 0; c < owner.length; c++) {
    if (unrest[c]! < min || cellPhase(c) >= density) continue;
    const nation = state.nations.get(owner[c]!);
    if (nation && nation.stability < maxStability) restless.push(c);
  }
  return restless;
}

/** A steady pseudo-random number 0..1 per cell, so each puff or ember gets its own timing (not RNG: same every frame). */
export function cellPhase(cell: CellId): number {
  // Multiplying by the golden ratio and keeping the fraction spreads ids evenly over 0..1.
  return (cell * 0.618034) % 1;
}
