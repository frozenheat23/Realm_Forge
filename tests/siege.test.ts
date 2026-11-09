import { afterEach, describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { NO_TARGET, Settlement, type Army } from "../src/core/types";
import { AI, everyoneAI } from "../src/sim/ai/default";
import { PLAYER } from "../src/sim/ai/player";
import { campaign } from "../src/sim/armies";
import { pairKey } from "../src/sim/helpers";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { besiege } from "../src/sim/siege";
import { openRecord } from "../src/sim/warRecords";
import { makeNation, makeState, row } from "./tinyWorld";

afterEach(() => Object.assign(SIM, SIM_DEFAULTS));
const hostile = new Set([pairKey(1, 2)]);

function setup(size = 1) {
  const state = makeState(row(5), [1, 1, 2, 2, 2], [makeNation(1, 0, { manpowerCap: 10 }), makeNation(2, 4)], [1, 1, 1, 1, 1]);
  const army: Army = { id: 1, owner: 1, war: 1, cell: 2, size, morale: 1, target: 2, path: [], trail: [], siegeMode: "wait" };
  state.armies.push(army);
  state.state.settlement[0] = Settlement.Town;
  state.state.settlement[2] = Settlement.City;
  state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "conquer", goalCells: [2] });
  openRecord(state, state.wars[0]!);
  return { state, army };
}

describe("simple sieges", () => {
  it("small or demoralized besiegers progress more slowly; waiting can still take a city", () => {
    const strong = setup(1);
    const weak = setup(0.05);
    const shaken = setup(0.05);
    shaken.army.morale = 0.5;
    for (const { state } of [strong, weak, shaken]) besiege(state, hostile);
    expect(strong.state.state.occupier[2]).toBe(0);
    expect(weak.state.state.siege[2]).toBeLessThan(strong.state.state.siege[2]!);
    expect(shaken.state.state.siege[2]).toBeLessThan(weak.state.state.siege[2]!);
    for (let i = 0; i < 20 && strong.state.state.occupier[2] === 0; i++) besiege(strong.state, hostile);
    expect(strong.state.state.occupier[2]).toBe(1);
    expect(strong.army.size).toBe(1); // waiting has no assault losses
  });

  it("cut-off besiegers work more slowly", () => {
    const fed = setup();
    const hungry = setup();
    hungry.state.state.occupier.fill(2, 0, 2);
    besiege(fed.state, hostile);
    besiege(hungry.state, hostile);
    expect(hungry.state.state.siege[2]).toBeLessThan(fed.state.state.siege[2]!);
  });

  it("withdrawal and relief undo pressure, and recovering progress stays in bounds", () => {
    const { state, army } = setup();
    besiege(state, hostile);
    const progress = state.state.siege[2]!;
    state.armies.push({ ...army, id: 2, owner: 2, cell: 3 });
    besiege(state, hostile);
    expect(state.state.siege[2]).toBeCloseTo(Math.max(0, progress - SIM.SIEGE_RECOVERY));
    state.armies = [];
    for (let i = 0; i < 10; i++) besiege(state, hostile);
    expect(state.state.siege[2]).toBe(0);
  });

  it("multiple armies cannot count several seasons of siege work in one season", () => {
    const single = setup();
    const multiple = setup();
    multiple.state.armies.push({ ...multiple.army, id: 2 });
    besiege(single.state, hostile);
    besiege(multiple.state, hostile);
    expect(multiple.state.state.siege[2]).toBe(single.state.state.siege[2]);
  });

  it("an abandoned siege recovers even when no armies remain anywhere", () => {
    const { state } = setup();
    state.armies = [];
    state.state.siege[2] = 0.7;
    campaign(state, createRng("abandoned"), everyoneAI);
    expect(state.state.siege[2]).toBeCloseTo(Math.max(0, 0.7 - SIM.SIEGE_RECOVERY * SIM.CAMPAIGN_STEPS));
  });

  it("assaults can win or fail, always cost soldiers, and record the result", () => {
    let wins = 0;
    for (let i = 0; i < 100; i++) {
      const { state, army } = setup(0.5);
      army.siegeMode = "assault";
      besiege(state, hostile, createRng(`assault-${i}`));
      expect(army.size).toBeCloseTo(0.5 * (1 - SIM.SIEGE_ASSAULT_LOSS));
      expect(state.warRecords[0]!.fallen.attack).toBeCloseTo(0.5 * SIM.SIEGE_ASSAULT_LOSS);
      expect(state.warRecords[0]!.moments.some((m) => m.kind === "assault")).toBe(true);
      if (state.state.occupier[2] === 1) wins++;
      else expect(army.morale).toBeLessThan(1);
    }
    expect(wins).toBeGreaterThan(10);
    expect(wins).toBeLessThan(90);
  });

  it("cautious and bold generals differ on assaulting; player armies use the same choice", () => {
    SIM.ENGAGE_INTEL_ERROR = 0;
    const { state, army } = setup(1);
    army.general = { name: "Test", female: false, skill: 1, wins: 0, since: 0, boldness: 0.5 };
    const rng = createRng("siege-choice");
    expect(AI.orderSiege(state, army, 2, rng)).toBe("wait");
    army.general.boldness = 2;
    expect(AI.orderSiege(state, army, 2, rng)).toBe("assault");
    expect(PLAYER.orderSiege(state, army, 2, rng)).toBe("assault");
    expect(AI.orderSiege(state, army, NO_TARGET, rng)).toBe("wait");
  });

  it("a starving army withdraws, cannot besiege while broken, and rests at home", () => {
    const { state, army } = setup();
    army.morale = SIM.RETREAT_MORALE - 0.01;
    besiege(state, hostile);
    expect(state.state.siege[2]).toBe(0);
    SIM.CAMPAIGN_STEPS = 1;
    campaign(state, createRng("withdraw"), everyoneAI);
    expect(army.cell).toBe(0);
    expect(army.morale).toBeGreaterThan(SIM.RETREAT_MORALE);
  });

  it("a town's fall cannot bypass a neighboring capital or its defending army", () => {
    const { state, army } = setup();
    state.nations.get(2)!.capital = 3;
    state.state.settlement[3] = Settlement.None;
    army.size = 10;
    for (let i = 0; i < 20 && state.state.occupier[2] === 0; i++) besiege(state, hostile);
    expect(state.state.occupier[2]).toBe(1);
    expect(state.state.occupier[3]).toBe(0);
  });
});
