// Makes up nation names that sound like a culture, using a Markov chain.
//
// A Markov chain learns "which letter tends to follow these two letters" from
// example names, then builds new names one letter at a time using those odds.
import type { Rng } from "../core/rng";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, NAME_ORDER } from "./params";

const START = "^"; // marks the start of a name
const END = "$"; // marks the end of a name

/** For each run of NAME_ORDER letters, every letter seen after it (repeats = more likely). */
export type NameChain = Map<string, string[]>;

export function buildChain(examples: string[]): NameChain {
  const chain: NameChain = new Map();
  for (const name of examples) {
    const padded = START.repeat(NAME_ORDER) + name.toLowerCase() + END;
    for (let i = NAME_ORDER; i < padded.length; i++) {
      const context = padded.slice(i - NAME_ORDER, i);
      const followers = chain.get(context) ?? [];
      followers.push(padded[i]!);
      chain.set(context, followers);
    }
  }
  return chain;
}

/** Walks the chain to make one name, or returns null if it came out too short or long. */
function tryGenerate(rng: Rng, chain: NameChain): string | null {
  let context = START.repeat(NAME_ORDER);
  let name = "";
  while (name.length <= NAME_MAX_LENGTH) {
    const followers = chain.get(context);
    if (!followers) return null;
    const next = rng.pick(followers);
    if (next === END) break;
    name += next;
    context = (context + next).slice(-NAME_ORDER);
  }
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) return null;
  return name[0]!.toUpperCase() + name.slice(1);
}

/**
 * Makes a new name from `chain` that isn't in `taken` (and isn't a copy of an example).
 * Gives up after many tries and adds a number, so it can never loop forever.
 */
export function generateName(rng: Rng, chain: NameChain, taken: Set<string>, examples: string[]): string {
  const banned = new Set(examples.map((e) => e.toLowerCase()));
  for (let attempt = 0; attempt < 200; attempt++) {
    const name = tryGenerate(rng, chain);
    if (name && !taken.has(name) && !banned.has(name.toLowerCase())) {
      taken.add(name);
      return name;
    }
  }
  const fallback = `${rng.pick(examples)} ${taken.size + 1}`;
  taken.add(fallback);
  return fallback;
}
