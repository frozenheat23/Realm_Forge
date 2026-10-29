import { describe, expect, it } from "vitest";
import { cellPhase, findBattles, hotCells, restlessCells } from "../src/render/changes";
import { pairKey } from "../src/sim/helpers";
import { makeCells, makeNation, makeState, row } from "./tinyWorld";

// A row of 6 cells: [0]-[1]-[2]-[3]-[4]-[5], each 10 px apart.
const cells = makeCells(row(6));

describe("findBattles", () => {
  it("groups cells taken in a war by winner, at their average position", () => {
    const before = Int32Array.from([1, 1, 1, 2, 2, 2]);
    const after = Int32Array.from([1, 1, 1, 1, 1, 2]); // nation 1 took cells 3 and 4
    const battles = findBattles(cells, before, after, new Set([pairKey(1, 2)]));
    expect(battles).toHaveLength(1);
    expect(battles[0]).toMatchObject({ winner: 1, loser: 2, cells: [3, 4], x: 35 });
  });

  it("ignores land changing hands without a war (rebellion, settling)", () => {
    const before = Int32Array.from([1, 1, 0, 2, 2, 2]);
    const after = Int32Array.from([1, 1, 1, 3, 3, 2]); // 1 settles cell 2, nation 3 rebels from 2
    expect(findBattles(cells, before, after, new Set([pairKey(1, 2)]))).toEqual([]);
  });

  it("keeps each side's gains separate when both advance", () => {
    const before = Int32Array.from([1, 1, 1, 2, 2, 2]);
    const after = Int32Array.from([1, 2, 1, 1, 2, 2]);
    const battles = findBattles(cells, before, after, new Set([pairKey(1, 2)]));
    expect(battles.map((b) => b.winner).sort()).toEqual([1, 2]);
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
