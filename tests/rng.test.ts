import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";

// Draws `count` numbers from a fresh generator.
function sample(seed: string, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
}

describe("createRng", () => {
  it("gives the same numbers for the same seed", () => {
    expect(sample("eldoria", 1000)).toEqual(sample("eldoria", 1000));
  });

  it("gives different numbers for different seeds", () => {
    expect(sample("eldoria", 10)).not.toEqual(sample("kethar", 10));
  });

  it("keeps next() between 0 and 1", () => {
    for (const n of sample("bounds", 10000)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it("keeps int() inside its range, including both ends", () => {
    const rng = createRng("dice");
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("makes forks that don't affect each other", () => {
    const a = createRng("world");
    const b = createRng("world");
    // Use up some numbers from b's "war" stream only.
    const bWar = b.fork("war");
    for (let i = 0; i < 50; i++) bWar.next();
    // The "names" stream must still match between the two.
    expect(a.fork("names").next()).toBe(b.fork("names").next());
  });
});
