// Step 4b (SPEC §4.12): nations form opinions of each other, and friends become allies.
import type { Rng } from "../core/rng";
import type { Nation, NationId, RaceId, SimEvent, WorldState } from "../core/types";
import { faithInfo } from "../gen/faiths";
import { RACE_ATTITUDES } from "../gen/params";
import { carryOut, done, refuse, type Controllers } from "./ai/controller";
import type { CommandOf, CommandResult } from "./commands";
import { allianceEndedEvent, allianceEvent } from "./events";
import { neighborPairs, pairKey } from "./helpers";
import { SIM } from "./params";

const clamp = (x: number) => Math.max(-1, Math.min(1, x));

/** How two races feel about each other, −1..1 (`RACE_ATTITUDES`, averaged both ways). */
export function raceAttitude(a: RaceId, b: RaceId): number {
  if (a === 0 || b === 0) return 0;
  // Table rows start at Human (race 1), so race r is row r − 1.
  return (RACE_ATTITUDES[a - 1]![b - 1]! + RACE_ATTITUDES[b - 1]![a - 1]!) / 2;
}

/** Opinion between two nations. Nations that have never met judge by race alone. */
export function opinion(state: WorldState, a: NationId, b: NationId): number {
  const stored = state.relations.get(pairKey(a, b));
  if (stored !== undefined) return stored;
  const na = state.nations.get(a);
  const nb = state.nations.get(b);
  return na && nb ? raceAttitude(na.race, nb.race) : 0;
}

export function allied(state: WorldState, a: NationId, b: NationId): boolean {
  return state.alliances.some((al) => pairKey(al.a, al.b) === pairKey(a, b));
}

/** A nation's living allies, in id order. */
export function alliesOf(state: WorldState, id: NationId): NationId[] {
  return state.alliances
    .filter((al) => al.a === id || al.b === id)
    .map((al) => (al.a === id ? al.b : al.a))
    .filter((other) => state.nations.get(other)?.alive)
    .sort((x, y) => x - y);
}

/** Who each nation is at war with right now. */
export function enemiesOf(state: WorldState): Map<NationId, Set<NationId>> {
  const enemies = new Map<NationId, Set<NationId>>();
  const add = (a: NationId, b: NationId) => {
    if (!enemies.has(a)) enemies.set(a, new Set());
    enemies.get(a)!.add(b);
  };
  for (const w of state.wars) {
    add(w.attacker, w.defender);
    add(w.defender, w.attacker);
  }
  return enemies;
}

/** Where the opinion between `a` and `b` is heading this year. */
export function opinionTarget(a: Nation, b: Nation, neighbors: boolean, enemies: Map<NationId, Set<NationId>>): number {
  let target = raceAttitude(a.race, b.race);
  if (neighbors) target -= SIM.BORDER_FRICTION;
  const fervor = (faithInfo(a.faith).fervor + faithInfo(b.faith).fervor) / 2;
  target += (a.faith === b.faith ? 1 : -1) * SIM.FAITH_OPINION * fervor;
  const ea = enemies.get(a.id);
  const eb = enemies.get(b.id);
  if (ea?.has(b.id)) target -= SIM.WAR_OPINION_PENALTY;
  else if (ea && eb && [...ea].some((e) => eb.has(e))) target += SIM.SHARED_ENEMY_BONUS;
  return clamp(target);
}

/**
 * Moves every opinion a step toward its target. Neighbors meeting for the
 * first time start right at their target; nations that died are forgotten.
 */
export function updateOpinions(state: WorldState, pairs: [NationId, NationId][]): void {
  const enemies = enemiesOf(state);
  const touching = new Set(pairs.map(([a, b]) => pairKey(a, b)));

  for (const [a, b] of pairs) {
    const key = pairKey(a, b);
    if (!state.relations.has(key)) {
      state.relations.set(key, opinionTarget(state.nations.get(a)!, state.nations.get(b)!, true, enemies));
    }
  }

  for (const [key, value] of [...state.relations]) {
    const a = state.nations.get(Math.floor(key / 100000));
    const b = state.nations.get(key % 100000);
    if (!a?.alive || !b?.alive) {
      state.relations.delete(key);
      continue;
    }
    const target = opinionTarget(a, b, touching.has(key), enemies);
    state.relations.set(key, value + (target - value) * SIM.OPINION_DRIFT);
  }
}

