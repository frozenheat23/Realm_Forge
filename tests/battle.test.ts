import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { NO_TARGET, Settlement, type Army } from "../src/core/types";
import { campaign } from "../src/sim/armies";
import { battleEvents, fightBattles, groundBonus } from "../src/sim/battle";
import { pairKey } from "../src/sim/helpers";
import { SIM } from "../src/sim/params";
import { besiege, liberate, releaseOccupations, siegeSteps } from "../src/sim/siege";
import { makeNation, makeState, row } from "./tinyWorld";
import { everyoneAI } from "../src/sim/ai/default";

// Nation 1 owns 0–9, nation 2 owns 10–19, in a row, at war.
function atWar() {
  const owners = Array.from({ length: 20 }, (_, i) => (i < 10 ? 1 : 2));
  const state = makeState(row(20), owners, [
    makeNation(1, 0, { manpowerCap: 10 }),
    makeNation(2, 19, { manpowerCap: 10 }),
  ]);
  state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [] });
  return state;
}

const hostile = new Set([pairKey(1, 2)]);

function army(id: number, owner: number, cell: number, size = 1, morale = 1): Army {
  return { id, owner, war: 1, cell, size, morale, target: NO_TARGET, path: [], trail: [cell] };
}

describe("battles", () => {
  it("armies next to each other fight, the loser losing more", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 9), army(2, 2, 10));
    fightBattles(state, hostile, new Set(), createRng("b"));
    expect(state.battles).toHaveLength(1);
    const { winner, loser } = state.battles[0]!;
    const of = (id: number) => state.armies.find((a) => a.owner === id)!;
    expect(of(loser).size).toBeLessThan(of(winner).size);
    expect(of(loser).morale).toBeCloseTo(1 - SIM.MORALE_LOSS);
    expect(state.state.devastation[state.battles[0]!.cell]).toBeGreaterThan(0);
    expect(state.wars[0]!.battleScore).toBe(winner === 1 ? SIM.BATTLE_SCORE : -SIM.BATTLE_SCORE);
  });

  it("the loser falls back toward home", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 9), army(2, 2, 10));
    fightBattles(state, hostile, new Set(), createRng("back"));
    const { loser } = state.battles[0]!;
    expect(state.armies.find((a) => a.owner === loser)!.cell).toBe(loser === 1 ? 8 : 11);
  });

  it("each army fights once a season", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 9), army(2, 2, 10), army(3, 2, 10));
    fightBattles(state, hostile, new Set(), createRng("once"));
    expect(state.battles).toHaveLength(1);
  });

  it("nations at peace don't fight", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 9), army(2, 2, 10));
    fightBattles(state, new Set(), new Set(), createRng("peace"));
    expect(state.battles).toHaveLength(0);
  });

  it("a broken army is destroyed; some soldiers get home", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 9, 5), army(2, 2, 10, 1, SIM.MORALE_LOSS));
    let tries = 0;
    while (state.armies.every((a) => a.size > 0)) {
      if (tries++ > 50) throw new Error("the battered army never lost");
      state.armies[0]!.morale = 1;
      state.armies[1]!.cell = 10;
      fightBattles(state, hostile, new Set(), createRng(`r${tries}`));
    }
    expect(state.armies[1]!.size).toBe(0);
    expect(state.nations.get(2)!.reserve).toBeGreaterThan(0);
  });

  it("walls and hills help the defender", () => {
    const state = atWar();
    const a = army(1, 1, 5);
    const plain = groundBonus(state, a);
    state.state.settlement[5] = Settlement.City;
    expect(groundBonus(state, a)).toBeCloseTo(plain * (1 + SIM.FORT_BONUS * Settlement.City));
  });
});

