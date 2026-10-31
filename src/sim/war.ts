// Steps 5 and 6b (SPEC §4.5): neighbors go to war (allies may join), and wars end in peace and a truce.
import type { Rng } from "../core/rng";
import type { CellId, Nation, NationId, ResourceKind, SimEvent, War, WarGoal, WorldState } from "../core/types";
import { RESOURCES } from "../gen/params";
import { traits } from "../gen/races";
import { allied, alliesOf, opinion } from "./diplomacy";
import { joinAttackEvent, joinDefenseEvent, peaceEvent, raidEvent, warEvent } from "./events";
import { neighborPairs, pairKey } from "./helpers";
import { fightingPower } from "./manpower";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses } from "./resources";
import { occupationCounts, occupationScore } from "./siege";
import { chooseGoal, goalAchieved, payTribute, takeLand } from "./warGoals";

// They used to live here; other files still import them from war.ts.
export { neighborPairs, pairKey };

/** Cells of `side` that touch a cell of `enemy`: where fighting happens. */
export function frontCells(state: WorldState, side: NationId, enemy: NationId): CellId[] {
  const owner = state.state.owner;
  const front: CellId[] = [];
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] !== side) continue;
    for (const n of state.cells[c]!.neighbors) {
      if (owner[n] === enemy) {
        front.push(c);
        break;
      }
    }
  }
  return front;
}

function inTruce(state: WorldState, a: NationId, b: NationId): boolean {
  return state.truces.some((t) => pairKey(t.a, t.b) === pairKey(a, b) && t.until > state.year);
}

/**
 * Yearly chance that `attacker` declares war on `defender` (SPEC §4.5).
 * `attackHelp` / `defendHelp` = fighting power the allies on each side are expected to bring.
 * `motive` multiplies it for reasons to fight (claims on lost land).
 * A bigger gap makes war more tempting, and so do an aggressive ruling race and hatred.
 */
export function warChance(state: WorldState, attacker: Nation, defender: Nation, attackHelp = 0, defendHelp = 0, motive = 1): number {
  const ratio = (fightingPower(state, attacker) + attackHelp) / Math.max(fightingPower(state, defender) + defendHelp, 1e-6);
  const mood = Math.max(0, 1 - opinion(state, attacker.id, defender.id) * SIM.OPINION_WAR_K);
  return Math.min(
    SIM.WAR_MAX_PROB,
    SIM.WAR_BASE_PROB * traits(attacker.race).aggression * ratio ** SIM.WAR_STRENGTH_EXP * (1 - attacker.warWeariness) * mood * motive,
  );
}

/** Key for "from → to": unlike pairKey, the order matters. */
function directedKey(from: NationId, to: NationId): number {
  return from * 100000 + to;
}

/**
 * Who has a claim on whom: directedKey(claimant, holder) for every nation
 * holding a cell the claimant lost to it within SIM.CLAIM_YEARS.
 */
