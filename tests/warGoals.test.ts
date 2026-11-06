import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { NO_TARGET, type War, type WarGoal } from "../src/core/types";
import { campaign } from "../src/sim/armies";
import { SIM } from "../src/sim/params";
import { endWars } from "../src/sim/war";
import { goalAchieved, payTribute, takeLand } from "../src/sim/warGoals";
import { occupationCounts, occupationScore } from "../src/sim/siege";
import { makeNation, makeState, row } from "./tinyWorld";
import { chooseGoal, everyoneAI } from "../src/sim/ai/default";

const war = (goal: WarGoal, goalCells: number[] = [], extra: Partial<War> = {}): War => ({
  id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal, goalCells, ...extra,
});

// Nation 1 owns 0–9, nation 2 owns 10–19, in a row.
function neighbors() {
  const owners = Array.from({ length: 20 }, (_, i) => (i < 10 ? 1 : 2));
  return makeState(row(20), owners, [makeNation(1, 0), makeNation(2, 19)]);
}

// Runs a campaign of a single season, so tests see the first choice an army makes.
function oneSeason(run: () => void): void {
  const before = SIM.CAMPAIGN_STEPS;
  SIM.CAMPAIGN_STEPS = 1;
  run();
  SIM.CAMPAIGN_STEPS = before;
}

describe("choosing a goal", () => {
  it("a claim means reclaiming the land that was lost", () => {
    const state = neighbors();
    state.year = 10;
    state.state.prevOwner[12] = 1;
    state.state.ownedSince[12] = 5;
    const { goal, goalCells } = chooseGoal(state, state.nations.get(1)!, state.nations.get(2)!, true, 10, createRng("g"));
    expect(goal).toBe("reclaim");
    expect(goalCells).toEqual([12]);
  });

  it("otherwise usually conquest of the prize's province, sometimes a raid", () => {
    const state = neighbors();
    for (const c of state.cells) (c as { province: number }).province = c.id < 15 ? 0 : 1;
    const rng = createRng("g");
    const goals = Array.from({ length: 200 }, () => chooseGoal(state, state.nations.get(1)!, state.nations.get(2)!, false, 16, rng));
    const raids = goals.filter((g) => g.goal === "raid").length;
    expect(raids).toBeGreaterThan(0);
    expect(raids).toBeLessThan(200);
    expect(goals.find((g) => g.goal === "conquer")!.goalCells).toEqual([15, 16, 17, 18, 19]);
    expect(goals.find((g) => g.goal === "raid")!.goalCells).toEqual([]);
  });
});

describe("how much a conquest aims for", () => {
  // Nation 2 holds three provinces of five cells each, nearest first from nation 1.
  function provinces(reserve: number) {
    const spec = row(20).map((c, i) => ({ ...c, province: Math.floor(i / 5) }));
    const owners = Array.from({ length: 20 }, (_, i) => (i < 5 ? 1 : 2));
    const state = makeState(spec, owners, [makeNation(1, 0, { reserve }), makeNation(2, 19, { reserve: 1 })]);
    return { state, conquest: () => chooseGoal(state, state.nations.get(1)!, state.nations.get(2)!, false, 5, createRng("no-raid-1")) };
  }

  it("an even fight aims for one province, a far stronger attacker for several", () => {
    const raid = SIM.RAID_CHANCE;
    const subjugate = SIM.SUBJUGATE_RATIO;
    SIM.RAID_CHANCE = 0;
    SIM.SUBJUGATE_RATIO = Infinity; // leave the capital out of it
    expect(provinces(1).conquest().goalCells).toEqual([5, 6, 7, 8, 9]);
    expect(provinces(3).conquest().goalCells).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    SIM.RAID_CHANCE = raid;
    SIM.SUBJUGATE_RATIO = subjugate;
  });

  it("never aims past CONQUEST_MAX_PROVINCES", () => {
    const raid = SIM.RAID_CHANCE;
    const most = SIM.CONQUEST_MAX_PROVINCES;
    const subjugate = SIM.SUBJUGATE_RATIO;
    SIM.RAID_CHANCE = 0;
    SIM.CONQUEST_MAX_PROVINCES = 2;
    SIM.SUBJUGATE_RATIO = Infinity; // leave the capital out of it
    expect(provinces(100).conquest().goalCells).toHaveLength(10);
    SIM.RAID_CHANCE = raid;
    SIM.CONQUEST_MAX_PROVINCES = most;
    SIM.SUBJUGATE_RATIO = subjugate;
  });
});

