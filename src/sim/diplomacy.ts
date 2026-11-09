// Step 4b (SPEC §4.12): nations form opinions of each other, and friends become allies.
import type { Rng } from "../core/rng";
import type { Nation, NationId, RaceId, SimEvent, WorldState } from "../core/types";
import { faithInfo } from "../gen/faiths";
import { RACE_ATTITUDES } from "../gen/params";
import { carryOut, done, refuse, type Controllers } from "./ai/controller";
import type { CommandOf, CommandResult } from "./commands";
import { allianceEndedEvent, allianceEvent, allianceLapsesEvent, newRulerBreaksEvent } from "./events";
import { neighborPairs, pairKey } from "./helpers";
import { SIM } from "./params";
import { crownPartners, overlordOf, sameCrown } from "./vassals";

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

/**
 * Who stands with `id` in war (docs/systems/vassalage.md): its allies, plus its overlord
 * and vassals, unless they're at war with it. In id order.
 */
export function friendsOf(state: WorldState, id: NationId): NationId[] {
  const allies = alliesOf(state, id);
  const crown = crownPartners(state, id).filter((other) => !fighting(state, id, other));
  if (crown.length === 0) return allies;
  return [...new Set([...allies, ...crown])].sort((x, y) => x - y);
}

/** Are `a` and `b` at war with each other? (Asked often, so no lookup tables are built.) */
function fighting(state: WorldState, a: NationId, b: NationId): boolean {
  const key = pairKey(a, b);
  return state.wars.some((w) => pairKey(w.attacker, w.defender) === key);
}

/** Do `a` and `b` count each other's land as friendly: allies, or under one crown and not at war? */
export function friendly(state: WorldState, a: NationId, b: NationId): boolean {
  if (allied(state, a, b)) return true;
  return sameCrown(state, a, b) && !fighting(state, a, b);
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

/** Why `a` and `b` can't become allies, or null if they can. */
export function allianceRefusal(state: WorldState, a: NationId, b: NationId): string | null {
  const na = state.nations.get(a);
  const nb = state.nations.get(b);
  if (!na?.alive || !nb?.alive || na === nb) return "there's no such pair of nations";
  if (allied(state, a, b)) return "they're already allies";
  if (overlordOf(state, a) || overlordOf(state, b)) return "a vassal makes no alliances of its own";
  if (enemiesOf(state).get(a)?.has(b)) return "they're at war with each other";
  if (alliesOf(state, a).length >= SIM.MAX_ALLIES || alliesOf(state, b).length >= SIM.MAX_ALLIES) return "one of them has as many allies as it can keep";
  return null;
}

/** The "formAlliance" command: `a` and `b` pledge to fight beside each other. */
export function applyFormAlliance(state: WorldState, cmd: CommandOf<"formAlliance">): CommandResult {
  const why = allianceRefusal(state, cmd.a, cmd.b);
  if (why !== null) return refuse(why);
  const a = state.nations.get(cmd.a)!;
  const b = state.nations.get(cmd.b)!;
  state.alliances.push({ a: Math.min(a.id, b.id), b: Math.max(a.id, b.id), since: state.year, renewed: state.year });
  return done([allianceEvent(state.year, a, b)]);
}

/** The "breakAlliance" command: `nation` leaves its alliance with `other`. */
export function applyBreakAlliance(state: WorldState, cmd: CommandOf<"breakAlliance">): CommandResult {
  const key = pairKey(cmd.nation, cmd.other);
  const index = state.alliances.findIndex((al) => pairKey(al.a, al.b) === key);
  if (index < 0) return refuse("they aren't allies");
  const al = state.alliances[index]!;
  state.alliances.splice(index, 1);
  const leaver = state.nations.get(cmd.nation)!;
  const other = state.nations.get(cmd.other)!;
  const feeling = opinion(state, leaver.id, other.id);
  // A broken pact leaves a coolness behind, so the pair doesn't simply swear a new one next year.
  state.relations.set(key, Math.min(feeling, SIM.PACT_BROKEN_OPINION));
  // Tell why, from what was true when it broke: a new ruler, a pact gone unused while still friends, or friendship gone sour.
  if (leaver.ruler.crowned === state.year - 1) return done([newRulerBreaksEvent(state.year, leaver, other)]);
  if (feeling >= SIM.ALLIANCE_BREAK_OPINION) return done([allianceLapsesEvent(state.year, leaver, other, state.year - al.renewed)]);
  return done([allianceEndedEvent(state.year, state.nations.get(al.a)!, state.nations.get(al.b)!)]);
}

/** Alliances lapse when a member dies, and break if either member wants out; then friendly neighbors may ally. */
export function updateAlliances(state: WorldState, pairs: [NationId, NationId][], rng: Rng, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];
  const enemies = enemiesOf(state);

  for (const al of [...state.alliances]) {
    const a = state.nations.get(al.a);
    const b = state.nations.get(al.b);
    if (!a?.alive || !b?.alive) {
      state.alliances.splice(state.alliances.indexOf(al), 1); // a member is gone: the alliance just lapses
      continue;
    }
    // Fighting a shared enemy renews the pact.
    const enemiesA = enemies.get(a.id);
    const enemiesB = enemies.get(b.id);
    if (enemiesA && enemiesB && [...enemiesA].some((e) => enemiesB.has(e))) al.renewed = state.year;
    // Either member may leave; the first to say so breaks it.
    for (const [me, other] of [[a, b], [b, a]]) {
      const controller = controllers(me!.id);
      if (controller.keepAlliance(state, me!, other!, state.year - al.renewed, rng.fork(`keep-${me!.id}-${other!.id}`))) continue;
      const cmd: CommandOf<"breakAlliance"> = { kind: "breakAlliance", nation: me!.id, other: other!.id };
      const result = applyBreakAlliance(state, cmd);
      if (carryOut(controller, cmd, result)) events.push(...result.events);
      break;
    }
  }

  const allyCount = (id: NationId) => alliesOf(state, id).length;
  for (const [a, b] of pairs) {
    if (allied(state, a, b) || enemies.get(a)?.has(b) || overlordOf(state, a) || overlordOf(state, b)) continue;
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
