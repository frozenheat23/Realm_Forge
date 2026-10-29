// Step 4 (SPEC §4.4): nations settle neighboring empty land.
import type { Rng } from "../core/rng";
import { Resource, type NationId, type WorldState } from "../core/types";
import { raceCapacity } from "../gen/races";
import { moveCost, setOwner } from "./helpers";
import { SIM } from "./params";
import { resourceBonus } from "./resources";

/**
 * Each empty land cell next to a nation may be claimed with chance
 * SIM.EXPANSION_RATE / moveCost (easy on plains, hard in mountains and deserts;
 * each race finds some land easier than others).
 * If several neighbors claim the same cell in one year, one wins at random.
 * The winner's race settles it. Decisions use ownership from the start of the
 * year, so a nation can only grow one ring of cells per year.
 */
export function expand(state: WorldState, rng: Rng): void {
  const { cells } = state;
  const { owner, pop, race } = state.state;
  // `owner` is only read here, to take the snapshot; changes go through setOwner.
  const before = owner.slice(); // snapshot of who owned what at the start of the year

  for (const cell of cells) {
    if (!cell.isLand || before[cell.id] !== 0) continue;

    // Neighboring nations, each listed once, in id order (keeps results repeatable).
    const nearby = [...new Set(cell.neighbors.map((n) => before[n]!).filter((o) => o !== 0))].sort(
      (a, b) => a - b,
    );
    if (nearby.length === 0) continue;

    const claimants: NationId[] = nearby.filter((id) => {
      const nation = state.nations.get(id)!;
      // Horses carry settlers further; timber makes rough country easier to build in.
      const rate = SIM.EXPANSION_RATE * resourceBonus(nation, Resource.Horses);
      const cost = moveCost(cell, nation.race) * resourceBonus(nation, Resource.Timber);
      return rng.chance(rate / cost);
    });
    if (claimants.length === 0) continue;

    const winner = state.nations.get(rng.pick(claimants))!;
    setOwner(state, cell.id, winner.id);
    race[cell.id] = winner.race;
    pop[cell.id] = raceCapacity(cell, winner.race) * SIM.NEW_CELL_POP_FRACTION;
  }
}