describe("marching on the goal", () => {
  it("the attacker's army heads for the nearest goal cell, not the richest land", () => {
    const state = neighbors();
    state.wars.push(war("conquer", [18]));
    state.armies.push({ id: 1, owner: 1, war: 1, cell: 9, size: 1, morale: 1, target: NO_TARGET, path: [], trail: [9] });
    oneSeason(() => campaign(state, createRng("g"), everyoneAI));
    expect(state.armies[0]!.target).toBe(18);
  });
});

describe("reaching the goal", () => {
  it("is done once every goal cell is held, and rebel-held goals don't count", () => {
    const state = neighbors();
    const w = war("conquer", [10, 11]);
    state.state.occupier[10] = 1;
    expect(goalAchieved(state, w)).toBe(false);
    state.state.owner[11] = 3; // broke away
    expect(goalAchieved(state, w)).toBe(true);
    state.state.occupier[10] = 0;
    expect(goalAchieved(state, w)).toBe(false); // nothing left held
  });

  it("goal cells count for more in the score", () => {
    const state = neighbors();
    state.state.occupier[10] = 1;
    const score = (goals: number[]) => occupationScore(state, war("conquer", goals), occupationCounts(state));
    expect(score([10])).toBeCloseTo(score([]) * SIM.GOAL_SCORE_MULT);
  });

  it("ends the war with the attacker winning, whatever the score", () => {
    const state = neighbors();
    state.state.occupier[10] = 1;
    state.wars.push(war("conquer", [10], { battleScore: -5 }));
    const events = endWars(state, everyoneAI);
    expect(state.wars).toHaveLength(0);
    expect(state.state.owner[10]).toBe(1);
    expect(events[0]!.text).toContain("defeats");
  });
});

describe("taking the capital", () => {
  it("a strong enough attacker also marches on the enemy capital", () => {
    const raid = SIM.RAID_CHANCE;
    SIM.RAID_CHANCE = 0;
    // The capital is in another province, so only the march on the throne can make it a goal.
    const spec = row(20).map((c, i) => ({ ...c, province: Math.floor(i / 5) }));
    const owners = Array.from({ length: 20 }, (_, i) => (i < 10 ? 1 : 2));
    const state = makeState(spec, owners, [makeNation(1, 0), makeNation(2, 19, { reserve: 1 })]);
    const goals = () => chooseGoal(state, state.nations.get(1)!, state.nations.get(2)!, false, 10, createRng("c")).goalCells;
    state.nations.get(1)!.reserve = SIM.SUBJUGATE_RATIO;
    expect(goals()).toContain(19);
    state.nations.get(1)!.reserve = SIM.SUBJUGATE_RATIO / 2;
    expect(goals()).not.toContain(19);
    SIM.RAID_CHANCE = raid;
  });

  it("holding the capital at peace wins the whole nation, and the loser is gone", () => {
    const state = neighbors();
    state.wars.push(war("conquer", [19]));
    state.state.occupier[19] = 1;
    const events = endWars(state, everyoneAI);
    expect(state.state.owner.slice(10, 20).every((o) => o === 1)).toBe(true);
    expect(state.nations.get(2)!.alive).toBe(false);
    expect(events[0]!.text).toContain("whole realm");
  });

  it("without the capital, the loser survives", () => {
    const state = neighbors();
    state.wars.push(war("conquer", [10]));
    state.state.occupier[10] = 1;
    endWars(state, everyoneAI);
    expect(state.state.owner[10]).toBe(1);
    expect(state.nations.get(2)!.alive).toBe(true);
  });
});

