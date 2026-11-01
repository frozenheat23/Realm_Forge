// Step 7b (docs/systems/rulers.md): reigns end, the throne passes on, and it can go badly.
import type { Rng } from "../core/rng";
import type { Nation, SimEvent, WorldState } from "../core/types";
import { clamp } from "../core/math";
import { traits } from "../gen/races";
import { civilWarEvent, crisisEvent } from "./events";
import { livingNations } from "./helpers";
import { SIM } from "./params";
import { uprising } from "./rebellion";
import { crown } from "./rulers";

/** Chance a handover of power turns into a crisis: bigger realms are harder to pass on. */
export function crisisChance(nation: Nation, wasGreat: boolean): number {
  return SIM.CRISIS_BASE * traits(nation.race).succession * (1 + nation.area / SIM.CRISIS_AREA) * (wasGreat ? SIM.CRISIS_GREAT : 1);
}

/** Pretenders rise, each taking a piece of the realm. Returns what happened. */
function civilWar(state: WorldState, nation: Nation, rng: Rng): SimEvent[] {
  const events = [civilWarEvent(state.year, nation)];
  const owner = state.state.owner;
  let cells: number[] = [];
  for (let c = 0; c < owner.length; c++) if (owner[c] === nation.id) cells.push(c);

  const pretenders = clamp(Math.floor(cells.length / SIM.CIVIL_WAR_CELLS_PER_SPLIT), 1, SIM.CIVIL_WAR_MAX_SPLITS);
  const mostCells = Math.floor(cells.length * SIM.CIVIL_WAR_SHARE);
  for (let i = 0; i < pretenders; i++) {
    const happened = uprising(state, nation, cells, rng.fork(`pretender-${i}`), mostCells);
    if (!happened) break;
    events.push(...happened);
    cells = cells.filter((c) => owner[c] === nation.id);
  }
  return events;
}

/** The crown has passed badly: the realm shakes, and a large one breaks. */
function crisis(state: WorldState, nation: Nation, rng: Rng): SimEvent[] {
  nation.stability = Math.max(0, nation.stability - SIM.CRISIS_STAB_HIT);
  if (nation.area < SIM.CIVIL_WAR_MIN_AREA) return [crisisEvent(state.year, nation)];
  return civilWar(state, nation, rng);
}

export function succession(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  for (const nation of livingNations(state)) {
    if (nation.ruler.ends > state.year) continue;
    const nationRng = rng.fork(`nation-${nation.id}`);
    const heir = nationRng.chance(SIM.HEIR_CHANCE);
    const wasGreat = nation.ruler.great !== undefined;
    if (!heir) nation.stability = Math.max(0, nation.stability - SIM.DYNASTY_STAB_HIT);
    nation.ruler = crown(state, nationRng.fork("crown"), nation.race, nation.capital, heir ? nation.ruler.dynasty : undefined);
    if (nationRng.chance(crisisChance(nation, wasGreat))) events.push(...crisis(state, nation, nationRng.fork("crisis")));
  }
  return events;
}
