// Realm colors (src/gen/nations.ts): every realm's color sits in its ruling race's family.
import { describe, expect, it } from "vitest";
import { nationColor } from "../src/gen/nations";
import { RACE_HUES } from "../src/gen/params";
import { PLAYABLE_RACES } from "../src/gen/races";

/** The hue (0..360) of a "#rrggbb" color. */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  const sixth = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return (sixth * 60 + 360) % 360;
}

describe("nationColor", () => {
  it("keeps every realm inside its race's family of hues", () => {
    for (const race of PLAYABLE_RACES) {
      const [first, last] = RACE_HUES[race]!;
      for (let id = 1; id <= 200; id++) {
        const hue = hueOf(nationColor(123, id, race));
        // Rounding to whole color steps can move a hue by a degree or so.
        expect(hue).toBeGreaterThan(first - 2);
        expect(hue).toBeLessThan(last + 2);
      }
    }
  });

  it("gives the families hues that don't overlap", () => {
    const bands = PLAYABLE_RACES.map((race) => RACE_HUES[race]!).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < bands.length; i++) expect(bands[i]![0]).toBeGreaterThan(bands[i - 1]![1]);
  });

  it("gives realms of one race different colors", () => {
    const colors = new Set(Array.from({ length: 12 }, (_, i) => nationColor(40, i + 1, 5)));
    expect(colors.size).toBe(12);
  });

  it("gives the same realm the same color every time", () => {
    expect(nationColor(40, 7, 1)).toBe(nationColor(40, 7, 1));
  });
});