describe("who won", () => {
  // A war that has run out of time, with the attacker holding `held` of the defender's cells.
  function ended(held: number) {
    const state = neighbors();
    state.year = SIM.MAX_WAR_YEARS;
    state.wars.push(war("raid", [], { goal: "conquer", goalCells: [], battleScore: 0 }));
    for (let c = 10; c < 10 + held; c++) state.state.occupier[c] = 1;
    return { state, events: endWars(state, everyoneAI) };
  }

  it("a war below WIN_SCORE is a white peace and everything goes back", () => {
    const held = Math.floor((SIM.WIN_SCORE - 1) / SIM.SCORE_PER_OCCUPIED);
    expect(ended(held).state.state.owner[10]).toBe(2);
  });

  it("a war past WIN_SCORE has a winner, even far from PEACE_SCORE", () => {
    const held = Math.ceil(SIM.WIN_SCORE / SIM.SCORE_PER_OCCUPIED);
    expect(held * SIM.SCORE_PER_OCCUPIED).toBeLessThan(SIM.PEACE_SCORE);
    expect(ended(held).state.state.owner[10]).toBe(1);
  });
});

describe("peace terms", () => {
  it("the winner takes its goal cells and only a few others that touch its land", () => {
    const state = neighbors();
    for (let c = 10; c < 16; c++) state.state.occupier[c] = 1;
    state.state.occupier[18] = 1; // cut off
    const taken = takeLand(state, war("conquer", [10]), state.nations.get(1)!, state.nations.get(2)!);
    expect(taken[0]).toBe(10);
    expect(taken.slice().sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14, 15]); // each one makes the next touch
    expect(state.state.owner[18]).toBe(2);
  });

  it("stops at PEACE_EXTRA_CELLS", () => {
    const state = neighbors();
    for (let c = 10; c < 19; c++) state.state.occupier[c] = 1;
    const before = SIM.PEACE_EXTRA_CELLS;
    SIM.PEACE_EXTRA_CELLS = 2;
    const taken = takeLand(state, war("conquer"), state.nations.get(1)!, state.nations.get(2)!);
    SIM.PEACE_EXTRA_CELLS = before;
    expect(taken).toHaveLength(2);
  });

  it("a won raid takes tribute, not land", () => {
    const state = neighbors();
    state.state.occupier[10] = 1;
    state.wars.push(war("raid", [], { battleScore: SIM.PEACE_SCORE }));
    const winner = state.nations.get(1)!;
    const loser = state.nations.get(2)!;
    winner.stability = loser.stability = 0.5;
    const events = endWars(state, everyoneAI);
    expect(state.state.owner[10]).toBe(2);
    expect(winner.stability).toBeCloseTo(0.5 + SIM.RAID_TRIBUTE);
    expect(loser.stability).toBeCloseTo(0.5 - SIM.RAID_TRIBUTE);
    expect(events[0]!.text).toContain("plunders");
  });

  it("tribute stays between 0 and 1", () => {
    const winner = makeNation(1, 0, { stability: 1 });
    const loser = makeNation(2, 1, { stability: 0 });
    payTribute(winner, loser);
    expect([winner.stability, loser.stability]).toEqual([1, 0]);
  });
});

describe("allies in support", () => {
  it("march to free their friend's land", () => {
    // 3 is allied to 2; 1 holds part of 2's land.
    const owners = Array.from({ length: 20 }, (_, i) => (i < 8 ? 3 : i < 14 ? 2 : 1));
    const state = makeState(row(20), owners, [makeNation(1, 19), makeNation(2, 10), makeNation(3, 0)]);
    state.alliances.push({ a: 2, b: 3, since: 0, renewed: 0 });
    state.state.occupier[13] = 1;
    state.wars.push(war("conquer", [13]), war("support", [], { id: 2, defender: 3, joined: 1 }));
    state.armies.push({ id: 1, owner: 3, war: 2, cell: 7, size: 1, morale: 1, target: NO_TARGET, path: [], trail: [7] });
    oneSeason(() => campaign(state, createRng("g"), everyoneAI));
    expect(state.armies[0]!.target).toBe(13);
  });
});
