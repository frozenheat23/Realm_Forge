// Steps 5 and 6b (SPEC §4.5): neighbors go to war (allies may join), and wars end in peace and a truce.
import { createRng, type Rng } from "../core/rng";
import type { CellId, Nation, NationId, ResourceKind, SimEvent, Subjugation, War, WarGoal, WarOutcome, WorldState } from "../core/types";
import { RESOURCES } from "../gen/params";
import { traits } from "../gen/races";
import { carryOut, done, refuse, type Controllers, type WarContext } from "./ai/controller";
import type { CommandOf, CommandResult } from "./commands";
import { allied, friendsOf, opinion } from "./diplomacy";
import { conquestEvent, goesFreeEvent, joinAttackEvent, joinDefenseEvent, keptEvent, peaceEvent, raidEvent, submitEvent, suedEvent, warEvent } from "./events";
import { frontCells, neighborPairs, pairKey } from "./helpers";
import { fightingPower } from "./manpower";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses } from "./resources";
import { occupationCounts, occupationScore, occupiedBy } from "./siege";
import { crownPartners, overlordOf, sameCrown, setFree } from "./vassals";
import { closeRecord, openRecord, recordScore } from "./warRecords";
import { claimedCells, claimYears, conquestCells, goalAchieved, goalsHeld, holdsCapital, payTribute, takeLand } from "./warGoals";

// They used to live here; other files still import them from war.ts.
export { frontCells, neighborPairs, pairKey };

function inTruce(state: WorldState, a: NationId, b: NationId): boolean {
  return state.truces.some((t) => pairKey(t.a, t.b) === pairKey(a, b) && t.until > state.year);
}

/** Key for "from → to": unlike pairKey, the order matters. */
export function directedKey(from: NationId, to: NationId): number {
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
  openRecord(state, war);
  state.relations.set(pairKey(attacker.id, defender.id), Math.max(-1, opinion(state, attacker.id, defender.id) - SIM.WAR_OPINION_HIT));
  return war;
}

/** How many wars the nation is in right now. */
export function warsOf(state: WorldState, id: NationId): number {
  return state.wars.filter((w) => w.attacker === id || w.defender === id).length;
}