/** The "formAlliance" command: `a` and `b` pledge to fight beside each other. */
export function applyFormAlliance(state: WorldState, cmd: CommandOf<"formAlliance">): CommandResult {
  const a = state.nations.get(cmd.a);
  const b = state.nations.get(cmd.b);
  if (!a?.alive || !b?.alive || a === b) return refuse("there's no such pair of nations");
  if (allied(state, a.id, b.id)) return refuse("they're already allies");
  if (enemiesOf(state).get(a.id)?.has(b.id)) return refuse("they're at war with each other");
  if (alliesOf(state, a.id).length >= SIM.MAX_ALLIES || alliesOf(state, b.id).length >= SIM.MAX_ALLIES) return refuse("one of them has as many allies as it can keep");
  state.alliances.push({ a: Math.min(a.id, b.id), b: Math.max(a.id, b.id), since: state.year });
  return done([allianceEvent(state.year, a, b)]);
}

/** The "breakAlliance" command: `nation` leaves its alliance with `other`. */
export function applyBreakAlliance(state: WorldState, cmd: CommandOf<"breakAlliance">): CommandResult {
  const key = pairKey(cmd.nation, cmd.other);
  const index = state.alliances.findIndex((al) => pairKey(al.a, al.b) === key);
  if (index < 0) return refuse("they aren't allies");
  const al = state.alliances[index]!;
  state.alliances.splice(index, 1);
  return done([allianceEndedEvent(state.year, state.nations.get(al.a)!, state.nations.get(al.b)!)]);
}

/** Alliances lapse when a member dies, and break if either member wants out; then friendly neighbors may ally. */
export function updateAlliances(state: WorldState, pairs: [NationId, NationId][], rng: Rng, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];

  for (const al of [...state.alliances]) {
    const a = state.nations.get(al.a);
    const b = state.nations.get(al.b);
    if (!a?.alive || !b?.alive) {
      state.alliances.splice(state.alliances.indexOf(al), 1); // a member is gone: the alliance just lapses
      continue;
    }
    // Either member may leave; the first to say so breaks it.
    for (const [me, other] of [[a, b], [b, a]]) {
      const controller = controllers(me!.id);
      if (controller.keepAlliance(state, me!, other!)) continue;
      const cmd: CommandOf<"breakAlliance"> = { kind: "breakAlliance", nation: me!.id, other: other!.id };
      const result = applyBreakAlliance(state, cmd);
      if (carryOut(controller, cmd, result)) events.push(...result.events);
      break;
    }
  }

  const enemies = enemiesOf(state);
  const allyCount = (id: NationId) => alliesOf(state, id).length;
  for (const [a, b] of pairs) {
    if (allied(state, a, b) || enemies.get(a)?.has(b)) continue;
    if (allyCount(a) >= SIM.MAX_ALLIES || allyCount(b) >= SIM.MAX_ALLIES) continue;
    const na = state.nations.get(a)!;
    const nb = state.nations.get(b)!;
    const proposer = controllers(a);
    if (!proposer.proposeAlliance(state, na, nb, rng.fork(`alliance-${a}-${b}`)) || !controllers(b).acceptAlliance(state, nb, na)) continue;
    const cmd: CommandOf<"formAlliance"> = { kind: "formAlliance", a, b };
    const result = applyFormAlliance(state, cmd);
    if (carryOut(proposer, cmd, result)) events.push(...result.events);
  }
  return events;
}

export function diplomacy(state: WorldState, rng: Rng, controllers: Controllers): SimEvent[] {
  const pairs = neighborPairs(state);
  updateOpinions(state, pairs);
  return updateAlliances(state, pairs, rng, controllers);
}
