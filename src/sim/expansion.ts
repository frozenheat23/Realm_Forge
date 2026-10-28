// Step 4 (SPEC §4.4): nations settle neighboring empty land.
import type { Rng } from "../core/rng";
import type { NationId, WorldState } from "../core/types";
import { moveCost } from "./helpers";
import { SIM } from "./params";

/**
 * Each empty land cell next to a nation may be claimed with chance
 * SIM.EXPANSION_RATE / moveCost (easy on plains, hard in mountains and deserts).
 * If several neighbors claim the same cell in one year, one wins at random.
 * Decisions use ownership from the start of the year, so a nation can only
 * grow one ring of cells per year.
 */
export function expand(state: WorldState, rng: Rng): void {
  const { cells } = state;
  const { owner, pop } = state.state;
  const before = owner.slice(); // snapshot of who owned what at the start of the year

  for (const cell of cells) {
    if (!cell.isLand || before[cell.id] !== 0) continue;

    // Neighboring nations, each listed once, in id order (keeps results repeatable).
    const nearby = [...new Set(cell.neighbors.map((n) => before[n]!).filter((o) => o !== 0))].sort(
      (a, b) => a - b,
    );
    if (nearby.length === 0) continue;

    const chance = SIM.EXPANSION_RATE / moveCost(cell);
    const claimants: NationId[] = nearby.filter(() => rng.chance(chance));
    if (claimants.length === 0) continue;

    owner[cell.id] = rng.pick(claimants);
    pop[cell.id] = cell.capacity * SIM.NEW_CELL_POP_FRACTION;
  }
}
