import { afterEach, describe, expect, it } from "vitest";
import { NO_TARGET, type Army } from "../src/core/types";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { supplyStatus, wearDown } from "../src/sim/supply";
import { makeNation, makeState, row } from "./tinyWorld";

afterEach(() => Object.assign(SIM, SIM_DEFAULTS));

function setup() {
  const state = makeState(row(10), [1, 1, 2, 2, 2, 2, 2, 2, 2, 2], [makeNation(1, 0, { manpowerCap: 10 }), makeNation(2, 9)]);
  state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "conquer", goalCells: [9] });
  const army: Army = { id: 1, owner: 1, war: 1, cell: 5, size: 1, morale: 1, target: NO_TARGET, path: [], trail: [] };
  state.armies.push(army);
  return { state, army };
}

describe("campaign supply", () => {
  it("an occupied pocket needs a controlled route; a broken corridor cuts it off", () => {
    const { state, army } = setup();
    state.state.occupier[5] = 1;
    expect(supplyStatus(state, army).connected).toBe(false);
    state.state.occupier.fill(1, 2, 6);
    expect(supplyStatus(state, army)).toEqual({ connected: true, shortage: 0, reinforce: true });
    state.state.occupier[3] = 0;
    expect(supplyStatus(state, army).reinforce).toBe(false);
  });

  it("hostile occupation overrides friendly ownership, and hostile armies block routes", () => {
    const { state, army } = setup();
    army.cell = 0;
    state.state.occupier.fill(2, 0, 2);
    expect(supplyStatus(state, army).connected).toBe(false);
    state.state.occupier.fill(0);
    state.state.occupier.fill(1, 2, 6);
    army.cell = 5;
    state.armies.push({ ...army, id: 2, owner: 2, cell: 3 });
    expect(supplyStatus(state, army).connected).toBe(false);
  });

  it("limits route length and never crosses water or neutral ground", () => {
    const { state, army } = setup();
    state.state.occupier.fill(1, 2, 6);
    SIM.SUPPLY_RANGE = 3;
    expect(supplyStatus(state, army).connected).toBe(false);
    SIM.SUPPLY_RANGE = 4;
    expect(supplyStatus(state, army).connected).toBe(true);
    state.cells[3]!.isLand = false;
    expect(supplyStatus(state, army).connected).toBe(false);
    state.cells[3]!.isLand = true;
    state.nations.set(3, makeNation(3, 3));
    state.state.owner[3] = 3;
    state.state.occupier[3] = 0;
    expect(supplyStatus(state, army).connected).toBe(false);
    state.alliances.push({ a: 1, b: 3, since: 0, renewed: 0 });
    expect(supplyStatus(state, army).connected).toBe(true);
  });

  it("feeds a frontier siege but sends reinforcements only onto controlled ground", () => {
    const { state, army } = setup();
    army.cell = 2;
    expect(supplyStatus(state, army)).toEqual({ connected: true, shortage: 0, reinforce: false });
    state.state.occupier[2] = 1;
    expect(supplyStatus(state, army).reinforce).toBe(true);
  });

  it("foraging helps small hosts on intact land, but cannot replace a route", () => {
    const { state, army } = setup();
    army.size = 0.1;
    const small = supplyStatus(state, army).shortage;
    expect(small).toBeGreaterThan(0);
    army.size = 10;
    expect(supplyStatus(state, army).shortage).toBeGreaterThan(small);
    state.state.devastation[army.cell] = 1;
    expect(supplyStatus(state, army).shortage).toBe(1);
  });

  it("hunger lowers troops and morale, harsh terrain hurts more, and reconnecting permits rest", () => {
    const { state, army } = setup();
    const before = army.size;
    wearDown(state, army);
    const plainLoss = before - army.size;
    expect(plainLoss).toBeGreaterThan(0);
    expect(army.morale).toBeLessThan(1);
    army.size = before;
    state.cells[army.cell]!.mountain = true;
    wearDown(state, army);
    expect(before - army.size).toBeCloseTo(plainLoss * 2);
    const hungryMorale = army.morale;
    state.state.occupier.fill(1, 2, 6);
    const remaining = army.size;
    wearDown(state, army);
    expect(army.size).toBe(remaining);
    expect(army.morale).toBe(hungryMorale); // a fed occupation is not a rest at home
    army.cell = 0;
    wearDown(state, army);
    expect(army.morale).toBeGreaterThan(hungryMorale);
  });
});
