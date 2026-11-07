// The nation overlay repaints only what changed, so it must always match a full repaint.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { generateWorld } from "../src/gen";
import { buildDisplayCells, groupPixelsByCell } from "../src/render/displayCells";
import { planChart } from "../src/render/atlasChart";
import { createNationOverlay } from "../src/render/overlay";
import { LOOK_ATLAS } from "../src/render/palette";
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

  it("also matches with the parchment look, whose border band reaches further into a cell", () => {
    const { world, state } = generateWorld("overlay");
    const display = buildDisplayCells(world);
    const groups = groupPixelsByCell(display, world.cells.length);
    const kept = createNationOverlay(world, display, groups, LOOK_ATLAS);
    const rng = createRng("overlay").fork("sim");

    kept.update(state);
    for (let year = 1; year <= 60; year++) {
      tick(state, rng);
      kept.update(state);
    }
    const fresh = createNationOverlay(world, display, groups, LOOK_ATLAS);
    fresh.update(state);
    let different = 0;
    for (let i = 0; i < fresh.pixels.length; i++) if (fresh.pixels[i] !== kept.pixels[i]) different++;
    expect(different).toBe(0);
  }, 60_000);
});

describe("the parchment chart", () => {
  it("puts the compass rose and sailing hub at sea, and the title panel on the map", () => {
    const { world } = generateWorld("overlay");
    const chart = planChart(world);
    const { heightmap, width, height } = world;
    for (const [x, y] of [chart.rose, chart.sailingHub]) expect(heightmap.data[y * width + x]!).toBeLessThanOrEqual(heightmap.seaLevel);
    expect(chart.panelX).toBeGreaterThanOrEqual(0);
    expect(chart.panelY).toBeGreaterThanOrEqual(0);
    expect(chart.panelX).toBeLessThan(width);
    expect(chart.panelY).toBeLessThan(height);
  });
  it("draws the played realm's border heavier, only on its own land, and still matches a full paint", () => {
    const { world, state } = generateWorld("overlay");
    const display = buildDisplayCells(world);
    const groups = groupPixelsByCell(display, world.cells.length);
    const played = [...state.nations.keys()][0]!;
    const kept = createNationOverlay(world, display, groups, LOOK_ATLAS);
    const rng = createRng("overlay").fork("sim");
    kept.update(state, new Set(), "nation", played);
    for (let year = 1; year <= 60; year++) {
      tick(state, rng);
      kept.update(state, new Set(), "nation", played);
    }
    const fresh = createNationOverlay(world, display, groups, LOOK_ATLAS);
    fresh.update(state, new Set(), "nation", played);
    const plain = createNationOverlay(world, display, groups, LOOK_ATLAS);
    plain.update(state);
    let wrong = 0;
    let heavier = 0;
    for (let i = 0; i < fresh.pixels.length; i++) {
      if (fresh.pixels[i] !== kept.pixels[i]) wrong++;
      if (fresh.pixels[i] === plain.pixels[i]) continue;
      heavier++;
      expect(state.state.owner[display[i]!]).toBe(played); // nobody else's pixels change
    }
    expect(wrong).toBe(0);
    expect(heavier).toBeGreaterThan(0);
  }, 60_000);
});