describe("sieges", () => {
  it("an unopposed army takes the cell it stands in, without changing its owner", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 15));
    for (let i = 0; i < 20 && state.state.occupier[15] === 0; i++) besiege(state, hostile);
    expect(state.state.occupier[15]).toBe(1);
    expect(state.state.owner[15]).toBe(2);
    expect(state.state.devastation[15]).toBeCloseTo(SIM.DEVASTATION_CAPTURE);
  });

  it("cities and capitals take far longer than open land", () => {
    const state = atWar();
    const open = siegeSteps(state, 15);
    state.state.settlement[15] = Settlement.City;
    expect(siegeSteps(state, 15)).toBeCloseTo(open * (1 + SIM.SIEGE_SETTLEMENT_K * Settlement.City));
    expect(siegeSteps(state, 19)).toBeCloseTo(open * SIM.CAPITAL_SIEGE_MULT);
  });

  it("no siege while an enemy army is near", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 15), army(2, 2, 16));
    besiege(state, hostile);
    expect(state.state.siege[15]).toBe(0);
  });

  it("taking a town brings in the open country around it", () => {
    const state = atWar();
    state.state.settlement[15] = Settlement.Town;
    state.armies.push(army(1, 1, 15));
    for (let i = 0; i < 20 && state.state.occupier[15] === 0; i++) besiege(state, hostile);
    expect([state.state.occupier[14], state.state.occupier[15], state.state.occupier[16]]).toEqual([1, 1, 1]);
  });

  it("taking the capital shakes the realm", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 19));
    const before = state.nations.get(2)!.stability;
    for (let i = 0; i < 20 && state.state.occupier[19] === 0; i++) besiege(state, hostile);
    expect(state.nations.get(2)!.stability).toBeCloseTo(before - SIM.CAPITAL_LOSS_STAB_HIT);
  });

  it("the owner's army frees its land at once", () => {
    const state = atWar();
    state.state.occupier[15] = 1;
    liberate(state, army(1, 2, 15), 15, hostile);
    expect(state.state.occupier[15]).toBe(0);
  });

  it("a change of owner ends any occupation", () => {
    const state = atWar();
    state.state.occupier[15] = 1;
    state.wars = [];
    releaseOccupations(state);
    expect(state.state.occupier[15]).toBe(0);
  });
});

describe("a campaign", () => {
  it("a lone army takes land year after year", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 9, 5));
    for (let y = 0; y < 3; y++) campaign(state, createRng(`y${y}`), everyoneAI);
    expect(state.state.occupier.filter((id) => id === 1).length).toBeGreaterThan(3);
  });

  it("a weak army won't attack a much stronger one nearby", () => {
    const state = atWar();
    state.state.settlement[2] = 1;
    state.armies.push(army(1, 1, 8, 0.2), army(2, 2, 12, 5));
    campaign(state, createRng("flee"), everyoneAI);
    expect(state.armies.find((a) => a.owner === 1)?.target ?? 2).toBeLessThan(10);
  });

  it("out of supply, an army wears down", () => {
    const state = atWar();
    state.state.settlement.fill(Settlement.City); // cities hold out, so the land stays hostile for a while
    state.armies.push(army(1, 1, 15, 5));
    campaign(state, createRng("hungry"), everyoneAI);
    expect(state.armies[0]!.size).toBeLessThan(5);
  });

  it("morale recovers at home", () => {
    const state = atWar();
    state.armies.push(army(1, 1, 5, 1, 0.5));
    campaign(state, createRng("rest"), everyoneAI);
    expect(state.armies[0]!.morale).toBeGreaterThan(0.5);
  });
});

describe("battle events", () => {
  const report = { cell: 5, winner: 1, loser: 2, lost: 0.5, routed: true };

  it("names a nearby city, and counts the fallen", () => {
    const state = atWar();
    state.cityNames.set(6, "Arvenna");
    state.battles = [report];
    expect(battleEvents(state)[0]!.text).toContain("at the Battle of Arvenna");
    expect(battleEvents(state)[0]!.text).toContain("routs the host of");
    expect(battleEvents(state)[0]!.text).toContain("(10,000 fell)");
  });

  it("with no city nearby, names the land", () => {
    const state = atWar();
    state.battles = [{ ...report, routed: false }];
    const text = battleEvents(state)[0]!.text;
    expect(text).toContain("in the fields of");
    expect(text).toContain("beats back");
  });
});
