// Underdog defense (M18 part 2, docs/systems/realwar.md): a defender who holds out can win.
import { describe, expect, it } from "vitest";
import type { War, WorldState } from "../src/core/types";
import { everyoneAI } from "../src/sim/ai/default";
import { loseSoldiers, updateManpower } from "../src/sim/manpower";
import { SIM } from "../src/sim/params";
import { updateStability } from "../src/sim/stability";
import { endWars } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

// Nation 1 owns cells 0–4, nation 2 owns 5–9. Nation 1 attacks, wanting cells 5 and 6.
function invasion(): { state: WorldState; war: War } {
  const state = makeState(row(10), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], [makeNation(1, 0, { reserve: 10 }), makeNation(2, 9, { reserve: 10 })]);
  const war: War = { id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "conquer", goalCells: [5, 6] };
  state.wars.push(war);
  return { state, war };
}

describe("underdog defense", () => {
  it("each year the attacker takes nothing counts for the defender", () => {
    const { state, war } = invasion();
    for (let year = 1; year <= 3; year++) {
      state.year = year;
      endWars(state, everyoneAI);
    }
    expect(war.heldOff).toBe(3);
    expect(war.score).toBe(-3 * SIM.HOLD_SCORE);
  });

  it("the attacker gets its first year to march in", () => {
    const { state, war } = invasion();
    endWars(state, everyoneAI); // still year 0, the year it began
    expect(war.heldOff ?? 0).toBe(0);
  });

  it("holding a goal cell stops the count", () => {
    const { state, war } = invasion();
    state.year = 1;
    state.state.occupier[5] = 1;
    endWars(state, everyoneAI);
    expect(war.heldOff ?? 0).toBe(0);
    expect(war.score).toBeGreaterThan(0);
  });

  it("a people defending their homes tire slower than the attacker", () => {
    const { state } = invasion();
    const [attacker, defender] = [state.nations.get(1)!, state.nations.get(2)!];
    updateStability(state);
    expect(defender.warWeariness).toBeCloseTo(attacker.warWeariness * SIM.DEFEND_WEARINESS);
    attacker.manpowerCap = defender.manpowerCap = 10;
    const [a0, d0] = [attacker.warWeariness, defender.warWeariness];
    loseSoldiers(state, attacker, 2);
    loseSoldiers(state, defender, 2);
    expect(defender.warWeariness - d0).toBeCloseTo((attacker.warWeariness - a0) * SIM.DEFEND_WEARINESS);
  });

  it("an invaded realm rallies: its reserve refills faster", () => {
    const { state } = invasion();
    state.year = 100;
    const [attacker, defender] = [state.nations.get(1)!, state.nations.get(2)!];
    attacker.reserve = defender.reserve = 0;
    updateManpower(state, attacker, 100);
    updateManpower(state, defender, 100);
    expect(defender.reserve).toBeCloseTo(attacker.reserve * SIM.RALLY_REFILL);
  });

  it("an attacker driven off pays for it", () => {
    const { state, war } = invasion();
    state.year = 5;
    war.battleScore = -2 * SIM.PEACE_SCORE; // the defender has won every battle
    const [attacker, defender] = [state.nations.get(1)!, state.nations.get(2)!];
    const [a0, d0] = [attacker.stability, defender.stability];
    const [event] = endWars(state, everyoneAI);
    expect(event!.text).toContain(`${defender.name} drives off ${attacker.name}`);
    expect(attacker.stability).toBeLessThan(a0);
    expect(defender.stability).toBeGreaterThanOrEqual(d0);
  });
});
