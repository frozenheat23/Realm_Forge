// M16: every war leaves a record for the War Room (docs/systems/warroom.md).
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { NO_TARGET, type Army } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { everyoneAI } from "../src/sim/ai/default";
import { fightBattles } from "../src/sim/battle";
import { applyCommand } from "../src/sim/commands";
import { pairKey } from "../src/sim/helpers";
import { SIM } from "../src/sim/params";
import { besiege } from "../src/sim/siege";
import { fromSnapshot, toSnapshot } from "../src/sim/snapshot";
import { tick } from "../src/sim/tick";
import { endWars } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

// [1][1][1][1][1] | [2][2][2][2][2] | [3][3]: nation 1 attacks 2, and 3 is 2's ally.
function threeNations() {
  const state = makeState(row(12), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3], [
    makeNation(1, 0, { reserve: 10, manpowerCap: 10 }),
    makeNation(2, 9, { reserve: 10, manpowerCap: 10 }),
    makeNation(3, 11, { reserve: 10, manpowerCap: 10 }),
  ]);
  state.alliances.push({ a: 2, b: 3, since: 0, renewed: 0 });
  applyCommand(state, { kind: "declareWar", nation: 1, target: 2, goal: "raid" });
  applyCommand(state, { kind: "joinWar", nation: 3, war: state.wars[0]!.id, side: "defend" });
  return state;
}

function army(id: number, owner: number, war: number, cell: number, size = 1): Army {
  return { id, owner, war, cell, size, morale: 1, target: NO_TARGET, path: [], trail: [cell] };
}

describe("war records", () => {
  it("open when war is declared, and an ally joining joins the record", () => {
    const state = threeNations();
    expect(state.warRecords).toHaveLength(1);
    const record = state.warRecords[0]!;
    expect([record.attacker, record.defender, record.goal]).toEqual([1, 2, "raid"]);
    expect(record.allies).toEqual([{ nation: 3, side: "defend", year: 0 }]);
    expect(record.moments[0]!.kind).toBe("joined");
  });

  it("count an ally's battles and losses for its side of the main war", () => {
    const state = threeNations();
    const allyWar = state.wars[1]!;
    // Nation 1's army meets the ally's army: they fight in the ally's own (joined) war.
    state.armies.push(army(1, 1, allyWar.id, 4, 5), army(2, 3, allyWar.id, 5, 1));
    fightBattles(state, new Set([pairKey(1, 2), pairKey(1, 3)]), new Set(), createRng("b"));
    const record = state.warRecords[0]!;
    expect(record.battles).toHaveLength(1);
    expect(record.fallen.attack).toBeGreaterThan(0);
    expect(record.fallen.defend).toBeGreaterThan(0);
    expect(record.fallen.attack + record.fallen.defend).toBeCloseTo(record.battles[0]!.lost);
  });

  it("note a capital taken", () => {
    const state = threeNations();
    const war = state.wars[0]!;
    state.armies.push(army(1, 1, war.id, 9));
    for (let s = 0; s < 100 && state.state.occupier[9] === 0; s++) besiege(state, new Set([pairKey(1, 2)]));
    expect(state.warRecords[0]!.moments.some((m) => m.kind === "capital")).toBe(true);
  });

  it("keep each year's score, then how the war ended", () => {
    const state = threeNations();
    state.year = 3;
    state.wars[0]!.battleScore = SIM.PEACE_SCORE * 2; // decisive for the attacker
    const events = endWars(state, everyoneAI);
    const record = state.warRecords[0]!;
    // The raider holds no land, so the defender counts a year of holding out.
    expect(record.scores).toEqual([SIM.PEACE_SCORE * 2 - SIM.HOLD_SCORE]);
    expect(record.end).toBe(3);
    expect(record.outcome).toMatchObject({ how: "decisive", winner: 1, raid: true, text: events[0]!.text });
  });

  it("end when a side falls", () => {
    const state = threeNations();
    state.nations.get(2)!.alive = false;
    endWars(state, everyoneAI);
    expect(state.warRecords[0]!.outcome?.how).toBe("side fell");
  });
});

describe("over a long run", () => {
  const { world, state } = generateWorld("records", 320, 180);
  const rng = createRng("records").fork("sim");
  let battleEvents = 0;
  for (let y = 0; y < 400; y++) battleEvents += tick(state, rng).filter((e) => e.type === "battle").length;

  it("every declared war has a record, and every battle is in one", () => {
    const declared = state.events.filter((e) => e.type === "war" && e.text.includes("declares war")).length;
    expect(state.warRecords).toHaveLength(declared);
    expect(state.warRecords.reduce((sum, r) => sum + r.battles.length, 0)).toBe(battleEvents);
  });

  it("every war that's over says how it ended, and wars still going don't", () => {
    const going = new Set(state.wars.map((w) => w.id));
    for (const r of state.warRecords) {
      expect(r.outcome === undefined).toBe(going.has(r.id));
      if (r.outcome) expect(r.scores.length).toBeLessThanOrEqual(r.end! - r.start + 1);
    }
  });

  it("survive a save and load", () => {
    const back = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(state, SIM))), world);
    expect(back.warRecords).toEqual(state.warRecords);
  });
});
