import { describe, expect, it } from "vitest";
import { cellPhase, hotCells, restlessCells, siegeCells } from "../src/render/changes";
import { makeNation, makeState, row } from "./tinyWorld";

describe("siegeCells", () => {
  it("lists cells under siege, but not ones already taken", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0)]);
    state.state.siege[1] = 0.5;
    state.state.siege[2] = 0.5;
    state.state.occupier[2] = 2;
    expect(siegeCells(state)).toEqual([1]);
  });
});

describe("hotCells", () => {
  it("lists owned cells at or above the threshold", () => {
    // 0.75, not 0.7: a Float32Array stores 0.7 as 0.69999999, just under the line.
    const values = Float32Array.from([0.9, 0.2, 0.75, 0.9, 0, 0.8]);
    const owner = Int32Array.from([1, 1, 1, 0, 2, 2]); // cell 3 is hot but nobody's
    expect(hotCells(values, owner, 0.7)).toEqual([0, 2, 5]);
  });
});

describe("restlessCells", () => {
  it("only picks restless land in nations unstable enough to rebel", () => {
    const state = makeState(row(6), [1, 1, 1, 2, 2, 2], [makeNation(1, 0, { stability: 0.1 }), makeNation(2, 3, { stability: 0.9 })]);
    state.state.unrest.fill(0.95);
    state.state.unrest[1] = 0.5; // calm, even though nation 1 is shaky
    // Density 1 keeps every match: cells 0 and 2 (nation 2 is stable, cell 1 is calm).
    expect(restlessCells(state, 0.9, 0.25, 1)).toEqual([0, 2]);
  });
});

describe("cellPhase", () => {
  it("gives each cell a steady value between 0 and 1", () => {
    for (let c = 0; c < 100; c++) {
      expect(cellPhase(c)).toBeGreaterThanOrEqual(0);
      expect(cellPhase(c)).toBeLessThan(1);
      expect(cellPhase(c)).toBe(cellPhase(c));
    }
  });
});
