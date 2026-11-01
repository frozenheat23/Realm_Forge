// The nation overlay repaints only what changed, so it must always match a full repaint.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { generateWorld } from "../src/gen";
import { buildDisplayCells, groupPixelsByCell } from "../src/render/displayCells";
import { createNationOverlay } from "../src/render/overlay";
import { tick } from "../src/sim/tick";

describe("groupPixelsByCell", () => {
  it("lists every drawn pixel under its cell", () => {
    const display = Int32Array.from([1, 0, -1, 1, 2]);
    const { start, pixels } = groupPixelsByCell(display, 3);
    expect([...start]).toEqual([0, 1, 3, 4]);
    expect([...pixels]).toEqual([1, 0, 3, 4]);
  });
});

describe("the nation overlay", () => {
  it("matches a fresh full paint, pixel for pixel, through a history and a change of tint", () => {
    const { world, state } = generateWorld("overlay");
    const display = buildDisplayCells(world);
    const groups = groupPixelsByCell(display, world.cells.length);
    const kept = createNationOverlay(world, display, groups);
    const rng = createRng("overlay").fork("sim");

    const expectSameAsFresh = (year: number, tint?: "faith") => {
      const fresh = createNationOverlay(world, display, groups);
      fresh.update(state, new Set(), tint);
      let different = 0;
      for (let i = 0; i < fresh.pixels.length; i++) if (fresh.pixels[i] !== kept.pixels[i]) different++;
      expect(different, `pixels wrong in year ${year}`).toBe(0);
    };

    kept.update(state);
    for (let year = 1; year <= 120; year++) {
      tick(state, rng);
      kept.update(state, new Set(), year > 100 ? "faith" : "nation");
      if (year % 20 === 0) expectSameAsFresh(year, year > 100 ? "faith" : undefined);
    }
  }, 60_000);
});
