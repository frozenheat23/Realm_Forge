// Step 7b (docs/systems/rulers.md): reigns end, the throne passes on, and it can go badly.
import type { Rng } from "../core/rng";
import { RulerType, type Nation, type NationId, type SimEvent, type WorldState } from "../core/types";
import { clamp } from "../core/math";
import { traits } from "../gen/races";
import { opinion } from "./diplomacy";
import { civilWarEvent, crisisEvent, greatDiesEvent, greatRisesEvent } from "./events";
import { livingNations, neighborPairs } from "./helpers";
import { SIM } from "./params";
import { uprising } from "./rebellion";
import { crown, rollGreatness } from "./rulers";

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

/** Each Schemer works against its most hated neighbor. */
function schemes(state: WorldState): void {
  const schemers = livingNations(state).filter((n) => n.ruler.great === RulerType.Schemer);
  if (schemers.length === 0) return;
  const pairs = neighborPairs(state);
  for (const schemer of schemers) {
    let target: NationId | null = null;
    let worst = Infinity;
    for (const [a, b] of pairs) {
      if (a !== schemer.id && b !== schemer.id) continue;
      const other = a === schemer.id ? b : a;
      const feeling = opinion(state, schemer.id, other);
      if (feeling < worst || (feeling === worst && other < target!)) [target, worst] = [other, feeling];
    }
    if (target === null) continue;
    const victim = state.nations.get(target)!;
    victim.stability = Math.max(0, victim.stability - SIM.GREAT_SCHEMER_STAB);
  }
}

export function succession(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  schemes(state);
  for (const nation of livingNations(state)) {
    if (nation.ruler.ends > state.year) continue;
    const nationRng = rng.fork(`nation-${nation.id}`);
    const heir = nationRng.chance(SIM.HEIR_CHANCE);
    const old = nation.ruler;
    const wasGreat = old.great !== undefined;
    if (wasGreat) events.push(greatDiesEvent(state.year, nation, old));
    if (!heir) nation.stability = Math.max(0, nation.stability - SIM.DYNASTY_STAB_HIT);
    nation.ruler = crown(state, nationRng.fork("crown"), nation.race, nation.capital, heir ? old.dynasty : undefined);
    rollGreatness(nation.ruler, nation, nationRng.fork("great"));
    if (nation.ruler.great !== undefined) events.push(greatRisesEvent(state.year, nation));
    if (nationRng.chance(crisisChance(nation, wasGreat))) events.push(...crisis(state, nation, nationRng.fork("crisis")));
  }
  return events;
}
