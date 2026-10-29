// Readable sentences for the event log (SPEC §4.9).
import type { Nation, SimEvent } from "../core/types";
import { traits } from "../gen/races";

export function foundedEvent(year: number, nation: Nation, where: string): SimEvent {
  return {
    year,
    type: "founded",
    actors: [nation.id],
    text: `Year ${year}: ${nation.name}, a realm of ${traits(nation.race).plural}, rises ${where}.`,
  };
}

export function rebellionEvent(year: number, rebel: Nation, from: Nation): SimEvent {
  // A subject people rising against rulers of another race gets told as such.
  const text =
    rebel.race !== from.race
      ? `Year ${year}: the ${traits(rebel.race).plural} of ${rebel.name} rise against ${from.name}.`
      : `Year ${year}: ${rebel.name} breaks away from ${from.name}.`;
  return { year, type: "rebellion", actors: [rebel.id, from.id], text };
}

export function collapseEvent(year: number, nation: Nation): SimEvent {
  return { year, type: "collapse", actors: [nation.id], text: `Year ${year}: ${nation.name} collapses.` };
}

export function annexedEvent(year: number, nation: Nation, by: Nation): SimEvent {
  return {
    year,
    type: "annexed",
    actors: [nation.id, by.id],
    text: `Year ${year}: ${nation.name} falls apart and is absorbed by ${by.name}.`,
  };
}

export function capitalMovedEvent(year: number, nation: Nation): SimEvent {
  return {
    year,
    type: "capital_moved",
    actors: [nation.id],
    text: `Year ${year}: ${nation.name} loses its capital and moves its court.`,
  };
}

/** `why`, if given, finishes the sentence, e.g. "to reclaim its lost lands". */
export function warEvent(year: number, attacker: Nation, defender: Nation, why?: string): SimEvent {
  return {
    year,
    type: "war",
    actors: [attacker.id, defender.id],
    text: `Year ${year}: ${attacker.name} declares war on ${defender.name}${why ? ` ${why}` : ""}.`,
  };
}

/** An ally of the defender joins the war against the attacker. */
export function joinDefenseEvent(year: number, ally: Nation, friend: Nation, enemy: Nation): SimEvent {
  return {
    year,
    type: "war",
    actors: [ally.id, enemy.id, friend.id],
    text: `Year ${year}: ${ally.name} marches to defend ${friend.name} against ${enemy.name}.`,
  };
}

/** An ally of the attacker joins its attack. */
export function joinAttackEvent(year: number, ally: Nation, friend: Nation, enemy: Nation): SimEvent {
  return {
    year,
    type: "war",
    actors: [ally.id, enemy.id, friend.id],
    text: `Year ${year}: ${ally.name} joins ${friend.name}'s war on ${enemy.name}.`,
  };
}

export function allianceEvent(year: number, a: Nation, b: Nation): SimEvent {
  // Two realms of one race allying is told as kinship.
  const text =
    a.race === b.race
      ? `Year ${year}: the ${traits(a.race).plural} of ${a.name} and ${b.name} swear a kinship pact.`
      : `Year ${year}: ${a.name} and ${b.name} form an alliance.`;
  return { year, type: "alliance", actors: [a.id, b.id], text };
}

export function allianceEndedEvent(year: number, a: Nation, b: Nation): SimEvent {
  return {
    year,
    type: "alliance_ended",
    actors: [a.id, b.id],
    text: `Year ${year}: the alliance between ${a.name} and ${b.name} breaks down.`,
  };
}

/** `winner` is null for a white peace (nobody clearly won). `cells` = land the winner gained. */
export function peaceEvent(year: number, a: Nation, b: Nation, winner: Nation | null, cells: number): SimEvent {
  const loser = winner === a ? b : a;
  const text = winner
    ? `Year ${year}: ${winner.name} defeats ${loser.name}, taking ${cells} province${cells === 1 ? "" : "s"}.`
    : `Year ${year}: ${a.name} and ${b.name} sign a white peace.`;
  return { year, type: "peace", actors: [winner?.id ?? a.id, loser.id], text };
}
