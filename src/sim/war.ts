// Steps 5 and 6b (SPEC §4.5): neighbors go to war (allies may join), and wars end in peace and a truce.
import type { Rng } from "../core/rng";
import type { CellId, Nation, NationId, ResourceKind, SimEvent, War, WarGoal, WorldState } from "../core/types";
import { RESOURCES } from "../gen/params";
import { traits } from "../gen/races";
import { carryOut, done, refuse, type Controllers, type WarContext } from "./ai/controller";
import type { CommandOf, CommandResult } from "./commands";
import { allied, alliesOf, opinion } from "./diplomacy";
import { conquestEvent, joinAttackEvent, joinDefenseEvent, peaceEvent, raidEvent, warEvent } from "./events";
import { frontCells, neighborPairs, pairKey } from "./helpers";
import { fightingPower } from "./manpower";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses } from "./resources";
import { occupationCounts, occupationScore } from "./siege";
import { claimedCells, claimYears, conquestCells, goalAchieved, payTribute, takeLand } from "./warGoals";

// They used to live here; other files still import them from war.ts.
export { frontCells, neighborPairs, pairKey };

function inTruce(state: WorldState, a: NationId, b: NationId): boolean {
  return state.truces.some((t) => pairKey(t.a, t.b) === pairKey(a, b) && t.until > state.year);
}

/** Key for "from → to": unlike pairKey, the order matters. */
function directedKey(from: NationId, to: NationId): number {
  return from * 100000 + to;
}

/**
 * Who has a claim on whom: directedKey(claimant, holder) for every nation
 * holding a cell the claimant lost to it within its `claimYears`.
 */
export function claims(state: WorldState): Set<number> {
  const { owner, prevOwner, ownedSince } = state.state;
  const found = new Set<number>();
  for (let c = 0; c < owner.length; c++) {
    const claimant = state.nations.get(prevOwner[c]!);
    if (!claimant?.alive || owner[c] === 0 || state.year - ownedSince[c]! > claimYears(claimant)) continue;
    found.add(directedKey(claimant.id, owner[c]!));
  }
  return found;
}

/**
 * For each directedKey(attacker, defender): the defender's most valuable cell on
 * their shared border, as the attacker's race sees it. What a war would be fought for.
 */
export function borderPrizes(state: WorldState): Map<number, { cell: CellId; value: number }> {
  const owner = state.state.owner;
  const grain = grainBonuses(state);
  const best = new Map<number, { cell: CellId; value: number }>();
  for (const cell of state.cells) {
    const holder = owner[cell.id]!;
    if (holder === 0) continue;
    let capacity = -1; // worked out only if this cell is on a border
    for (const n of cell.neighbors) {
      const rival = owner[n]!;
      if (rival === 0 || rival === holder) continue;
      if (capacity < 0) capacity = effectiveCapacity(state, cell.id, grain);
      const value = cellValue(state, cell.id, state.nations.get(rival)!.race, capacity);
      const key = directedKey(rival, holder);
      const current = best.get(key);
      if (!current || value > current.value || (value === current.value && cell.id < current.cell)) {
        best.set(key, { cell: cell.id, value });
      }
    }
  }
  return best;
}

/** Why `attacker` goes to war, for the event text: its goal, and the deposit or city it's after. */
function warMotive(state: WorldState, attacker: Nation, goal: WarGoal, goalCells: CellId[], prize?: CellId): string | undefined {
  if (goal === "reclaim") return " to reclaim its lost lands";
  if (goal === "raid") return " to raid its lands";
  const deposit = prize === undefined ? 0 : state.cells[prize]!.resource;
  if (deposit !== 0 && traits(attacker.race).favoredResources.includes(deposit as ResourceKind)) {
    return `, coveting its ${RESOURCES[deposit as ResourceKind].name}`;
  }
  const city = goalCells.find((c) => state.cityNames.has(c));
  return city === undefined ? undefined : ` to seize the lands around ${state.cityNames.get(city)}`;
}

