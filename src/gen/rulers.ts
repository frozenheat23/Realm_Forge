// Rulers (docs/systems/rulers.md): naming them, how long they reign, and what they're called.
import type { Rng } from "../core/rng";
import type { RaceId, Ruler } from "../core/types";
import { RULER_NAMES } from "./nameCorpus";
import { buildChain, generateName, type NameChain } from "./names";
import { REIGN_SPREAD, RULER_TITLES } from "./params";
import { traits } from "./races";

// Building a chain is slow and rulers are crowned often, so each list's is kept.
const chains = new Map<string[], NameChain>();

function personalName(rng: Rng, examples: string[]): string {
  let chain = chains.get(examples);
  if (!chain) {
    chain = buildChain(examples);
    chains.set(examples, chain);
  }
  return generateName(rng, chain, new Set(), examples);
}

/** "House Varrin" for a race and a made-up surname. */
export function dynastyName(race: RaceId, surname: string): string {
  return `${traits(race).dynastyWord} ${surname}`;
}

/** A new ruler of `race`, crowned in `year`. */
export function makeRuler(rng: Rng, race: RaceId, year: number, dynasty: string): Ruler {
  const t = traits(race);
  const female = rng.chance(t.femaleChance);
  const names = RULER_NAMES[t.family];
  const reign = t.reign * rng.range(1 - REIGN_SPREAD, 1 + REIGN_SPREAD);
  const name = personalName(rng, female ? names.female : names.male);
  // A stream of its own, so adding boldness (M18) changed no ruler's name or reign. It's named
  // after the ruler: a fork depends only on its name, so one shared name would give everyone the same temper.
  const boldness = Math.exp(rng.fork(`temper-${dynasty}-${name}-${year}`).range(-t.temper, t.temper));
  return { name, dynasty, female, crowned: year, ends: year + Math.max(1, Math.round(reign)), boldness };
}

/** Starts a ruler partway through their reign, so a world's first rulers don't all die together. */
export function midReign(rng: Rng, ruler: Ruler): Ruler {
  const served = rng.int(0, ruler.ends - ruler.crowned - 1);
  return { ...ruler, crowned: ruler.crowned - served, ends: ruler.ends - served };
}

/** "High Queen Selena". */
export function rulerName(ruler: Ruler, race: number): string {
  const [male, female] = RULER_TITLES[race as keyof typeof RULER_TITLES][ruler.great ?? 0]!;
  return `${ruler.female ? female : male} ${ruler.name}`;
}
