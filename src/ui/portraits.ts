// Which portrait image shows for a ruler. Files live in public/portraits (made by scripts/portraits.py).
import { Race, RulerType, type RaceId, type Ruler, type RulerTypeId } from "../core/types";

/** Short race names used in the file names. */
const RACE_SLUGS: Record<RaceId, string> = {
  [Race.None]: "human",
  [Race.Human]: "human",
  [Race.LightElf]: "lelf",
  [Race.DarkElf]: "delf",
  [Race.Dwarf]: "dwarf",
  [Race.Orc]: "orc",
};

/** Great ruler types as they appear in the file names. */
const TYPE_SLUGS: Record<RulerTypeId, string> = {
  [RulerType.Conqueror]: "conqueror",
  [RulerType.Lawgiver]: "lawgiver",
  [RulerType.Builder]: "builder",
  [RulerType.Prophet]: "prophet",
  [RulerType.Schemer]: "schemer",
};

/** Orcs and Dwarves only have men's portraits, since the game never crowns their women (yet). */
const HAS_WOMEN = new Set<RaceId>([Race.Human, Race.LightElf, Race.DarkElf]);

/** "portraits/delf-f-schemer.webp" for a great Dark Elf Matron. */
export function portraitPath(race: RaceId, ruler: Ruler): string {
  const gender = ruler.female && HAS_WOMEN.has(race) ? "f" : "m";
  const kind = ruler.great === undefined ? "ordinary" : TYPE_SLUGS[ruler.great];
  return `portraits/${RACE_SLUGS[race]}-${gender}-${kind}.webp`;
}

/** The same ruler's ordinary portrait: shown if a great one's image is missing. */
export function fallbackPath(race: RaceId, ruler: Ruler): string {
  return portraitPath(race, { ...ruler, great: undefined });
}
