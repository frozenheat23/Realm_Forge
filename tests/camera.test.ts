// Map zoom (M19): the camera's math, and drawing a zoomed view's cells.
import { describe, expect, it } from "vitest";
import { generateWorld } from "../src/gen";
import { clampCamera, lookAt, panBy, toWorld, WHOLE_MAP, zoomAt } from "../src/render/camera";
import { buildDisplayCells, buildViewCells, sampleAt } from "../src/render/displayCells";
import { markScale } from "../src/render/marks";
import { MARK_ZOOM_GROWTH } from "../src/render/palette";

const bounds = { width: 1600, height: 900, maxZoom: 4 };

describe("camera", () => {
  it("zooming keeps the point under the mouse in place", () => {
    const before = toWorld(WHOLE_MAP, 400, 300);
    const zoomed = zoomAt(WHOLE_MAP, 2, 400, 300, bounds);
    expect(zoomed.zoom).toBe(2);
    expect(toWorld(zoomed, 400, 300)).toEqual(before);
  });

  it("stays between the whole map and the closest zoom, and inside the map", () => {
    expect(zoomAt(WHOLE_MAP, 0.5, 100, 100, bounds)).toEqual(WHOLE_MAP);
    expect(zoomAt(WHOLE_MAP, 100, 800, 450, bounds).zoom).toBe(4);
    const corner = clampCamera({ zoom: 2, x: -50, y: 5000 }, bounds);
    expect(corner).toEqual({ zoom: 2, x: 0, y: 450 }); // the bottom edge of the map at the bottom of the screen
  });

  it("dragging moves the map with the mouse", () => {
    const camera = { zoom: 2, x: 400, y: 200 };
    const moved = panBy(camera, 100, -50, bounds);
    expect(moved).toEqual({ zoom: 2, x: 350, y: 225 });
    expect(panBy(WHOLE_MAP, 100, 100, bounds)).toEqual(WHOLE_MAP); // nothing to move at zoom 1
  });

  it("can centre on a point", () => {
    const camera = lookAt(800, 450, 2, bounds);
    expect(toWorld(camera, 800, 450)).toEqual([800, 450]);
  });
});

describe("drawing a zoomed view", () => {
  it("markers grow more slowly than the map", () => {
    expect(markScale(1)).toBe(1);
    expect(4 * markScale(4)).toBeCloseTo(4 ** MARK_ZOOM_GROWTH);
  });

  it("blends a per-pixel map between pixel centres", () => {
    const values = Float32Array.from([0, 1, 2, 3]); // 2 × 2
    expect(sampleAt(values, 2, 2, 0.5, 0.5)).toBe(0);
    expect(sampleAt(values, 2, 2, 1, 0.5)).toBeCloseTo(0.5);
    expect(sampleAt(values, 2, 2, 1, 1)).toBeCloseTo(1.5);
  });

  it("a view grid shows the same cells as the whole map", () => {
    const { world } = generateWorld("camera-test");
    const { width, height } = world;
    const whole = buildDisplayCells(world);
    // At zoom 1 each view pixel samples the centre of its map pixel, so they should agree.
    const view = buildViewCells(world, { width, height, zoom: 1, x: 0, y: 0 });
    let same = 0;
    for (let i = 0; i < whole.length; i++) if (view[i] === whole[i]) same++;
    // Only pixels right on a border can differ (the view finds cells exactly, the map in whole pixels).
    expect(same / whole.length).toBeGreaterThan(0.95);
  });
});