/** Starts a war. Going to war leaves a grudge that takes decades to fade. */
export function startWar(state: WorldState, attacker: Nation, defender: Nation, goal: WarGoal, goalCells: CellId[], joined?: number): War {
  const war: War = { id: state.nextWarId++, attacker: attacker.id, defender: defender.id, startYear: state.year, score: 0, battleScore: 0, goal, goalCells };
  if (joined !== undefined) war.joined = joined;
  state.wars.push(war);
  state.relations.set(pairKey(attacker.id, defender.id), Math.max(-1, opinion(state, attacker.id, defender.id) - SIM.WAR_OPINION_HIT));
  return war;
}

/** How many wars the nation is in right now. */
export function warsOf(state: WorldState, id: NationId): number {
  return state.wars.filter((w) => w.attacker === id || w.defender === id).length;
}

function atWar(state: WorldState, a: NationId, b: NationId): boolean {
  return state.wars.some((w) => pairKey(w.attacker, w.defender) === pairKey(a, b));
}

/** Yearly facts the war choices need, worked out once per year (they scan the whole map). */
export interface WarLookups {
  claims: Set<number>;
  prizes: Map<number, { cell: CellId; value: number }>;
  /** Pair keys of nations whose land touches. */
  touching: Set<number>;
}

export function warLookups(state: WorldState): WarLookups {
  return { claims: claims(state), prizes: borderPrizes(state), touching: new Set(neighborPairs(state).map(([a, b]) => pairKey(a, b))) };
}

/** Free to start a war with `enemy`: not already fighting it, no truce, and not at the war limit. */
function free(state: WorldState, id: NationId, enemy: NationId): boolean {
  return !atWar(state, id, enemy) && !inTruce(state, id, enemy) && warsOf(state, id) < SIM.MAX_WARS_PER_NATION;
}

/** Allies of `friend` that could fight `enemy`: they border it or `friend`, aren't also its allies, and are free. */
function helpers(state: WorldState, lookups: WarLookups, friend: NationId, enemy: NationId): Nation[] {
  return alliesOf(state, friend)
    .filter((id) => id !== enemy && (lookups.touching.has(pairKey(id, enemy)) || lookups.touching.has(pairKey(id, friend))) && !allied(state, id, enemy) && free(state, id, enemy))
    .map((id) => state.nations.get(id)!);
}

/** The "declareWar" command: the rules check it's allowed, work out the goal cells, and start the war. */
export function applyDeclareWar(state: WorldState, cmd: CommandOf<"declareWar">, lookups = warLookups(state)): CommandResult {
  const me = state.nations.get(cmd.nation);
  const them = state.nations.get(cmd.target);
  if (!me?.alive || !them?.alive || me === them) return refuse("there's no such pair of nations");
  if (!lookups.touching.has(pairKey(me.id, them.id))) return refuse("they don't share a border");
  if (atWar(state, me.id, them.id)) return refuse("they're already at war");
  if (allied(state, me.id, them.id)) return refuse("they're allies");
  if (inTruce(state, me.id, them.id)) return refuse("there's a truce between them");
  if (warsOf(state, me.id) >= SIM.MAX_WARS_PER_NATION || warsOf(state, them.id) >= SIM.MAX_WARS_PER_NATION) return refuse("one of them has too many wars");

  const prize = lookups.prizes.get(directedKey(me.id, them.id));
  let goalCells: CellId[];
  if (cmd.goal === "reclaim") {
    if (!lookups.claims.has(directedKey(me.id, them.id))) return refuse("there's no claim to reclaim");
    goalCells = claimedCells(state, me, them);
  } else if (cmd.goal === "conquer") {
    if (!prize) return refuse("there's nothing to conquer");
    goalCells = conquestCells(state, me, them, prize.cell);
  } else if (cmd.goal === "raid") {
    goalCells = [];
  } else {
    return refuse("a war can't be declared with that goal");
  }
  const war = startWar(state, me, them, cmd.goal, goalCells);
  return done([warEvent(state.year, me, them, warMotive(state, me, cmd.goal, goalCells, prize?.cell))], war);
}

