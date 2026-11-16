// Step 7c (docs/systems/vassalage.md): vassals of a fallen overlord go free, and vassals
// whose overlord is weak may declare independence (docs/systems/empire-cycle.md, Part 1).
import type { Rng } from "../core/rng";
import type { Nation, SimEvent, WeakMoment, WorldState } from "../core/types";
import { carryOut, done, refuse, type Controllers } from "./ai/controller";
import type { CommandOf, CommandResult } from "./commands";
import { goesFreeEvent, independenceEvent } from "./events";
import { livingNations, pairKey } from "./helpers";
import { SIM } from "./params";
import { overlordOf, setFree } from "./vassals";
import { callAllies, helpers, startWar, warLookups, type WarLookups } from "./war";

/**
 * The moment of weakness `overlord` offers `vassal` this year, or null if it stands firm:
 * a new ruler, a war lost in the last SIM.HUMBLED_YEARS, stability below SIM.WEAK_STABILITY,
 * or a war of its own with someone else (another vassal's rising counts).
 */
export function weakMoment(state: WorldState, overlord: Nation, vassal: Nation): WeakMoment | null {
  if (overlord.ruler.crowned === state.year) return "crowned";
  if (overlord.humbled !== undefined && state.year - overlord.humbled < SIM.HUMBLED_YEARS) return "defeated";
  if (overlord.stability < SIM.WEAK_STABILITY) return "unstable";
  const busy = state.wars.some((w) => w.joined === undefined && (w.attacker === overlord.id || w.defender === overlord.id) && w.attacker !== vassal.id);
  return busy ? "atWar" : null;
}

/** "Krakhar has a new ruler", for the Play tab and dispatches. */
export function momentText(overlord: Nation, moment: WeakMoment): string {
  const why = { crowned: "has a new ruler", defeated: "has just lost a war", unstable: "is unstable", atWar: "is at war elsewhere" }[moment];
  return `${overlord.name} ${why}`;
}

/** Why `vassal` can't declare independence now, or null if it can. Changes nothing, so the Play tab can ask too. */
export function independenceRefusal(state: WorldState, vassal: Nation | undefined): string | null {
  if (!vassal?.alive) return "there's no such nation";
  const overlord = overlordOf(state, vassal.id);
  if (!overlord) return "it serves no overlord";
  if (state.wars.some((w) => pairKey(w.attacker, w.defender) === pairKey(vassal.id, overlord.id))) return "it's already at war with its overlord";
  if (state.truces.some((t) => t.until > state.year && pairKey(t.a, t.b) === pairKey(vassal.id, overlord.id))) return "a truce still binds it after its last rising";
  if (weakMoment(state, overlord, vassal) === null) return `only while ${overlord.name} is weak: a new ruler, a lost war, low stability or a war elsewhere`;
  return null;
}

/**
 * The "declareIndependence" command. A vassal that borders its overlord goes to war for its
 * freedom, and the overlord's allies are asked to help it (fellow vassals stay out);
 * one that no longer borders it is too far to hold, and goes free at once.
 */
export function applyDeclareIndependence(state: WorldState, cmd: CommandOf<"declareIndependence">, rng: Rng, controllers: Controllers, lookups: WarLookups = warLookups(state)): CommandResult {
  const vassal = state.nations.get(cmd.nation);
  const why = independenceRefusal(state, vassal);
  if (why !== null) return refuse(why);
  const overlord = overlordOf(state, vassal!.id)!;
  if (!lookups.touching.has(pairKey(vassal!.id, overlord.id))) {
    setFree(vassal!);
    return done([goesFreeEvent(state.year, vassal!, overlord, "too far")]);
  }
  const theirHelpers = helpers(state, lookups, overlord.id, vassal!.id);
  const war = startWar(state, vassal!, overlord, "independence", []);
  return done([independenceEvent(state.year, vassal!, overlord), ...callAllies(state, lookups, war, [], theirHelpers, rng, controllers)], war);
}

export function independence(state: WorldState, rng: Rng, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];
  // A vassal whose overlord has fallen serves no one.
  for (const nation of livingNations(state)) {
    if (nation.overlord === undefined || overlordOf(state, nation.id)) continue;
    const fallen = state.nations.get(nation.overlord);
    setFree(nation);
    if (fallen) events.push(goesFreeEvent(state.year, nation, fallen, "fell"));
  }
  // An overlord in a moment of weakness: each vassal decides whether to keep bowing.
  let lookups: WarLookups | null = null;
  for (const vassal of livingNations(state)) {
    const overlord = overlordOf(state, vassal.id);
    if (!overlord || independenceRefusal(state, vassal) !== null) continue;
    const controller = controllers(vassal.id);
    const moment = weakMoment(state, overlord, vassal)!;
    if (!controller.declareIndependence(state, vassal, overlord, moment, rng.fork(`independence-${vassal.id}`))) continue;
    lookups ??= warLookups(state);
    const cmd: CommandOf<"declareIndependence"> = { kind: "declareIndependence", nation: vassal.id };
    const result = applyDeclareIndependence(state, cmd, rng.fork(`allies-${vassal.id}`), controllers, lookups);
    if (carryOut(controller, cmd, result)) events.push(...result.events);
  }
  return events;
}
