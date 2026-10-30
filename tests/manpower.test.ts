import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { battleLosses, loseSoldiers, updateManpower } from "../src/sim/manpower";
import { SIM } from "../src/sim/params";
import { fightBattle } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

describe("manpower", () => {
  it("a new nation starts with a full reserve", () => {
    const state = makeState(row(2), [1, 1], [makeNation(1, 0)]);
    state.year = 1;
    const nation = state.nations.get(1)!;
    updateManpower(state, nation, 50);
    expect(nation.manpowerCap).toBeCloseTo(50 * SIM.LEVY_SHARE);
    expect(nation.reserve).toBeCloseTo(nation.manpowerCap);
  });

  it("refills slowly, and more slowly when unstable", () => {
    const refill = (stability: number) => {
      const state = makeState(row(2), [1, 1], [makeNation(1, 0, { stability })]);
      state.year = 100; // long after founding
      const nation = state.nations.get(1)!;
      updateManpower(state, nation, 100);
      return nation.reserve;
    };
    const stable = refill(1);
    const shaky = refill(0);
    const cap = 100 * SIM.LEVY_SHARE;
    expect(stable).toBeCloseTo(cap * SIM.LEVY_REFILL * 1.5);
    expect(shaky).toBeLessThan(stable);
  });

  it("losses shrink the reserve and add war weariness", () => {
    const nation = makeNation(1, 0, { reserve: 10, manpowerCap: 10 });
    const state = makeState(row(1), [1], [nation]);
    loseSoldiers(state, nation, 4);
    expect(nation.reserve).toBeCloseTo(6);
    expect(nation.warWeariness).toBeCloseTo(0.4 * SIM.WEARINESS_LOSS_K);
    loseSoldiers(state, nation, 100); // can't lose more than it has
    expect(nation.reserve).toBe(0);
  });

  it("a crushing win kills more of the loser and fewer of the winner", () => {
    const even = battleLosses(1);
    const crushing = battleLosses(3);
    expect(crushing.loser).toBeGreaterThan(even.loser);
    expect(crushing.winner).toBeLessThan(even.winner);
    expect(battleLosses(100).loser).toBe(SIM.BATTLE_MAX_LOSS);
  });

  it("a year of war costs both sides soldiers", () => {
    const state = makeState(row(10), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], [
      makeNation(1, 0, { reserve: 10, manpowerCap: 10 }),
      makeNation(2, 9, { reserve: 10, manpowerCap: 10 }),
    ]);
    const war = { id: 1, attacker: 1, defender: 2, startYear: 0, score: 0 };
    state.wars.push(war);
    fightBattle(state, war, createRng("losses"));
    const left = [state.nations.get(1)!.reserve, state.nations.get(2)!.reserve].sort((a, b) => a - b);
    expect(left[1]!).toBeLessThan(10); // the winner lost a few
    expect(left[0]!).toBeLessThan(left[1]!); // the loser lost more
  });
});
