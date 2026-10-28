// Seeded random number generator.
// The same seed always produces the same sequence of numbers, which is what
// makes a world's history repeatable. Never use Math.random() in this project.

export interface Rng {
  /** A random number from 0 (inclusive) to 1 (exclusive). */
  next(): number;
  /** A random number from min (inclusive) to max (exclusive). */
  range(min: number, max: number): number;
  /** A random whole number from min to max, both inclusive. */
  int(min: number, max: number): number;
  /** True with the given probability (0..1). */
  chance(probability: number): boolean;
  /** A random item from a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /**
   * A separate, named stream of numbers, e.g. rng.fork("war").
   * Each fork depends only on the seed and the name, so drawing more numbers
   * in one system never changes the numbers another system gets.
   */
  fork(name: string): Rng;
}

// Turns a text seed into a 32-bit number (FNV-1a hash).
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Mulberry32: a small, fast generator. Each call scrambles the state and
// returns the next number in the sequence.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const next = mulberry32(hashString(seed));

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: (items) => {
      if (items.length === 0) throw new Error("pick() needs at least one item");
      return items[Math.floor(next() * items.length)]!;
    },
    fork: (name) => createRng(`${seed}/${name}`),
  };
}
