// Steps 5–6 (SPEC §4.5): neighbors go to war, fronts move, and wars end in peace and a truce.
import type { Rng } from "../core/rng";
import type { CellId, Nation, NationId, SimEvent, War, WorldState } from "../core/types";
import { peaceEvent, warEvent } from "./events";
import { moveCost } from "./helpers";
import { SIM } from "./params";

/** One number per pair of nations, the same whichever order they're given in. */
export function pairKey(a: NationId, b: NationId): number {
  return Math.min(a, b) * 100000 + Math.max(a, b);
}

/** Every pair of living nations whose land touches, smallest ids first. */
export function neighborPairs(state: WorldState): [NationId, NationId][] {
  const owner = state.state.owner;
  const seen = new Set<number>();
  const pairs: [NationId, NationId][] = [];
  for (const cell of state.cells) {
    const a = owner[cell.id]!;
    if (a === 0) continue;
    for (const n of cell.neighbors) {
      const b = owner[n]!;
      if (b === 0 || b === a) continue;
      const key = pairKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([Math.min(a, b), Math.max(a, b)]);
    }
  }
  return pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

/** Cells of `side` that touch a cell of `enemy`: where fighting happens. */
export function frontCells(state: WorldState, side: NationId, enemy: NationId): CellId[] {
  const owner = state.state.owner;
  return state.cells
    .filter((c) => owner[c.id] === side && c.neighbors.some((n) => owner[n] === enemy))
    .map((c) => c.id);
}

/** All cells on any active front (both sides). Used for war losses in the population step. */
export function allFrontCells(state: WorldState): Set<CellId> {
  const front = new Set<CellId>();
  for (const war of state.wars) {
    for (const c of frontCells(state, war.attacker, war.defender)) front.add(c);
    for (const c of frontCells(state, war.defender, war.attacker)) front.add(c);
  }
  return front;
}

function inTruce(state: WorldState, a: NationId, b: NationId): boolean {
  return state.truces.some((t) => pairKey(t.a, t.b) === pairKey(a, b) && t.until > state.year);
}

export function declareWars(state: WorldState, rng: Rng): SimEvent[] {
  const events: SimEvent[] = [];
  const atWar = new Set(state.wars.map((w) => pairKey(w.attacker, w.defender)));
  const warCount = new Map<NationId, number>();
  for (const w of state.wars) {
    warCount.set(w.attacker, (warCount.get(w.attacker) ?? 0) + 1);
    warCount.set(w.defender, (warCount.get(w.defender) ?? 0) + 1);
  }
  const busy = (id: NationId) => (warCount.get(id) ?? 0) >= SIM.MAX_WARS_PER_NATION;

  for (const [a, b] of neighborPairs(state)) {
    if (atWar.has(pairKey(a, b)) || inTruce(state, a, b) || busy(a) || busy(b)) continue;
    const na = state.nations.get(a)!;
    const nb = state.nations.get(b)!;
    // The stronger side attacks; a bigger gap makes war more tempting.
    const [attacker, defender] = na.strength >= nb.strength ? [na, nb] : [nb, na];
    const ratio = attacker.strength / Math.max(defender.strength, 1e-6);
    const chance = Math.min(
      SIM.WAR_MAX_PROB,
      SIM.WAR_BASE_PROB * ratio ** SIM.WAR_STRENGTH_EXP * (1 - attacker.warWeariness),
    );
    if (!rng.chance(chance)) continue;

    const war: War = { id: state.year * 1000 + events.length, attacker: attacker.id, defender: defender.id, startYear: state.year, score: 0 };
    state.wars.push(war);
    atWar.add(pairKey(a, b));
    warCount.set(attacker.id, (warCount.get(attacker.id) ?? 0) + 1);
    warCount.set(defender.id, (warCount.get(defender.id) ?? 0) + 1);
    events.push(warEvent(state.year, attacker, defender));
  }
  return events;
}

/**
 * One year of fighting in one war. Returns how many cells changed hands.
 * The yearly winner is a weighted coin flip: the stronger side wins more often,
 * and the defender gets a home-ground bonus.
 */
export function fightBattle(state: WorldState, war: War, rng: Rng): number {
  const attacker = state.nations.get(war.attacker)!;
  const defender = state.nations.get(war.defender)!;
  const a = attacker.strength;
  const d = defender.strength * SIM.DEFENDER_BONUS;
  const attackerWins = rng.chance(a + d > 0 ? a / (a + d) : 0.5);
  const [winner, loser] = attackerWins ? [attacker, defender] : [defender, attacker];

  // The winner takes the easiest loser cells along the front first. The
  // capital is defended hardest, so it only falls once the rest of the front has.
  const cost = (c: CellId) => (c === loser.capital ? Infinity : moveCost(state.cells[c]!));
  const targets = frontCells(state, loser.id, winner.id)
    .sort((x, y) => cost(x) - cost(y) || x - y)
    .slice(0, SIM.FRONT_FLIPS_PER_YEAR);
  for (const c of targets) state.state.owner[c] = winner.id;

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

  for (const war of state.wars) {
    const attacker = state.nations.get(war.attacker);
    const defender = state.nations.get(war.defender);
    // A side has died (conquered or collapsed): the war simply ends.
    if (!attacker?.alive || !defender?.alive) continue;

    fightBattle(state, war, rng.fork(`war-${war.id}`));

    if (!peaceReason(state, war, attacker, defender)) {
      ongoing.push(war);
      continue;
    }
    // Clear winner only if the score is at least a third of the way to SIM.PEACE_SCORE.
    const clear = Math.abs(war.score) >= SIM.PEACE_SCORE / 3;
    const winner = !clear ? null : war.score > 0 ? attacker : defender;
    const cells = Math.round(Math.abs(war.score) / SIM.SCORE_PER_FLIP);
    events.push(peaceEvent(state.year, attacker, defender, winner, cells));
    state.truces.push({ a: attacker.id, b: defender.id, until: state.year + SIM.TRUCE_YEARS });
  }

  state.wars = ongoing;
  state.truces = state.truces.filter((t) => t.until > state.year);
  return events;
}