/** The "joinWar" command: an ally of one side joins the war, with its own `support` war against the other side. */
export function applyJoinWar(state: WorldState, cmd: CommandOf<"joinWar">, lookups = warLookups(state)): CommandResult {
  const me = state.nations.get(cmd.nation);
  const main = state.wars.find((w) => w.id === cmd.war && w.joined === undefined);
  if (!me?.alive || !main) return refuse("there's no such war to join");
  const friend = state.nations.get(cmd.side === "defend" ? main.defender : main.attacker)!;
  const enemy = state.nations.get(cmd.side === "defend" ? main.attacker : main.defender)!;
  if (me === friend || me === enemy) return refuse("it's already in that war");
  if (!helpers(state, lookups, friend.id, enemy.id).includes(me)) return refuse("it isn't an ally that can reach the war, or it's busy");
  if (cmd.side === "defend") {
    startWar(state, enemy, me, "support", [], main.id);
    return done([joinDefenseEvent(state.year, me, friend, enemy)]);
  }
  startWar(state, me, enemy, "support", [], main.id);
  return done([joinAttackEvent(state.year, me, friend, enemy)]);
}

/** One ally asked to join a war: who, on which side, and the two sides from its point of view. */
interface Call {
  ally: Nation;
  side: "attack" | "defend";
  friend: Nation;
  enemy: Nation;
}

/**
 * Step 5: each pair of neighbors that could fight is asked, the stronger first, whether
 * to go to war; then the allies of both sides whether to join in.
 */
export function declareWars(state: WorldState, rng: Rng, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];
  const lookups = warLookups(state);
  const busy = (id: NationId) => warsOf(state, id) >= SIM.MAX_WARS_PER_NATION;

  for (const [a, b] of neighborPairs(state)) {
    if (atWar(state, a, b) || allied(state, a, b) || inTruce(state, a, b) || busy(a) || busy(b)) continue;
    const na = state.nations.get(a)!;
    const nb = state.nations.get(b)!;
    // Either side may go to war. The one with more fighting power is asked first.
    const [strong, weak] = fightingPower(state, na) >= fightingPower(state, nb) ? [na, nb] : [nb, na];
    for (const [me, them] of [[strong, weak], [weak, strong]] as const) {
      const why: WarContext = {
        claim: lookups.claims.has(directedKey(me.id, them.id)),
        prize: lookups.prizes.get(directedKey(me.id, them.id)),
        myHelpers: helpers(state, lookups, me.id, them.id),
        theirHelpers: helpers(state, lookups, them.id, me.id),
      };
      const controller = controllers(me.id);
      // Each choice rolls its own dice, so one nation's choice can't shift another's.
      const goal = controller.declareWar(state, me, them, why, rng.fork(`war-${me.id}-${them.id}`));
      if (goal === null) continue;
      const cmd: CommandOf<"declareWar"> = { kind: "declareWar", nation: me.id, target: them.id, goal };
      const result = applyDeclareWar(state, cmd, lookups);
      if (!carryOut(controller, cmd, result)) break;
      events.push(...result.events);
      // Each ally that can still reach the war is asked to join: the defender's first.
      const calls: Call[] = [
        ...why.theirHelpers.map((ally): Call => ({ ally, side: "defend", friend: them, enemy: me })),
        ...why.myHelpers.map((ally): Call => ({ ally, side: "attack", friend: me, enemy: them })),
      ];
      for (const { ally, side, friend, enemy } of calls) {
        if (!free(state, ally.id, enemy.id)) continue;
        const allyController = controllers(ally.id);
        if (!allyController.joinWar(state, ally, friend, enemy, side, rng.fork(`join-${ally.id}-${friend.id}-${enemy.id}`))) continue;
        const join: CommandOf<"joinWar"> = { kind: "joinWar", nation: ally.id, war: result.war!.id, side };
        const joined = applyJoinWar(state, join, lookups);
        if (carryOut(allyController, join, joined)) events.push(...joined.events);
      }
      break;
    }
  }
  return events;
}

