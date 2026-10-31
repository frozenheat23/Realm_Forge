// Faiths (SPEC §4.14): table lookups, and which faith a people starts with.
import type { FaithId, FaithInfo, FaithKind, RaceHome, RaceId } from "../core/types";
import { FAITHS } from "./params";
import { traits } from "./races";

/** A faith's row in the table. Takes a plain number because per-cell faiths are stored in a Uint8Array. */
export function faithInfo(faith: number): FaithInfo {
  return FAITHS[faith as FaithKind];
}

/** The faith of a people of `race` at (x, y): each of the race's homelands holds the next of its faiths, and the nearest one counts. */
export function faithAt(homes: RaceHome[], race: RaceId, x: number, y: number): FaithId {
  const own = homes.filter((h) => h.race === race);
  let nearest = 0;
  let best = Infinity;
  own.forEach((home, i) => {
    const d = (home.at[0] - x) ** 2 + (home.at[1] - y) ** 2;
    if (d < best) [best, nearest] = [d, i];
  });
  const faiths = traits(race).faiths;
  return faiths[nearest % faiths.length]!;
}
