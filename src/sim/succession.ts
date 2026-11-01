// Step 7b (docs/systems/rulers.md): reigns end and the throne passes on.
import type { Rng } from "../core/rng";
import type { SimEvent, WorldState } from "../core/types";
import { livingNations } from "./helpers";
import { SIM } from "./params";
import { crown } from "./rulers";

export function succession(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  for (const nation of livingNations(state)) {
    if (nation.ruler.ends > state.year) continue;
    const nationRng = rng.fork(`nation-${nation.id}`);
    const heir = nationRng.chance(SIM.HEIR_CHANCE);
    nation.ruler = crown(state, nationRng.fork("crown"), nation.race, nation.capital, heir ? nation.ruler.dynasty : undefined);
  }
  return events;
}
