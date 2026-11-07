// When your realm falls, and the end of a played run (M20 step 5, docs/systems/play.md).
import { describe, expect, it } from "vitest";
import { Race, type WorldState } from "../src/core/types";
import { heirsOf } from "../src/sim/play";
import { giveCommand } from "../src/sim/sandbox";
import { stintsOf, summaryLines } from "../src/ui/summary";
import { makeNation, makeState, row } from "./tinyWorld";

// [1][1] | [2][2] | [3][3] | [4]: 1 is played; 3 is a sister state of 1's people; 4 is another Human realm; 2 are Orcs.
function world(): WorldState {
  const state = makeState(row(7), [1, 1, 2, 2, 3, 3, 4], [
    makeNation(1, 0),
    makeNation(2, 2, { race: Race.Orc }),
    makeNation(3, 4, { culture: 1 }),
    makeNation(4, 6),
  ]);
  giveCommand(state, { kind: "play", nation: 1 });
  return state;
}

describe("when your realm falls", () => {
  it("offers the realms of your people first", () => {
    const state = world();
    state.nations.get(1)!.alive = false;
    expect(heirsOf(state)).toMatchObject({ by: "people", nations: [{ id: 3 }] });
  });

  it("then realms of your race, then nobody", () => {
    const state = world();
    state.nations.get(1)!.alive = false;
    state.nations.get(3)!.alive = false;
    expect(heirsOf(state)).toMatchObject({ by: "race", nations: [{ id: 4 }] });
    state.nations.get(4)!.alive = false;
    expect(heirsOf(state)).toEqual({ by: "none", nations: [] });
  });

  it("carrying on keeps your policies", () => {
    const state = world();
    giveCommand(state, { kind: "setPolicy", policies: { joinWar: "never" } });
    state.nations.get(1)!.alive = false;
    giveCommand(state, { kind: "play", nation: 3 });
    expect(state.player).toMatchObject({ nation: 3, culture: 1, policies: { joinWar: "never" } });
  });
});

describe("the end of a played run", () => {
  it("tells each realm played and what became of it, then your people and race", () => {
    const state = world();
    state.year = 300;
    const first = state.nations.get(1)!;
    first.alive = false;
    first.fell = 300;
    giveCommand(state, { kind: "play", nation: 3 });
    state.year = 1000;
    expect(stintsOf(state)).toEqual([
      { nation: 1, from: 0, to: 300 },
      { nation: 3, from: 300, to: 1000 },
    ]);
    const lines = summaryLines(state);
    expect(lines[0]).toBe("Nation1 (years 0–300): fell in year 300.");
    expect(lines[1]).toContain("Nation3 (years 300–1000): stands at the end with 2 provinces");
    expect(lines[2]).toContain("rule 1 realm: Nation3");
    expect(lines[3]).toMatch(/^The Humans rule \d+% of the land\.$/);
  });
});
