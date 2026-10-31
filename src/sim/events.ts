// Readable sentences for the event log (SPEC §4.9).
import { Faith, type Nation, type SimEvent } from "../core/types";
import { faithInfo } from "../gen/faiths";
import { traits } from "../gen/races";
import { ARMY_MEN_PER_UNIT } from "./params";

/** "12,000": soldier units as a number of men. */
export function menText(units: number): string {
  return (Math.round((units * ARMY_MEN_PER_UNIT) / 100) * 100).toLocaleString("en-US");
}

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

export function rebornEvent(year: number, reborn: Nation, from: Nation, yearsGone: number): SimEvent {
  const text = `Year ${year}: ${reborn.name} is reborn, ${yearsGone} years after its fall, breaking free of ${from.name}.`;
  return { year, type: "rebellion", actors: [reborn.id, from.id], text };
}

/** The Old Gods take root in `at`, somewhere in `nation`. `capital` tells which part of the realm that is. */
export function oldGodsEvent(year: number, nation: Nation, capital: [number, number], at: [number, number]): SimEvent {
  const dx = at[0] - capital[0];
  const dy = at[1] - capital[1];
  const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "east" : "west") : dy > 0 ? "south" : "north";
  return { year, type: "faith", actors: [nation.id], text: `Year ${year}: the Old Gods stir in the ${side} of ${nation.name}.` };
}

export function conversionEvent(year: number, nation: Nation): SimEvent {
  const faith = faithInfo(nation.faith).name;
  const text = nation.faith === Faith.OldGods ? `Year ${year}: ${nation.name} turns to ${faith}.` : `Year ${year}: ${nation.name} embraces ${faith}.`;
  return { year, type: "faith", actors: [nation.id], text };
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

export function conquestEvent(year: number, winner: Nation, loser: Nation, cells: number): SimEvent {
  return {
    year,
    type: "annexed",
    actors: [loser.id, winner.id],
    text: `Year ${year}: ${winner.name} takes the capital of ${loser.name} and conquers the whole realm, ${cells} provinces in all.`,
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

/** `why`, if given, finishes the sentence, e.g. " to reclaim its lost lands" or ", coveting its iron". */
export function warEvent(year: number, attacker: Nation, defender: Nation, why = ""): SimEvent {
  return {
    year,
    type: "war",
    actors: [attacker.id, defender.id],
    text: `Year ${year}: ${attacker.name} declares war on ${defender.name}${why}.`,
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

export function cityFoundedEvent(year: number, city: string, nation: Nation): SimEvent {
  return {
    year,
    type: "city_founded",
    actors: [nation.id],
    text: `Year ${year}: ${city} grows into a great city of ${nation.name}.`,
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

/**
 * `winner` is null for a white peace (nobody clearly won). `cells` = land the winner gained;
 * `prize` = a resource it took, if any.
 */
/** `place` starts the sentence, e.g. "at the Battle of Arvenna" or "in the hills of Kethar". */
export function battleEvent(year: number, place: string, winner: Nation, loser: Nation, lost: number, routed: boolean): SimEvent {
  const verb = routed ? "routs" : "beats back";
  return { year, type: "battle", actors: [winner.id, loser.id], text: `Year ${year}: ${place}, ${winner.name} ${verb} the host of ${loser.name} (${menText(lost)} fell).` };
}

export function raidEvent(year: number, winner: Nation, loser: Nation): SimEvent {
  return { year, type: "peace", actors: [winner.id, loser.id], text: `Year ${year}: ${winner.name} plunders ${loser.name} and goes home laden with spoils.` };
}

export function peaceEvent(year: number, a: Nation, b: Nation, winner: Nation | null, cells: number, prize?: string): SimEvent {
  const loser = winner === a ? b : a;
  const spoils = prize ? ` and its ${prize}` : "";
  const text = winner
    ? `Year ${year}: ${winner.name} defeats ${loser.name}, taking ${cells} province${cells === 1 ? "" : "s"}${spoils}.`
    : `Year ${year}: ${a.name} and ${b.name} sign a white peace.`;
  return { year, type: "peace", actors: [winner?.id ?? a.id, loser.id], text };
}
