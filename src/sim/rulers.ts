// Rulers (docs/systems/rulers.md): crowning them, and what a great one changes.
import type { Rng } from "../core/rng";
import { RulerType, type CellId, type Nation, type RaceId, type Ruler, type RulerTypeId, type WorldState } from "../core/types";
import { nameNationAt } from "../gen/nations";
import { traits } from "../gen/races";
import { dynastyName, makeRuler } from "../gen/rulers";
import { SIM } from "./params";

const TYPES = Object.values(RulerType);

/**
 * Crowns a new ruler of `race` for a nation whose capital is `capital`.
 * Without a `dynasty` to carry on, a new one takes the throne.
 */
export function crown(state: WorldState, rng: Rng, race: RaceId, capital: CellId, dynasty?: string): Ruler {
  const [x, y] = state.cells[capital]!.site;
  const house = dynasty ?? dynastyName(race, nameNationAt(rng.fork("dynasty"), state.cultureHomes, new Set(), x, y, race));
  return makeRuler(rng, race, state.year, house);
}

/** × some rule for a nation under a great ruler of `type`; other nations get 1 (no change). */
export function greatBonus(nation: Nation, type: RulerTypeId, bonus: number): number {
  return nation.ruler.great === type ? bonus : 1;
}

/** Sees if this new ruler is great: picks a type evenly, then the race's odds for that type decide. */
export function rollGreatness(ruler: Ruler, race: RaceId, rng: Rng): void {
  const type = rng.pick(TYPES);
  if (rng.chance(SIM.GREAT_RULER_CHANCE * traits(race).greatOdds[type])) ruler.great = type;
}
