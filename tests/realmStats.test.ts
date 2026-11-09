import { describe, expect, it } from "vitest";
import { Race } from "../src/core/types";
import { realmSizes } from "../src/ui/realmStats";
import { makeNation, makeState, row } from "./tinyWorld";

describe("the Play tab's demographics", () => {
  it("counts inhabitants at year zero without relying on placeholders or changing history", () => {
    const nation = makeNation(1, 0, { race: Race.Human, foreignShare: 0 });
    const state = makeState(row(3), [1, 1, 0], [nation], [10, 30, 100], [Race.Human, Race.Orc, Race.None]);
    const before = structuredClone(state);
    expect(realmSizes(state).get(1)).toEqual({ cells: 2, pop: 40, unrest: 0, foreignShare: 0.75 });
    expect(state).toEqual(before);
  });

  it("reflects a conquest immediately, before the next yearly totals update", () => {
    const state = makeState(row(2), [1, 2], [makeNation(1, 0), makeNation(2, 1, { race: Race.Orc })], [10, 30]);
    state.year = 50;
    state.state.owner[1] = 1;
    expect(realmSizes(state).get(1)?.foreignShare).toBe(0.75);
    expect(realmSizes(state).has(2)).toBe(false);
  });

  it("handles an owned cell with no inhabitants without NaN", () => {
    const state = makeState(row(1), [1], [makeNation(1, 0)], [0]);
    expect(realmSizes(state).get(1)?.foreignShare).toBe(0);
  });
});
