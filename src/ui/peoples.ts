// Peoples (SPEC §5.4t): which races still rule a realm, and the news when one loses its
// last crown or wins one back. Worked out on the screen from the world; nothing is stored,
// so history and saves are unchanged. Only reads the world.
import type { Nation, NationId, PlayableRace, SimEvent, WorldState } from "../core/types";
import { PLAYABLE_RACES, traits } from "../gen/races";
import type { ExtraNews } from "./headlines";

/** One race's standing: the realms it rules and their land. */
export interface PeopleRow {
  race: PlayableRace;
  /** "Orcs", "Light Elves", ... */
  name: string;
  /** Living realms ruled by this race, vassals included. */
  realms: NationId[];
  /** How many of those serve an overlord. */
  vassals: number;
  /** Share of all land those realms hold, 0..1. */
  share: number;
}

/** Every race's standing, in race order. `land` = how many land cells the map has. */
export function peoples(state: WorldState, land: number): PeopleRow[] {
  // Counted from the map itself, like the standings: a realm's stored `area` is 0 before the first year.
  const cellsOf = new Map<NationId, number>();
  for (const owner of state.state.owner) if (owner !== 0) cellsOf.set(owner, (cellsOf.get(owner) ?? 0) + 1);
  return PLAYABLE_RACES.map((race) => {
    const ruled = [...state.nations.values()].filter((n) => n.alive && n.race === race);
    const cells = ruled.reduce((sum, n) => sum + (cellsOf.get(n.id) ?? 0), 0);
    const vassals = ruled.filter((n) => n.overlord !== undefined && state.nations.get(n.overlord)?.alive).length;
    return { race, name: traits(race).plural, realms: ruled.map((n) => n.id), vassals, share: cells / land };
  });
}

/** News about a people: its last realm fell, or it rules again. */
export interface PeopleChange {
  race: PlayableRace;
  kind: "lastOfRace" | "raceReturns";
  /** The realm that fell last, or the one that rose (missing if none can be named). */
  nation?: Nation;
  /** The most land the race's realms ever held together (share of the land, 0..1): how much the news matters. */
  peak: number;
}

/** The line for the banner and the chronicle. */
export function peopleNews(change: PeopleChange): string {
  const folk = traits(change.race).plural;
  if (change.kind === "raceReturns") {
    return change.nation ? `The ${folk} rule again: ${change.nation.name} rises.` : `The ${folk} rule again.`;
  }
  return change.nation ? `${change.nation.name} falls, and with it the last realm of the ${folk}.` : `The last realm of the ${folk} is gone.`;
}

export interface PeoplesWatch {
  /** Call after each simulated year. Returns the peoples that lost their last realm, or returned, this year. */
  noteYear(state: WorldState, land: number): PeopleChange[];
  /** The year a race lost its last realm, if it rules nowhere now. */
  fellIn(race: PlayableRace): number | undefined;
}

export function createPeoplesWatch(): PeoplesWatch {
  // How many realms each race ruled last year; empty until the first year has been seen.
  let before: Map<PlayableRace, number> | null = null;
  const peaks = new Map<PlayableRace, number>();
  const fell = new Map<PlayableRace, number>();

  return {
    noteYear(state, land) {
      const changes: PeopleChange[] = [];
      const now = new Map<PlayableRace, number>();
      for (const row of peoples(state, land)) {
        now.set(row.race, row.realms.length);
        const peak = Math.max(peaks.get(row.race) ?? 0, row.share);
        peaks.set(row.race, peak);
        const had = before?.get(row.race);
        if (had === undefined) continue;
        if (had > 0 && row.realms.length === 0) {
          fell.set(row.race, state.year);
          // The realm that went last: one of this race that fell this year (the largest id if several did).
          const last = [...state.nations.values()].filter((n) => !n.alive && n.race === row.race && n.fell === state.year).pop();
          changes.push({ race: row.race, kind: "lastOfRace", nation: last, peak });
        } else if (had === 0 && row.realms.length > 0 && fell.has(row.race)) {
          // Only a race seen to fall can return: one that never ruled yet is simply new.
          fell.delete(row.race);
          changes.push({ race: row.race, kind: "raceReturns", nation: state.nations.get(row.realms[0]!), peak });
        }
      }
      before = now;
      return changes;
    },
    fellIn: (race) => fell.get(race),
  };
}

/** A people's change as news for the headlines. */
export function peopleExtra(change: PeopleChange, year: number): ExtraNews {
  const event: SimEvent = { year, type: change.kind === "lastOfRace" ? "collapse" : "founded", actors: change.nation ? [change.nation.id] : [], text: `Year ${year}: ${peopleNews(change)}` };
  return { event, kind: change.kind, share: change.peak };
}