export function atWar(state: WorldState, a: NationId, b: NationId): boolean {
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

/**
 * Allies (and overlord or vassals) of `friend` that could fight `enemy`: they border it or `friend`,
 * aren't also its allies or under its crown, and are free.
 */
export function helpers(state: WorldState, lookups: WarLookups, friend: NationId, enemy: NationId): Nation[] {
  return friendsOf(state, friend)
    .filter((id) => id !== enemy && (lookups.touching.has(pairKey(id, enemy)) || lookups.touching.has(pairKey(id, friend))) && !allied(state, id, enemy) && !sameCrown(state, id, enemy) && free(state, id, enemy))
    .map((id) => state.nations.get(id)!);
}

/** The "declareWar" command: the rules check it's allowed, work out the goal cells, and start the war. */
/**
 * Why the "declareWar" command `cmd` isn't allowed, or null if it is. Changes nothing, so the
 * screen can ask it too (the player's war buttons). `ignoreLimit` lets the gods break the war limit.
 */
export function declareWarRefusal(state: WorldState, cmd: CommandOf<"declareWar">, lookups = warLookups(state), ignoreLimit = false): string | null {
  const me = state.nations.get(cmd.nation);
  const them = state.nations.get(cmd.target);
  if (!me?.alive || !them?.alive || me === them) return "there's no such pair of nations";
  if (!lookups.touching.has(pairKey(me.id, them.id))) return "they don't share a border";
  if (atWar(state, me.id, them.id)) return "they're already at war";
  if (allied(state, me.id, them.id)) return "they're allies";
  if (sameCrown(state, me.id, them.id)) return "they serve one crown";
  if (overlordOf(state, me.id)) return "a vassal can't start wars of its own";
  if (inTruce(state, me.id, them.id)) return "there's a truce between them";
  const tooMany = warsOf(state, me.id) >= SIM.MAX_WARS_PER_NATION || warsOf(state, them.id) >= SIM.MAX_WARS_PER_NATION;
  if (tooMany && !ignoreLimit) return "one of them has too many wars";
  if (cmd.goal === "reclaim" && !lookups.claims.has(directedKey(me.id, them.id))) return "there's no claim to reclaim";
  if (cmd.goal === "conquer" && !lookups.prizes.has(directedKey(me.id, them.id))) return "there's nothing to conquer";
  if (cmd.goal === "support") return "a war can't be declared with that goal";
  return null;
}

export function applyDeclareWar(state: WorldState, cmd: CommandOf<"declareWar">, lookups = warLookups(state), ignoreLimit = false): CommandResult {
  const why = declareWarRefusal(state, cmd, lookups, ignoreLimit);
  if (why !== null) return refuse(why);
  const me = state.nations.get(cmd.nation)!;
  const them = state.nations.get(cmd.target)!;
  const prize = lookups.prizes.get(directedKey(me.id, them.id));
  const goalCells: CellId[] =
    cmd.goal === "reclaim" ? claimedCells(state, me, them)
    : cmd.goal === "conquer" ? conquestCells(state, me, them, prize!.cell)
    : [];
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
/**
 * Each ally that can still reach a new war is asked to join: the defender's first.
 * `myHelpers` and `theirHelpers` are the attacker's and defender's, worked out before the war began.
 */
export function callAllies(state: WorldState, lookups: WarLookups, war: War, myHelpers: Nation[], theirHelpers: Nation[], rng: Rng, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];
  const me = state.nations.get(war.attacker)!;
  const them = state.nations.get(war.defender)!;
  const calls: Call[] = [
    ...theirHelpers.map((ally): Call => ({ ally, side: "defend", friend: them, enemy: me })),
    ...myHelpers.map((ally): Call => ({ ally, side: "attack", friend: me, enemy: them })),
  ];
  for (const { ally, side, friend, enemy } of calls) {
    if (!free(state, ally.id, enemy.id)) continue;
    const allyController = controllers(ally.id);
    // Overlord and vassal fight beside each other by duty, without being asked (docs/systems/vassalage.md).
    const duty = crownPartners(state, friend.id).includes(ally.id);
    if (!duty && !allyController.joinWar(state, ally, friend, enemy, side, rng.fork(`join-${ally.id}-${friend.id}-${enemy.id}`))) continue;
    const join: CommandOf<"joinWar"> = { kind: "joinWar", nation: ally.id, war: war.id, side };
    const joined = applyJoinWar(state, join, lookups);
    if (carryOut(allyController, join, joined)) events.push(...joined.events);
  }
  return events;
}

export function declareWars(state: WorldState, rng: Rng, controllers: Controllers): SimEvent[] {
  const events: SimEvent[] = [];
  const lookups = warLookups(state);
  const busy = (id: NationId) => warsOf(state, id) >= SIM.MAX_WARS_PER_NATION;

  for (const [a, b] of neighborPairs(state)) {
    if (atWar(state, a, b) || allied(state, a, b) || sameCrown(state, a, b) || inTruce(state, a, b) || busy(a) || busy(b)) continue;
    const na = state.nations.get(a)!;
    const nb = state.nations.get(b)!;
    // Either side may go to war. The one with more fighting power is asked first.
    const [strong, weak] = fightingPower(state, na) >= fightingPower(state, nb) ? [na, nb] : [nb, na];
    for (const [me, them] of [[strong, weak], [weak, strong]] as const) {
      if (overlordOf(state, me.id)) continue; // a vassal starts no wars of its own
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
      events.push(...callAllies(state, lookups, result.war!, why.myHelpers, why.theirHelpers, rng, controllers));
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
  // Victory can be refused only while the rules still allow the war to continue.
  if (attacker.warWeariness >= SIM.WEARINESS_PEACE || defender.warWeariness >= SIM.WEARINESS_PEACE || state.year - war.startYear >= SIM.MAX_WAR_YEARS) return true;
  if (reason !== "goal" && reason !== "decisive") return reason !== null;
  const winner = reason === "goal" || war.score > 0 ? attacker : defender;
  return controllers(winner.id).acceptPeace(state, winner, war, reason);
}

/**
 * What the winner of `war` makes of the loser (docs/systems/vassalage.md), asked of its controller.
 * Not asked after a raid, nor (unless it holds the capital) in an ally's war; the rules then take land.
 */
export type Subjugator = (winner: Nation, loser: Nation, capitalHeld: boolean) => Subjugation;

/** A subjugator that asks each winner's controller, with dice of its own for each war. */
export function askSubjugation(state: WorldState, war: War, controllers: Controllers, rng: Rng): Subjugator {
  return (winner, loser, capitalHeld) => controllers(winner.id).subjugate(state, winner, loser, capitalHeld, rng.fork(`subjugate-${war.id}`));
}

/** Without a controller to ask (the gods' peace): a held capital makes a vassal, otherwise land. */
const byRule: Subjugator = (_winner, _loser, capitalHeld) => (capitalHeld ? "vassal" : "land");

/**
 * Makes peace in `war`: the winner (null = white peace) takes land, or tribute after a raid,
 * and a truce follows. Returns the peace event, or null for an ally's war that ends
 * `quietly` because the war it joined is over (its record is part of that war's).
 */
export function concludeWar(state: WorldState, war: War, winner: Nation | null, how: WarOutcome["how"], quietly: boolean, subjugate: Subjugator = byRule): SimEvent | null {
  const attacker = state.nations.get(war.attacker)!;
  const defender = state.nations.get(war.defender)!;
  if (war.goal === "independence") return concludeIndependence(state, war, winner, how);
  const loser = winner === attacker ? defender : attacker;
  const sued = how === "terms";
  const raided = winner === attacker && war.goal === "raid";
  if (raided) payTribute(attacker, defender);
  // An attacker beaten off pays for it, as a raider's victim would.
  if (winner === defender) payTribute(defender, attacker);
  let choice: Subjugation = "land";
  if (winner && !raided) {
    const capitalHeld = holdsCapital(state, winner, loser, sued);
    if (capitalHeld || war.joined === undefined) choice = subjugate(winner, loser, capitalHeld);
  }
  const taken = winner && !raided ? takeLand(state, war, winner, loser, sued, choice) : [];
  // A loser who sued and gave up no land pays in other ways.
  if (sued && winner === attacker && !raided && taken.length === 0) payTribute(attacker, defender);
  state.truces.push({ a: attacker.id, b: defender.id, until: state.year + SIM.TRUCE_YEARS });
  if (quietly) return null; // allies go home quietly when the war they joined is over

  let event: SimEvent;
  if (sued) {
    event = suedEvent(state.year, loser, winner!, taken.length);
  } else if (raided) {
    event = raidEvent(state.year, attacker, defender);
  } else {
    // Name a deposit the winner took, if any.
    const prize = taken.find((c) => state.cells[c]!.resource !== 0);
    const prizeName = prize !== undefined ? RESOURCES[state.cells[prize]!.resource as ResourceKind].name : undefined;
    const submitted = winner !== null && loser.alive && loser.overlord === winner.id;
    event =
      !loser.alive ? conquestEvent(state.year, winner!, loser, taken.length)
      : submitted ? submitEvent(state.year, loser, winner, taken.length)
      : peaceEvent(state.year, attacker, defender, winner, taken.length, prizeName);
  }
  closeRecord(state, war, { how, ...(winner ? { winner: winner.id } : {}), raid: raided, cells: taken.length, wholeRealm: !loser.alive, text: event.text });
  return event;
}

/**
 * A war of independence ends (docs/systems/vassalage.md): a vassal that wins is free; otherwise
 * (lost, or no clear winner) it stays a vassal. No land changes hands either way.
 */
function concludeIndependence(state: WorldState, war: War, winner: Nation | null, how: WarOutcome["how"]): SimEvent {
  const vassal = state.nations.get(war.attacker)!;
  const overlord = state.nations.get(war.defender)!;
  const free = winner === vassal;
  if (free) setFree(vassal);
  else if (winner === overlord) payTribute(overlord, vassal);
  state.truces.push({ a: vassal.id, b: overlord.id, until: state.year + SIM.TRUCE_YEARS });
  const event = free ? goesFreeEvent(state.year, vassal, overlord, "won") : keptEvent(state.year, vassal, overlord);
  closeRecord(state, war, { how, ...(winner ? { winner: winner.id } : {}), raid: false, cells: 0, wholeRealm: false, text: event.text });
  return event;
}

/** The clear winner of a war, if the score is at least SIM.WIN_SCORE. Exported for the sandbox. */
export function clearWinnerOf(state: WorldState, war: War): Nation | null {
  return clearWinner(war, state.nations.get(war.attacker)!, state.nations.get(war.defender)!);
}

/**
 * Is the defender holding out? The attacker holds none of what it came for: none of
 * its goal cells, or, in a raid or an ally's war, none of the defender's land at all.
 * An attacker gets its first year to march in.
 */
function holdingOut(state: WorldState, war: War, counts: Map<number, number>): boolean {
  if (war.startYear >= state.year) return false;
  if (war.goalCells.length > 0) return goalsHeld(state, war) === 0;
  return occupiedBy(counts, war.attacker, war.defender) === 0;
}

/** The side losing `war` by SIM.WIN_SCORE or more, with the side winning it; null if neither is that far behind. */
function losingSide(state: WorldState, war: War): { loser: Nation; winner: Nation } | null {
  if (Math.abs(war.score) < SIM.WIN_SCORE) return null;
  const [winner, loser] = war.score > 0 ? [war.attacker, war.defender] : [war.defender, war.attacker];
  return { loser: state.nations.get(loser)!, winner: state.nations.get(winner)! };
}

/** Why `nation` can't sue for peace in `war` (the main war, not an ally's), or null if it can. */
function sueRefusal(state: WorldState, war: War | undefined, nation: NationId): string | null {
  if (!war || war.joined !== undefined) return "there's no such war to end";
  const sides = losingSide(state, war);
  if (!sides || sides.loser.id !== nation) return "only a side clearly losing can sue for peace";
  if (!sides.loser.alive || !sides.winner.alive) return "a side has already fallen";
  return null;
}

/** Why `nation` can't sue for peace in war `warId`, or null if it can. For the player's orders. */
export function suePeaceRefusal(state: WorldState, warId: number, nation: NationId): string | null {
  return sueRefusal(state, state.wars.find((w) => w.id === warId), nation);
}

/** The side winning war `warId` (by SIM.WIN_SCORE or more), or null. */
export function winningSide(state: WorldState, warId: number): Nation | null {
  const war = state.wars.find((w) => w.id === warId);
  return war ? (losingSide(state, war)?.winner ?? null) : null;
}

/** The "suePeace" command: the losing side's offer, which the winner has accepted. The war ends on its terms. */
export function applySuePeace(state: WorldState, cmd: CommandOf<"suePeace">, subjugate: Subjugator = byRule): CommandResult {
  const war = state.wars.find((w) => w.id === cmd.war);
  const why = sueRefusal(state, war, cmd.nation);
  if (why !== null || !war) return refuse(why ?? "there's no such war to end");
  const event = concludeWar(state, war, losingSide(state, war)!.winner, "terms", false, subjugate)!;
  // Allies' wars end with it, as when any war ends.
  for (const joined of state.wars.filter((w) => w.joined === war.id)) concludeWar(state, joined, clearWinner(joined, state.nations.get(joined.attacker)!, state.nations.get(joined.defender)!), "terms", true);
  const over = new Set([war.id, ...state.wars.filter((w) => w.joined === war.id).map((w) => w.id)]);
  state.wars = state.wars.filter((w) => !over.has(w.id));
  return done([event]);
}

/**
 * A war still going may end on terms: the losing side's controller may sue, and the
 * winner's may accept. Only main wars (allies follow theirs) after their first year.
 * Returns the side that won on terms, or null if the war goes on.
 */
function sueForPeace(state: WorldState, war: War, controllers: Controllers, rng: Rng): Nation | null {
  const sides = losingSide(state, war);
  if (!sides || war.joined !== undefined || war.startYear >= state.year) return null;
  const loserController = controllers(sides.loser.id);
  if (!loserController.suePeace(state, sides.loser, war, rng.fork(`sue-${war.id}`))) return null;
  if (!controllers(sides.winner.id).acceptTerms(state, sides.winner, war, rng.fork(`terms-${war.id}`))) return null;
  const why = sueRefusal(state, war, sides.loser.id);
  if (why !== null) {
    loserController.refused?.({ kind: "suePeace", nation: sides.loser.id, war: war.id }, why);
    return null;
  }
  return sides.winner;
}

/** Step 6b: war scores are brought up to date, and wars that are over end in peace. */
/** `rng` rolls only the peace offers; tests may leave it out. */
export function endWars(state: WorldState, controllers: Controllers, rng: Rng = createRng("peace")): SimEvent[] {
  const events: SimEvent[] = [];
  const ongoing: War[] = [];
  // Wars still going after this year. A joined war always comes after its main war in the list.
  const ongoingIds = new Set<number>();
  const counts = occupationCounts(state);

  for (const war of state.wars) {
    const attacker = state.nations.get(war.attacker)!;
    const defender = state.nations.get(war.defender)!;
    // A side has died (conquered or collapsed): the war simply ends.
    if (!attacker.alive || !defender.alive) {
      const fallen = !attacker.alive ? attacker : defender;
      closeRecord(state, war, { how: "side fell", raid: false, cells: 0, wholeRealm: false, text: `${fallen.name} fell, and the war with it.` });
      continue;
    }
    // Realms that have come to serve one crown stop fighting each other, quietly (but not a war of independence).
    if (war.goal !== "independence" && sameCrown(state, war.attacker, war.defender)) {
      closeRecord(state, war, { how: "one crown", raid: false, cells: 0, wholeRealm: false, text: `${attacker.name} and ${defender.name} now serve one crown, and lay down their arms.` });
      continue;
    }
    // An invasion that takes nothing is failing: each year of it counts for the defender.
    if (holdingOut(state, war, counts)) war.heldOff = (war.heldOff ?? 0) + 1;
    war.score = war.battleScore + occupationScore(state, war, counts) - (war.heldOff ?? 0) * SIM.HOLD_SCORE;
    recordScore(state, war);
    const mainOver = war.joined !== undefined && !ongoingIds.has(war.joined);

    const reason = peaceReason(state, war, attacker, defender);
    if (!mainOver && !endsNow(state, war, attacker, defender, reason, controllers)) {
      // Going on, unless the losing side sues for peace and is heard (its allies' wars end with it).
      const onTerms = sueForPeace(state, war, controllers, rng);
      if (onTerms) {
        events.push(concludeWar(state, war, onTerms, "terms", false, askSubjugation(state, war, controllers, rng))!);
        continue;
      }
      ongoing.push(war);
      ongoingIds.add(war.id);
      continue;
    }
    const winner = reason === "goal" ? attacker : clearWinner(war, attacker, defender);
    const event = concludeWar(state, war, winner, (reason ?? "too long") as WarOutcome["how"], mainOver, askSubjugation(state, war, controllers, rng));
    if (event) events.push(event);
  }

  state.wars = ongoing;
  state.truces = state.truces.filter((t) => t.until > state.year);
  return events;
}
