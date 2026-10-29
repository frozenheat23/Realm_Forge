// Resource bonuses and how much a nation wants a cell (SPEC §4.11).
import { Resource, type CellId, type Nation, type RaceId, type ResourceKind, type WorldState } from "../core/types";
import { RESOURCES } from "../gen/params";
import { RESOURCE_KINDS } from "../gen/resources";
import { raceCapacity, traits } from "../gen/races";
import { SIM } from "./params";

/** A fresh access list: 0 for every resource (index = ResourceId; 0 = none, unused). */
export function emptyAccess(): number[] {
  return new Array<number>(RESOURCE_KINDS.length + 1).fill(0);
}

/**
 * The multiplier a nation gets from one resource: 1 with no deposits, rising to
 * the resource's full `effect` once its access reaches RESOURCE_SATURATION.
 * Owning more after that doesn't help, which limits snowballing.
 */
export function resourceBonus(nation: Nation | undefined, resource: ResourceKind): number {
  if (!nation) return 1;
  const share = Math.min(1, (nation.access[resource] ?? 0) / SIM.RESOURCE_SATURATION);
  return 1 + (RESOURCES[resource].effect - 1) * share;
}

/** How many people a cell can hold right now: its race's capacity, cut by war damage, raised by the owner's grain. */
export function effectiveCapacity(state: WorldState, cell: CellId): number {
  const s = state.state;
  return (
    raceCapacity(state.cells[cell]!, s.race[cell]!) *
    (1 - s.devastation[cell]! * SIM.DEVASTATION_CAP_LOSS) *
    resourceBonus(state.nations.get(s.owner[cell]!), Resource.Grain)
  );
}

/** How much a nation of `race` wants this cell: how full and developed it is, plus any deposit it prizes. */
export function cellValue(state: WorldState, cell: CellId, race: RaceId, capacity: number): number {
  const c = state.cells[cell]!;
  const full = capacity > 0 ? Math.min(1, state.state.pop[cell]! / capacity) : 0;
  const favored = c.resource !== 0 && traits(race).favoredResources.includes(c.resource as ResourceKind);
  return full + state.state.development[cell]! + c.richness * (favored ? SIM.FAVORED_RESOURCE_VALUE : 1);
}
