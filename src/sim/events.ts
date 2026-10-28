// Readable sentences for the event log (SPEC §4.9).
import type { Nation, SimEvent } from "../core/types";

export function foundedEvent(year: number, nation: Nation, where: string): SimEvent {
  return { year, type: "founded", actors: [nation.id], text: `Year ${year}: ${nation.name} rises ${where}.` };
}

export function rebellionEvent(year: number, rebel: Nation, from: Nation): SimEvent {
  return {
    year,
    type: "rebellion",
    actors: [rebel.id, from.id],
    text: `Year ${year}: ${rebel.name} breaks away from ${from.name}.`,
  };
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

export function warEvent(year: number, attacker: Nation, defender: Nation): SimEvent {
  return {
    year,
    type: "war",
    actors: [attacker.id, defender.id],
    text: `Year ${year}: ${attacker.name} declares war on ${defender.name}.`,
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
