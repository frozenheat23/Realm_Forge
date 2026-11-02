// War records (M16, docs/systems/warroom.md): what each war leaves behind, for the War Room.
// The rules call these as a war goes on. Nothing in the simulation ever reads a record,
// so keeping them can't change history.
import type { BattleReport, CellId, NationId, War, WarOutcome, WarRecord, WorldState } from "../core/types";

/** The record a war writes to: its own, or for an ally's joined war, the war it joined. */
export function recordOf(state: WorldState, warId: number): WarRecord | undefined {
  const war = state.wars.find((w) => w.id === warId);
  const id = war?.joined ?? warId;
  // Recent wars sit at the end of the list, and most lookups are for wars still going.
  for (let i = state.warRecords.length - 1; i >= 0; i--) if (state.warRecords[i]!.id === id) return state.warRecords[i];
  return undefined;
}

/** Which side of `record` a nation fights on. */
export function sideOf(record: WarRecord, nation: NationId): "attack" | "defend" {
  if (nation === record.attacker) return "attack";
  if (nation === record.defender) return "defend";
  return record.allies.find((a) => a.nation === nation)?.side ?? "defend";
}

const nameOf = (state: WorldState, id: NationId) => state.nations.get(id)?.name ?? "?";

/** A war has started: a new record, or for an ally joining, a line in the record of the war it joined. */
export function openRecord(state: WorldState, war: War): void {
  if (war.joined === undefined) {
    state.warRecords.push({
      id: war.id,
      attacker: war.attacker,
      defender: war.defender,
      allies: [],
      goal: war.goal,
      start: state.year,
      scores: [],
      battles: [],
      fallen: { attack: 0, defend: 0 },
      moments: [],
    });
    return;
  }
  const record = recordOf(state, war.joined);
  if (!record) return;
  // The ally is whichever side of its own war isn't already in the main war.
  const main = new Set([record.attacker, record.defender]);
  const ally = main.has(war.attacker) ? war.defender : war.attacker;
  const side = ally === war.defender ? "defend" : "attack";
  const friend = side === "defend" ? record.defender : record.attacker;
  record.allies.push({ nation: ally, side, year: state.year });
  record.moments.push({ year: state.year, kind: "joined", text: `${nameOf(state, ally)} joins on ${nameOf(state, friend)}'s side.` });
}

/** A battle in this war. `place` starts a sentence, e.g. "at the Battle of Arvenna". */
export function recordBattle(state: WorldState, warId: number, battle: BattleReport, place: string): void {
  const record = recordOf(state, warId);
  if (!record) return;
  record.battles.push({ year: state.year, ...battle });
  if (battle.routed) {
    record.moments.push({ year: state.year, kind: "rout", text: `${place}, the host of ${nameOf(state, battle.loser)} is routed.` });
  }
}

/** Soldiers a nation lost in this war, in battle or to hunger and desertion. */
export function recordLoss(state: WorldState, warId: number, nation: NationId, dead: number): void {
  const record = recordOf(state, warId);
  if (!record || dead <= 0) return;
  record.fallen[sideOf(record, nation)] += dead;
}

/** `taker` has occupied `holder`'s capital. */
export function recordCapital(state: WorldState, taker: NationId, holder: NationId, cell: CellId): void {
  const war = state.wars.find((w) => (w.attacker === taker && w.defender === holder) || (w.attacker === holder && w.defender === taker));
  const record = war && recordOf(state, war.id);
  if (!record) return;
  const city = state.cityNames.get(cell);
  record.moments.push({
    year: state.year,
    kind: "capital",
    text: `${nameOf(state, taker)} takes the capital of ${nameOf(state, holder)}${city ? `, ${city}` : ""}.`,
  });
}

/** The year's score of a main war. */
export function recordScore(state: WorldState, war: War): void {
  if (war.joined === undefined) recordOf(state, war.id)?.scores.push(war.score);
}

/** A main war is over. */
export function closeRecord(state: WorldState, war: War, outcome: WarOutcome): void {
  if (war.joined !== undefined) return;
  const record = recordOf(state, war.id);
  if (!record) return;
  record.end = state.year;
  record.outcome = outcome;
}
