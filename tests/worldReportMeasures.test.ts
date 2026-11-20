// The small counting rules behind the world report's empire measures (tests/worldReport.ts).
import { describe, expect, it } from "vitest";
import type { WarRecord } from "../src/core/types";
import { countSuccessors, largeRealmsConquered, serviceEnd } from "./worldReport";

describe("countSuccessors", () => {
  // Ten cells the empire (realm 1, with vassal 2) held at its height; who owns each now.
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  it("counts realms outside the crown that hold enough of the old land", () => {
    const owner = [1, 2, 3, 3, 3, 4, 4, 5, 0, 0];
    // Realms 3 (3 cells) and 4 (2 cells) hold at least 20%; realm 5 holds too little.
    expect(countSuccessors(owner, cells, new Set([1, 2]), 0.2)).toBe(2);
  });

  it("does not count the empire itself, its vassals or empty land", () => {
    const owner = [1, 1, 1, 2, 2, 2, 0, 0, 0, 0];
    expect(countSuccessors(owner, cells, new Set([1, 2]), 0.1)).toBe(0);
  });

  it("counts a vassal that has broken free", () => {
    const owner = [1, 1, 1, 2, 2, 2, 0, 0, 0, 0];
    expect(countSuccessors(owner, cells, new Set([1]), 0.1)).toBe(1);
  });
});

describe("serviceEnd", () => {
  it("tells the five ways a vassal stops serving apart", () => {
    expect(serviceEnd(false, true, false, false)).toBe("absorbed");
    expect(serviceEnd(true, false, false, false)).toBe("overlordFell");
    expect(serviceEnd(true, true, true, false)).toBe("changedCrown");
    expect(serviceEnd(true, true, false, true)).toBe("revolt");
    expect(serviceEnd(true, true, false, false)).toBe("letGo");
  });
});

describe("world endings", () => {
  it("counts whole annexations exactly at 5%, including allies, and excludes partial victories", () => {
    const record: WarRecord = { id: 1, start: 1, attacker: 1, defender: 2, allies: [], goal: "conquer",
      scores: [], battles: [], fallen: { attack: 0, defend: 0 }, moments: [],
      outcome: { how: "goal", raid: false, winner: 1, cells: 5, wholeRealm: true, text: "" } };
    expect(largeRealmsConquered([record], 100)).toBe(1);
    record.outcome!.wholeRealm = false;
    record.alliedAnnexations = [4, 5, 6];
    expect(largeRealmsConquered([record], 100)).toBe(2);
  });
});
