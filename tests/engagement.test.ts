import { afterEach, describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { NO_TARGET, Race, Settlement, type Army } from "../src/core/types";
import { makeGeneral } from "../src/gen/rulers";
import { traits } from "../src/gen/races";
import { AI, engagementEstimate } from "../src/sim/ai/default";
import type { ArmyOrders } from "../src/sim/ai/controller";
import { PLAYER } from "../src/sim/ai/player";
import { fightBattles, groundBonus } from "../src/sim/battle";
import { campaign } from "../src/sim/armies";
import { pairKey } from "../src/sim/helpers";
import { armyPower } from "../src/sim/manpower";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { makeNation, makeState, row } from "./tinyWorld";

function encounter() {
  const state = makeState(row(20), Array.from({ length: 20 }, (_, i) => i < 10 ? 1 : 2), [makeNation(1, 0), makeNation(2, 19)]);
  const army = (id: number, cell: number): Army => ({ id, owner: id, war: 1, cell, size: 10, morale: 1, target: NO_TARGET, path: [], trail: [] });
  const mine = army(1, 7);
  const foe = army(2, 12);
  state.armies = [mine, foe];
  const war = { id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "raid" as const, goalCells: [] };
  state.wars = [war];
  const orders: ArmyOrders = { war, enemy: state.nations.get(2)!, main: undefined, hostile: new Set([pairKey(1, 2)]), held: new Map(), grain: new Float64Array(3).fill(1), season: 0, reach: () => true };
  return { state, mine, foe, orders };
}

afterEach(() => Object.assign(SIM, SIM_DEFAULTS));

describe("imperfect engagement judgment", () => {
  it("considers the same defensive ground bonuses used by battles", () => {
    SIM.ENGAGE_INTEL_ERROR = 0;
    const { state, mine, foe, orders } = encounter();
    const rng = createRng("ground");
    expect(AI.orderArmy(state, mine, orders, rng)).toBe(foe.cell);
    state.cells[foe.cell]!.defensibility = 2;
    state.state.settlement[foe.cell] = Settlement.City;
    expect(engagementEstimate(state, mine, foe, rng)).toBeCloseTo(armyPower(state, mine) / (armyPower(state, foe) * groundBonus(state, foe)));
    expect(AI.orderArmy(state, mine, orders, rng)).toBe(0);
    foe.morale = 0.1;
    expect(AI.orderArmy(state, mine, orders, rng)).toBe(foe.cell);
  });

  it("sometimes attacks an unfavorable fight and sometimes avoids a favorable one", () => {
    const { state, mine, foe, orders } = encounter();
    const attacks = (size: number) => {
      mine.size = size;
      let count = 0;
      for (let i = 0; i < 500; i++) if (AI.orderArmy(state, mine, orders, createRng(`report-${i}`)) === foe.cell) count++;
      return count;
    };
    // Actual ratios before scouting: 0.75 and 0.92, on opposite sides of ENGAGE_RATIO (0.8).
    const unfavorable = attacks(9);
    const favorable = attacks(11);
    expect(unfavorable).toBeGreaterThan(0);
    expect(favorable).toBeLessThan(500);
    expect(favorable).toBeGreaterThan(unfavorable);
    expect(attacks(100)).toBe(500);
    expect(attacks(1)).toBe(0);
  });

  it("lets bold and cautious generals make different choices without changing fighting power", () => {
    SIM.ENGAGE_INTEL_ERROR = 0;
    const { state, mine, foe, orders } = encounter();
    mine.general = { name: "Test", female: false, skill: 1, wins: 0, since: 0, boldness: 0.6 };
    const power = armyPower(state, mine);
    expect(AI.orderArmy(state, mine, orders, createRng("temper"))).toBe(0);
    mine.general.boldness = 1.6;
    expect(AI.orderArmy(state, mine, orders, createRng("temper"))).toBe(foe.cell);
    expect(armyPower(state, mine)).toBe(power);
  });

  it("supports old generals with no personality and uses the same judgment for the player", () => {
    const { state, mine, orders } = encounter();
    mine.general = { name: "Old save", female: false, skill: 1, wins: 0, since: 0 };
    const rng = createRng("old-save");
    const target = AI.orderArmy(state, mine, orders, rng);
    mine.general.boldness = 1;
    expect(AI.orderArmy(state, mine, orders, rng)).toBe(target);
    expect(PLAYER.orderArmy(state, mine, orders, rng)).toBe(target);
  });

  it("keeps reports stable within the year without consuming other decisions' dice or changing state", () => {
    const { state, mine, foe } = encounter();
    const before = structuredClone(state);
    const rng = createRng("year-a").fork(`orders-${mine.id}`);
    const ratio = engagementEstimate(state, mine, foe, rng);
    engagementEstimate(state, foe, mine, createRng("other-army"));
    expect(engagementEstimate(state, mine, foe, rng)).toBe(ratio);
    expect(rng.next()).toBe(createRng("year-a").fork(`orders-${mine.id}`).next());
    expect(engagementEstimate(state, mine, foe, createRng("year-b").fork(`orders-${mine.id}`))).not.toBe(ratio);
    expect(state).toEqual(before);
  });

  it("passes stable, separate army dice through the campaign controller", () => {
    const { state } = encounter();
    const reports = new Map<number, number[]>();
    const controller = { ...AI, orderArmy: (_view: Parameters<typeof AI.orderArmy>[0], army: Army, _orders: ArmyOrders, rng: Parameters<typeof AI.orderArmy>[3]) => {
      const seen = reports.get(army.id) ?? [];
      seen.push(rng.next());
      reports.set(army.id, seen);
      return NO_TARGET;
    } };
    campaign(state, createRng("campaign"), () => controller);
    for (const seen of reports.values()) {
      expect(seen).toHaveLength(SIM.CAMPAIGN_STEPS);
      expect(new Set(seen).size).toBe(1);
    }
    expect(reports.get(1)![0]).not.toBe(reports.get(2)![0]);
  });

  it("generates persistent, varied general personalities within their race's temperament", () => {
    const rng = createRng("general-personalities");
    const generals = Array.from({ length: 50 }, () => makeGeneral(rng, Race.Human, 0, SIM.GENERAL_SPREAD));
    for (const general of generals) expect(Math.abs(Math.log(general.boldness!))).toBeLessThanOrEqual(traits(Race.Human).temper);
    expect(generals.some((g) => g.boldness! < 1)).toBe(true);
    expect(generals.some((g) => g.boldness! > 1)).toBe(true);
    expect(makeGeneral(createRng("saved-general"), Race.Human, 0, SIM.GENERAL_SPREAD)).toEqual(makeGeneral(createRng("saved-general"), Race.Human, 0, SIM.GENERAL_SPREAD));
  });

  it("still allows battlefield upsets after an army commits with a strength advantage", () => {
    let wins = 0;
    for (let i = 0; i < 500; i++) {
      const { state, mine, foe, orders } = encounter();
      mine.cell = foe.cell - 1;
      mine.size = 20;
      fightBattles(state, orders.hostile, new Set([mine.id]), createRng(`battle-upset-${i}`));
      if (state.battles[0]!.winner === mine.owner) wins++;
    }
    // Twice the troops against a 1.2x defensive bonus: about 62.5%, never a guaranteed win.
    expect(wins).toBeGreaterThan(250);
    expect(wins).toBeLessThan(375);
  });
});
