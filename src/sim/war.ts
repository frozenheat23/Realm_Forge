// Steps 5–6 (SPEC §4.5): neighbors go to war (allies may join), fronts move, and wars end in peace and a truce.
import type { Rng } from "../core/rng";
import { Resource, type CellId, type Nation, type NationId, type ResourceKind, type SimEvent, type War, type WorldState } from "../core/types";
import { RESOURCES } from "../gen/params";
import { traits } from "../gen/races";
import { allied, alliesOf, opinion } from "./diplomacy";
import { joinAttackEvent, joinDefenseEvent, peaceEvent, warEvent } from "./events";
import { neighborPairs, pairKey, setOwner } from "./helpers";
import { battleLosses, fightingPower, loseSoldiers, soldiers } from "./manpower";
import { SIM } from "./params";
import { cellValue, effectiveCapacity, grainBonuses, resourceBonus } from "./resources";

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

/** All cells on any active front (both sides), found in one pass over the map. Used in the population step. */
export function allFrontCells(state: WorldState): Set<CellId> {
  const front = new Set<CellId>();
  if (state.wars.length === 0) return front;
  const atWar = new Set(state.wars.map((w) => pairKey(w.attacker, w.defender)));
  const owner = state.state.owner;
  for (let c = 0; c < owner.length; c++) {
    const me = owner[c]!;
    if (me === 0) continue;
    for (const n of state.cells[c]!.neighbors) {
      const other = owner[n]!;
      if (other !== 0 && other !== me && atWar.has(pairKey(me, other))) {
        front.add(c);
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

/** Why `attacker` goes to war, for the event text: claims first, then a deposit its race prizes. */
function warMotive(state: WorldState, attacker: Nation, claim: boolean, prize?: CellId): string | undefined {
  if (claim) return " to reclaim its lost lands";
  if (prize === undefined) return undefined;
  const deposit = state.cells[prize]!.resource;
  if (deposit === 0 || !traits(attacker.race).favoredResources.includes(deposit as ResourceKind)) return undefined;
  return `, coveting its ${RESOURCES[deposit as ResourceKind].name}`;
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

  // Allies of `friend` that could fight `enemy`: they border it, aren't also its allies, and are free.
  const helpers = (friend: NationId, enemy: NationId): Nation[] =>
    alliesOf(state, friend)
      .filter((id) => id !== enemy && touching.has(pairKey(id, enemy)) && !allied(state, id, enemy) && free(id, enemy))
      .map((id) => state.nations.get(id)!);
  const help = (allies: Nation[], joinChance: number) => allies.reduce((sum, n) => sum + fightingPower(state, n) * joinChance, 0);

  let created = 0;
  const start = (attacker: Nation, defender: Nation, joined?: number): War => {
    const war: War = { id: state.year * 1000 + created++, attacker: attacker.id, defender: defender.id, startYear: state.year, score: 0 };
    if (joined !== undefined) war.joined = joined;
    state.wars.push(war);
    atWar.add(pairKey(attacker.id, defender.id));
    warCount.set(attacker.id, (warCount.get(attacker.id) ?? 0) + 1);
    warCount.set(defender.id, (warCount.get(defender.id) ?? 0) + 1);
    // Going to war leaves a grudge that takes decades to fade.
    state.relations.set(pairKey(attacker.id, defender.id), Math.max(-1, opinion(state, attacker.id, defender.id) - SIM.WAR_OPINION_HIT));
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

    const war = start(attacker, defender);
    events.push(warEvent(state.year, attacker, defender, warMotive(state, attacker, claim, prize?.cell)));
    for (const ally of defendAllies) {
      if (!free(ally.id, attacker.id) || !rng.chance(SIM.ALLY_DEFEND_PROB)) continue;
      start(attacker, ally, war.id);
      events.push(joinDefenseEvent(state.year, ally, defender, attacker));
    }
    for (const ally of attackAllies) {
      if (!free(ally.id, defender.id) || !rng.chance(SIM.ALLY_ATTACK_PROB)) continue;
      start(ally, defender, war.id);
      events.push(joinAttackEvent(state.year, ally, attacker, defender));
    }
  }
  return events;
}

/** Average `defense` trait of the races living in `cells` (1 if there are none). */
export function averageDefense(state: WorldState, cells: CellId[]): number {
  if (cells.length === 0) return 1;
  let sum = 0;
  for (const c of cells) sum += traits(state.state.race[c]!).defense;
  return sum / cells.length;
}

/** Average terrain defensibility of `cells` (1 if there are none). */
export function averageDefensibility(state: WorldState, cells: CellId[]): number {
  if (cells.length === 0) return 1;
  let sum = 0;
  for (const c of cells) sum += state.cells[c]!.defensibility;
  return sum / cells.length;
}

/** How many wars `id` is fighting: its soldiers are split between them. */
function warsOf(state: WorldState, id: NationId): number {
  let count = 0;
  for (const w of state.wars) if (w.attacker === id || w.defender === id) count++;
  return Math.max(1, count);
}

/**
 * One year of fighting in one war. Returns how many cells changed hands.
 * The yearly winner is a weighted coin flip: the side with more soldiers here
 * wins more often, and the defender gets a home-ground bonus, bigger where its
 * front is held by a stubborn race (dwarven hill forts hold even under a human
 * king), runs through hills, forests and rivers, or is armed with mithril.
 * Both sides lose soldiers, the loser many more (SPEC §4.13). Until armies
 * march (M11 step 3), this yearly roll stands in for that year's battles.
 */
export function fightBattle(state: WorldState, war: War, rng: Rng): number {
  const attacker = state.nations.get(war.attacker)!;
  const defender = state.nations.get(war.defender)!;
  // A nation in two wars sends half its soldiers to each.
  const attackShare = 1 / warsOf(state, attacker.id);
  const defendShare = 1 / warsOf(state, defender.id);
  const a = fightingPower(state, attacker, attackShare);
  const front = frontCells(state, defender.id, attacker.id);
  const frontDefense = averageDefense(state, front) * averageDefensibility(state, front) * resourceBonus(defender, Resource.Mithril);
  const d = fightingPower(state, defender, defendShare) * SIM.DEFENDER_BONUS * frontDefense;
  const attackerWins = rng.chance(a + d > 0 ? a / (a + d) : 0.5);
  const [winner, loser] = attackerWins ? [attacker, defender] : [defender, attacker];

  // Losses come out of the soldiers each side sent to this war.
  const [winForce, loseForce] = attackerWins
    ? [soldiers(state, attacker) * attackShare, soldiers(state, defender) * defendShare]
    : [soldiers(state, defender) * defendShare, soldiers(state, attacker) * attackShare];
  const losses = battleLosses(attackerWins ? a / Math.max(d, 1e-6) : d / Math.max(a, 1e-6));
  loseSoldiers(state, winner, winForce * losses.winner, war.id);
  loseSoldiers(state, loser, loseForce * losses.loser, war.id);

  // The winner takes the loser's most valuable front cells first. The capital
  // is defended hardest, so it only falls once the rest of the front has.
  const value = (c: CellId) =>
    c === loser.capital ? -Infinity : cellValue(state, c, winner.race, effectiveCapacity(state, c));
  const targets = frontCells(state, loser.id, winner.id)
    .map((c) => ({ c, v: value(c) }))
    .sort((x, y) => y.v - x.v || x.c - y.c)
    .slice(0, SIM.FRONT_FLIPS_PER_YEAR)
    .map((t) => t.c);
  const { unrest, devastation } = state.state;
  for (const c of targets) {
    setOwner(state, c, winner.id);
    if (state.cells[c]!.resource !== 0) (war.prizes ??= []).push({ cell: c, by: winner.id });
    // Conquered people resent their new rulers, and the fighting wrecks the land.
    unrest[c] = Math.max(unrest[c]!, SIM.UNREST_CONQUEST);
    devastation[c] = Math.min(1, devastation[c]! + SIM.DEVASTATION_CAPTURE);
  }

  war.score += (attackerWins ? 1 : -1) * SIM.SCORE_PER_FLIP * targets.length;
  return targets.length;
}

/** Why a war should end now, or null if it goes on. */
function peaceReason(state: WorldState, war: War, attacker: Nation, defender: Nation): string | null {
  if (Math.abs(war.score) >= SIM.PEACE_SCORE) return "decisive";
  if (attacker.warWeariness >= SIM.WEARINESS_PEACE || defender.warWeariness >= SIM.WEARINESS_PEACE) return "exhausted";
  if (state.year - war.startYear >= SIM.MAX_WAR_YEARS) return "too long";
  return null;
}

export function fightWars(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const ongoing: War[] = [];
  // Wars still going after this year. A joined war always comes after its main war in the list.
  const ongoingIds = new Set<number>();

  for (const war of state.wars) {
    const attacker = state.nations.get(war.attacker);
    const defender = state.nations.get(war.defender);
    // A side has died (conquered or collapsed): the war simply ends.
    if (!attacker?.alive || !defender?.alive) continue;
    // Allies go home when the war they joined is over.
    if (war.joined !== undefined && !ongoingIds.has(war.joined)) {
      state.truces.push({ a: attacker.id, b: defender.id, until: state.year + SIM.TRUCE_YEARS });
      continue;
    }

    fightBattle(state, war, rng.fork(`war-${war.id}`));

    if (!peaceReason(state, war, attacker, defender)) {
      ongoing.push(war);
      ongoingIds.add(war.id);
      continue;
    }
    // Clear winner only if the score is at least a third of the way to SIM.PEACE_SCORE.
    const clear = Math.abs(war.score) >= SIM.PEACE_SCORE / 3;
    const winner = !clear ? null : war.score > 0 ? attacker : defender;
    const cells = Math.round(Math.abs(war.score) / SIM.SCORE_PER_FLIP);
    // Name a deposit the winner took and still holds, if any.
    const prize = winner ? war.prizes?.find((p) => p.by === winner.id && state.state.owner[p.cell] === winner.id) : undefined;
    const prizeName = prize ? RESOURCES[state.cells[prize.cell]!.resource as ResourceKind].name : undefined;
    events.push(peaceEvent(state.year, attacker, defender, winner, cells, prizeName));
    state.truces.push({ a: attacker.id, b: defender.id, until: state.year + SIM.TRUCE_YEARS });
  }

  state.wars = ongoing;
  state.truces = state.truces.filter((t) => t.until > state.year);
  return events;
}