/** Why a war should end now, or null if it goes on. "goal" and "decisive" are asked of the winner; the rest are forced. */
function peaceReason(state: WorldState, war: War, attacker: Nation, defender: Nation): string | null {
  if (goalAchieved(state, war)) return "goal";
  if (Math.abs(war.score) >= SIM.PEACE_SCORE) return "decisive";
  if (attacker.warWeariness >= SIM.WEARINESS_PEACE || defender.warWeariness >= SIM.WEARINESS_PEACE) return "exhausted";
  if (state.year - war.startYear >= SIM.MAX_WAR_YEARS) return "too long";
  return null;
}

/** The clear winner of a war, if the score is at least SIM.WIN_SCORE. */
function clearWinner(war: War, attacker: Nation, defender: Nation): Nation | null {
  if (Math.abs(war.score) < SIM.WIN_SCORE) return null;
  return war.score > 0 ? attacker : defender;
}

/** Does the war end now? Forced endings always do; a won war ends if the winner agrees. */
function endsNow(state: WorldState, war: War, attacker: Nation, defender: Nation, reason: string | null, controllers: Controllers): boolean {
  if (reason !== "goal" && reason !== "decisive") return reason !== null;
  const winner = reason === "goal" || war.score > 0 ? attacker : defender;
  return controllers(winner.id).acceptPeace(state, winner, war, reason);
}

/** Step 6b: war scores are brought up to date, and wars that are over end in peace. */
export function endWars(state: WorldState, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];
  const ongoing: War[] = [];
  // Wars still going after this year. A joined war always comes after its main war in the list.
  const ongoingIds = new Set<number>();
  const counts = occupationCounts(state);

  for (const war of state.wars) {
    const attacker = state.nations.get(war.attacker);
    const defender = state.nations.get(war.defender);
    // A side has died (conquered or collapsed): the war simply ends.
    if (!attacker?.alive || !defender?.alive) continue;
    war.score = war.battleScore + occupationScore(state, war, counts);
    const mainOver = war.joined !== undefined && !ongoingIds.has(war.joined);

    const reason = peaceReason(state, war, attacker, defender);
    if (!mainOver && !endsNow(state, war, attacker, defender, reason, controllers)) {
      ongoing.push(war);
      ongoingIds.add(war.id);
      continue;
    }
    const winner = reason === "goal" ? attacker : clearWinner(war, attacker, defender);
    const loser = winner === attacker ? defender : attacker;
    const raided = winner === attacker && war.goal === "raid";
    if (raided) payTribute(attacker, defender);
    const taken = winner && !raided ? takeLand(state, war, winner, loser) : [];
    state.truces.push({ a: attacker.id, b: defender.id, until: state.year + SIM.TRUCE_YEARS });
    if (mainOver) continue; // allies go home quietly when the war they joined is over
    if (raided) {
      events.push(raidEvent(state.year, attacker, defender));
      continue;
    }
    // Name a deposit the winner took, if any.
    const prize = taken.find((c) => state.cells[c]!.resource !== 0);
    const prizeName = prize !== undefined ? RESOURCES[state.cells[prize]!.resource as ResourceKind].name : undefined;
    events.push(!loser.alive ? conquestEvent(state.year, winner!, loser, taken.length) : peaceEvent(state.year, attacker, defender, winner, taken.length, prizeName));
  }

  state.wars = ongoing;
  state.truces = state.truces.filter((t) => t.until > state.year);
  return events;
}
