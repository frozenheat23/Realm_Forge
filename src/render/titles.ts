// Realm titles (SPEC §5.4r): "Kingdom of", "Empire of", "March of". A title is worked out
// from the map each year and never stored in the world, so it cannot change history.
import { Race, type Nation, type NationId, type RaceId, type WorldState } from "../core/types";
import { TITLE_EMPIRE_SHARE, TITLE_FALL_YEARS, TITLE_KINGDOM_SHARE } from "./palette";

/** How grand a realm is: 0 = duchy, 1 = kingdom, 2 = empire. */
export type Rank = 0 | 1 | 2;

/** Each race's word for the three ranks (small → great), and for a realm that serves an overlord. */
const TITLE_WORDS: Record<RaceId, { ranks: [string, string, string]; vassal: string }> = {
  [Race.None]: { ranks: ["Duchy", "Kingdom", "Empire"], vassal: "March" },
  [Race.Human]: { ranks: ["Duchy", "Kingdom", "Empire"], vassal: "March" },
  [Race.LightElf]: { ranks: ["Grove", "Court", "High Court"], vassal: "Ward" },
  [Race.DarkElf]: { ranks: ["House", "Dominion", "Imperium"], vassal: "Thrall-House" },
  [Race.Dwarf]: { ranks: ["Hold", "Kingdom", "High Kingdom"], vassal: "Sworn Hold" },
  [Race.Orc]: { ranks: ["Clan", "Horde", "Great Horde"], vassal: "Tribute Clan" },
};

/** The rank a share of the land (0..1) earns today. */
export function rankFor(share: number): Rank {
  if (share >= TITLE_EMPIRE_SHARE) return 2;
  return share >= TITLE_KINGDOM_SHARE ? 1 : 0;
}

/** "Kingdom", "Great Horde", or the vassal's word if the realm serves a living overlord. */
export function titleWord(nation: Nation, rank: Rank, isVassal: boolean): string {
  const words = TITLE_WORDS[nation.race];
  return isVassal ? words.vassal : words.ranks[rank];
}

/** "an Empire", "a Horde". */
export function withArticle(word: string): string {
  return `${/^[AEIOU]/.test(word) ? "an" : "a"} ${word}`;
}

/** Does this realm serve an overlord that still lives? */
export function isVassal(state: WorldState, nation: Nation): boolean {
  return nation.overlord !== undefined && state.nations.get(nation.overlord)?.alive === true;
}

/**
 * Every living realm's share of the land (0..1). A crown's share includes its vassals' land;
 * a vassal's is its own. Counted on the map, because a realm's stored area is 0 before the first year.
 */
export function crownShares(state: WorldState, land: number): Map<NationId, number> {
  const cells = new Map<NationId, number>();
  for (const id of state.state.owner) if (id !== 0) cells.set(id, (cells.get(id) ?? 0) + 1);
  const shares = new Map<NationId, number>();
  for (const nation of state.nations.values()) {
    if (nation.alive) shares.set(nation.id, (cells.get(nation.id) ?? 0) / land);
  }
  for (const nation of state.nations.values()) {
    if (!nation.alive || !isVassal(state, nation)) continue;
    shares.set(nation.overlord!, (shares.get(nation.overlord!) ?? 0) + (cells.get(nation.id) ?? 0) / land);
  }
  return shares;
}

/** A realm whose rank went up or down this year. */
export interface RankChange {
  nation: Nation;
  from: Rank;
  to: Rank;
  /** Its share of the land now. */
  share: number;
}

export interface Titles {
  /** Call after each simulated year. Returns the realms whose rank changed. */
  noteYear(state: WorldState): RankChange[];
  /** A realm's rank now. A realm not seen yet is judged by its size today. */
  rankOf(state: WorldState, nation: Nation): Rank;
}

/** Remembers each realm's rank. A rank rises at once and falls only after TITLE_FALL_YEARS below it. `land` = land cells on the map. */
export function createTitles(land: number): Titles {
  const ranks = new Map<NationId, Rank>();
  // The first year each realm was found too small for its rank.
  const smallSince = new Map<NationId, number>();
  let shares = new Map<NationId, number>();

  return {
    noteYear(state) {
      shares = crownShares(state, land);
      const changes: RankChange[] = [];
      for (const [id, share] of shares) {
        const nation = state.nations.get(id)!;
        const earned = rankFor(share);
        const held = ranks.get(id);
        if (held === undefined || earned === held) {
          ranks.set(id, earned);
          smallSince.delete(id);
          continue;
        }
        if (earned < held) {
          const since = smallSince.get(id) ?? state.year;
          smallSince.set(id, since);
          if (state.year - since < TITLE_FALL_YEARS) continue;
        }
        ranks.set(id, earned);
        smallSince.delete(id);
        changes.push({ nation, from: held, to: earned, share });
      }
      return changes;
    },

    rankOf(state, nation) {
      const held = ranks.get(nation.id);
      if (held !== undefined) return held;
      if (shares.size === 0) shares = crownShares(state, land);
      return rankFor(shares.get(nation.id) ?? 0);
    },
  };
}

/** The headline for a realm that became an empire, or stopped being one. Other rank changes make no news. */
export function rankNews(change: RankChange): string | null {
  const { nation, from, to } = change;
  if (to === 2) return `${nation.name} is proclaimed ${withArticle(titleWord(nation, 2, false))}.`;
  if (from === 2) return `The ${titleWord(nation, 2, false)} of ${nation.name} is no more: it is ${withArticle(titleWord(nation, to, false))} again.`;
  return null;
}
