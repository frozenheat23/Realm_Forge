// M16: the log folds a year's battles between two nations into one line.
import { describe, expect, it } from "vitest";
import type { BattleReport, SimEvent } from "../src/core/types";
import { peaceEvent } from "../src/sim/events";
import { battleGroupText, groupBattles } from "../src/ui/eventLog";
import { makeNation, makeState, row } from "./tinyWorld";

const battle = (year: number, winner: number, loser: number): SimEvent => ({ year, type: "battle", actors: [winner, loser], text: "" });

describe("battle groups", () => {
  it("one per year and pair, whoever won, with who fell this year", () => {
    const events = [battle(5, 1, 2), battle(5, 2, 1), battle(5, 3, 1), { year: 5, type: "war", actors: [1, 2], text: "" } as SimEvent, battle(4, 1, 2)];
    const reports: BattleReport[] = [
      { cell: 0, winner: 1, loser: 2, lost: 1, routed: false },
      { cell: 0, winner: 2, loser: 1, lost: 2, routed: false },
    ];
    const groups = groupBattles(events, reports, 5);
    expect(groups).toEqual([
      { year: 5, a: 1, b: 2, count: 2, lost: 3 },
      { year: 5, a: 1, b: 3, count: 1 },
      { year: 4, a: 1, b: 2, count: 1 },
    ]);
  });

  it("read as one line", () => {
    const state = makeState(row(2), [1, 2], [makeNation(1, 0, { name: "Kethar" }), makeNation(2, 1, { name: "Velmora" })]);
    expect(battleGroupText({ year: 5, a: 1, b: 2, count: 3 }, state)).toBe("Year 5: 3 battles between Kethar and Velmora.");
    expect(battleGroupText({ year: 5, a: 1, b: 2, count: 1 }, state)).toBe("Year 5: a battle between Kethar and Velmora.");
  });
});

describe("peace text", () => {
  it("says so when a victory took no land", () => {
    const state = makeState(row(2), [1, 2], [makeNation(1, 0, { name: "Kethar" }), makeNation(2, 1, { name: "Velmora" })]);
    const [k, v] = [state.nations.get(1)!, state.nations.get(2)!];
    expect(peaceEvent(7, k, v, k, 0).text).toBe("Year 7: Kethar defeats Velmora, but no land changes hands.");
    expect(peaceEvent(7, k, v, k, 2).text).toBe("Year 7: Kethar defeats Velmora, taking 2 provinces.");
  });
});
