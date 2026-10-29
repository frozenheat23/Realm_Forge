// Works out what to animate (SPEC §5.4g) by comparing the world before and after a year.
// Pure data in, data out: no canvas here, so it can be tested. Only reads the world.
import type { Cell, CellId, NationId, WorldState } from "../core/types";
import { pairKey } from "../sim/helpers";

/** Land one nation took from another in one year, and where to show it. */
export interface Battle {
  winner: NationId;
  loser: NationId;
  /** Average position of the captured cells, in map pixels. */
  x: number;
  y: number;
  cells: CellId[];
}

/**
 * Cells that changed owner between two nations at war, grouped by (winner, loser).
 * `warPairs` holds the `pairKey` of every pair at war during the year (before or after it).
 */
export function findBattles(cells: Cell[], before: Int32Array, after: Int32Array, warPairs: Set<number>): Battle[] {
  // Key = winner and loser in that order, so A taking from B and B taking from A are separate battles.
  const groups = new Map<string, Battle>();
  for (let c = 0; c < after.length; c++) {
    const loser = before[c]!;
    const winner = after[c]!;
    if (loser === winner || loser === 0 || winner === 0) continue;
    if (!warPairs.has(pairKey(winner, loser))) continue;
    const key = `${winner}>${loser}`;
    let battle = groups.get(key);
    if (!battle) {
      battle = { winner, loser, x: 0, y: 0, cells: [] };
      groups.set(key, battle);
    }
    battle.cells.push(c);
  }
  for (const battle of groups.values()) {
    for (const c of battle.cells) {
      battle.x += cells[c]!.site[0];
      battle.y += cells[c]!.site[1];
    }
    battle.x /= battle.cells.length;
    battle.y /= battle.cells.length;
  }
  return [...groups.values()];
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
