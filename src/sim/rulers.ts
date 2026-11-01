// Rulers (docs/systems/rulers.md): crowning them, and what a great one changes.
import type { Rng } from "../core/rng";
import type { CellId, RaceId, Ruler, WorldState } from "../core/types";
import { nameNationAt } from "../gen/nations";
import { dynastyName, makeRuler } from "../gen/rulers";

/**
 * Crowns a new ruler of `race` for a nation whose capital is `capital`.
 * Without a `dynasty` to carry on, a new one takes the throne.
 */
export function crown(state: WorldState, rng: Rng, race: RaceId, capital: CellId, dynasty?: string): Ruler {
  const [x, y] = state.cells[capital]!.site;
  const house = dynasty ?? dynastyName(race, nameNationAt(rng.fork("dynasty"), state.cultureHomes, new Set(), x, y, race));
  return makeRuler(rng, race, state.year, house);
}