export function claims(state: WorldState): Set<number> {
  const { owner, prevOwner, ownedSince } = state.state;
  const found = new Set<number>();
  for (let c = 0; c < owner.length; c++) {
    const lost = prevOwner[c]!;
    if (lost === 0 || owner[c] === 0 || state.year - ownedSince[c]! > SIM.CLAIM_YEARS) continue;
    if (state.nations.get(lost)?.alive) found.add(directedKey(lost, owner[c]!));
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

export function declareWars(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const pairs = neighborPairs(state);
  const touching = new Set(pairs.map(([a, b]) => pairKey(a, b)));
  const claimed = claims(state);
  const prizes = borderPrizes(state);
  const atWar = new Set(state.wars.map((w) => pairKey(w.attacker, w.defender)));
  const warCount = new Map<NationId, number>();
  for (const w of state.wars) {
    warCount.set(w.attacker, (warCount.get(w.attacker) ?? 0) + 1);
    warCount.set(w.defender, (warCount.get(w.defender) ?? 0) + 1);
  }
  const busy = (id: NationId) => (warCount.get(id) ?? 0) >= SIM.MAX_WARS_PER_NATION;
  const free = (a: NationId, b: NationId) => !atWar.has(pairKey(a, b)) && !inTruce(state, a, b) && !busy(a);

  // Allies of `friend` that could fight `enemy`: they border it or `friend`, aren't also its allies, and are free.
  const helpers = (friend: NationId, enemy: NationId): Nation[] =>
    alliesOf(state, friend)
      .filter((id) => id !== enemy && (touching.has(pairKey(id, enemy)) || touching.has(pairKey(id, friend))) && !allied(state, id, enemy) && free(id, enemy))
      .map((id) => state.nations.get(id)!);
  const help = (allies: Nation[], joinChance: number) => allies.reduce((sum, n) => sum + fightingPower(state, n) * joinChance, 0);

  const start = (attacker: Nation, defender: Nation, goal: WarGoal, goalCells: CellId[], joined?: number): War => {
    const war = startWar(state, attacker, defender, goal, goalCells, joined);
    atWar.add(pairKey(attacker.id, defender.id));
    warCount.set(attacker.id, (warCount.get(attacker.id) ?? 0) + 1);
    warCount.set(defender.id, (warCount.get(defender.id) ?? 0) + 1);
    return war;
  };

  for (const [a, b] of pairs) {
    if (atWar.has(pairKey(a, b)) || allied(state, a, b) || inTruce(state, a, b) || busy(a) || busy(b)) continue;
    const na = state.nations.get(a)!;
    const nb = state.nations.get(b)!;
    // The side with more fighting power attacks, weighing up whose allies would join in.
    const [attacker, defender] = fightingPower(state, na) >= fightingPower(state, nb) ? [na, nb] : [nb, na];
    const attackAllies = helpers(attacker.id, defender.id);
    const defendAllies = helpers(defender.id, attacker.id);
    // Reasons to fight: land it lost to the defender, and how much the best border cell is worth.
    const claim = claimed.has(directedKey(attacker.id, defender.id));
    const prize = prizes.get(directedKey(attacker.id, defender.id));
    const motive = (claim ? SIM.CLAIM_WAR_BONUS : 1) * (1 + SIM.WAR_VALUE_K * (prize?.value ?? 0));
    const chance = warChance(state, attacker, defender, help(attackAllies, SIM.ALLY_ATTACK_PROB), help(defendAllies, SIM.ALLY_DEFEND_PROB), motive);
    if (!rng.chance(chance)) continue;

    const { goal, goalCells } = chooseGoal(state, attacker, defender, claim, prize?.cell, rng);
    const war = start(attacker, defender, goal, goalCells);
    events.push(warEvent(state.year, attacker, defender, warMotive(state, attacker, goal, goalCells, prize?.cell)));
    for (const ally of defendAllies) {
      if (!free(ally.id, attacker.id) || !rng.chance(SIM.ALLY_DEFEND_PROB)) continue;
      start(attacker, ally, "support", [], war.id);
      events.push(joinDefenseEvent(state.year, ally, defender, attacker));
    }
    for (const ally of attackAllies) {
      if (!free(ally.id, defender.id) || !rng.chance(SIM.ALLY_ATTACK_PROB)) continue;
      start(ally, defender, "support", [], war.id);
      events.push(joinAttackEvent(state.year, ally, attacker, defender));
    }
  }
  return events;
}

/** Why a war should end now, or null if it goes on. */
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

/** Step 6b: war scores are brought up to date, and wars that are over end in peace. */
export function endWars(state: WorldState): SimEvent[] {
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
    if (!mainOver && !reason) {
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
    events.push(peaceEvent(state.year, attacker, defender, winner, taken.length, prizeName));
  }

  state.wars = ongoing;
  state.truces = state.truces.filter((t) => t.until > state.year);
  return events;
}
