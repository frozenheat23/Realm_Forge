import { afterEach, describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Race, type RaceId, type WorldState } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { alliesOf, opinion, raceAttitude, updateAlliances, updateOpinions } from "../src/sim/diplomacy";
import { neighborPairs, pairKey } from "../src/sim/helpers";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { rebel } from "../src/sim/rebellion";
import { fromSnapshot, toSnapshot } from "../src/sim/snapshot";
import { declareWars, endWars, warChance } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

// Some tests turn chances up to 1 so the outcome is certain; put them back afterwards.
afterEach(() => {
  Object.assign(SIM, SIM_DEFAULTS);
});

// Two nations side by side: [1][1][1] | [2][2][2]
function twoNations(race2: RaceId = Race.Human) {
  return makeState(row(6), [1, 1, 1, 2, 2, 2], [
    makeNation(1, 0, { reserve: 10 }),
    makeNation(2, 5, { reserve: 10, race: race2 }),
  ]);
}

// Three nations that all touch each other, 1 much the strongest.
function triangle(): WorldState {
  const spec = [{ neighbors: [1, 2] }, { neighbors: [0, 2] }, { neighbors: [0, 1] }];
  return makeState(spec, [1, 2, 3], [
    makeNation(1, 0, { reserve: 100 }),
    makeNation(2, 1, { reserve: 1 }),
    makeNation(3, 2, { reserve: 1 }),
  ]);
}

/** Declares wars with fresh seeds until one starts (the chance per year is small). */
function untilWar(make: () => WorldState): WorldState {
  for (let trial = 0; trial < 2000; trial++) {
    const state = make();
    if (declareWars(state, createRng(`w${trial}`)).length > 0) return state;
  }
  throw new Error("no war in 2000 tries");
}

describe("opinion", () => {
  it("race attitudes come from RACE_ATTITUDES", () => {
    expect(raceAttitude(Race.LightElf, Race.DarkElf)).toBeCloseTo(-0.8);
    expect(raceAttitude(Race.Human, Race.Orc)).toBe(raceAttitude(Race.Orc, Race.Human));
  });

  it("starts at race attitude minus border friction when neighbors meet", () => {
    const state = twoNations(Race.Orc);
    updateOpinions(state, neighborPairs(state));
    expect(opinion(state, 1, 2)).toBeCloseTo(raceAttitude(Race.Human, Race.Orc) - SIM.BORDER_FRICTION);
  });

  it("drifts toward its target and sinks while at war", () => {
    const peace = twoNations();
    peace.relations.set(pairKey(1, 2), 1);
    updateOpinions(peace, neighborPairs(peace));
    expect(opinion(peace, 1, 2)).toBeCloseTo(1 + (0.1 - 1) * SIM.OPINION_DRIFT); // humans + border: target 0.1

    const war = twoNations();
    war.relations.set(pairKey(1, 2), 1);
    war.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [] });
    updateOpinions(war, neighborPairs(war));
    expect(opinion(war, 1, 2)).toBeLessThan(opinion(peace, 1, 2));
  });

  it("forgets nations that have died", () => {
    const state = twoNations();
    state.relations.set(pairKey(1, 2), 0.5);
    state.nations.get(2)!.alive = false;
    updateOpinions(state, []);
    expect(state.relations.size).toBe(0);
  });

  it("hatred makes war more likely than friendship", () => {
    const state = twoNations();
    const [a, b] = [state.nations.get(1)!, state.nations.get(2)!];
    state.relations.set(pairKey(1, 2), -0.8);
    const hate = warChance(state, a, b);
    state.relations.set(pairKey(1, 2), 0.8);
    expect(warChance(state, a, b)).toBeLessThan(hate);
  });

  it("declaring war leaves a grudge", () => {
    const state = untilWar(() => {
      const s = twoNations();
      s.relations.set(pairKey(1, 2), 0);
      return s;
    });
    expect(opinion(state, 1, 2)).toBeCloseTo(-SIM.WAR_OPINION_HIT);
  });

  it("rebels and their old rulers start out bitter", () => {
    const length = SIM.REBEL_MIN_CAPITAL_DIST + SIM.MIN_AREA + 2;
    const owners = Array(length).fill(1);
    const state = makeState(row(length), owners, [makeNation(1, 0)]);
    const rebelNation = rebel(state, state.nations.get(1)!, [...owners.keys()], createRng("r"))!;
    expect(opinion(state, 1, rebelNation.id)).toBe(SIM.REBEL_OPINION);
  });
});

describe("alliances", () => {
  it("friendly neighbors ally, and kin say so", () => {
    SIM.ALLIANCE_PROB = 1;
    const state = twoNations();
    state.relations.set(pairKey(1, 2), 0.5);
    const events = updateAlliances(state, neighborPairs(state), createRng("a"));
    expect(alliesOf(state, 1)).toEqual([2]);
    expect(events[0]!.type).toBe("alliance");
    expect(events[0]!.text).toContain("kinship");
  });

  it("break when opinion sours", () => {
    const state = twoNations();
    state.alliances.push({ a: 1, b: 2, since: 0 });
    state.relations.set(pairKey(1, 2), -0.5);
    const events = updateAlliances(state, neighborPairs(state), createRng("b"));
    expect(state.alliances).toHaveLength(0);
    expect(events[0]!.type).toBe("alliance_ended");
  });

  it("never exceed MAX_ALLIES", () => {
    SIM.ALLIANCE_PROB = 1;
    SIM.MAX_ALLIES = 1;
    const state = triangle();
    for (const key of [pairKey(1, 2), pairKey(1, 3), pairKey(2, 3)]) state.relations.set(key, 0.9);
    updateAlliances(state, neighborPairs(state), createRng("m"));
    for (const id of [1, 2, 3]) expect(alliesOf(state, id).length).toBeLessThanOrEqual(1);
  });

  it("allies never attack each other", () => {
    for (let trial = 0; trial < 300; trial++) {
      const state = twoNations();
      state.nations.get(1)!.reserve = 1000;
      state.alliances.push({ a: 1, b: 2, since: 0 });
      declareWars(state, createRng(`n${trial}`));
      expect(state.wars).toHaveLength(0);
    }
  });

  it("a bordering ally joins the defense", () => {
    SIM.ALLY_DEFEND_PROB = 1;
    const state = untilWar(() => {
      const s = triangle();
      s.alliances.push({ a: 2, b: 3, since: 0 });
      return s;
    });
    expect(state.wars).toHaveLength(2);
    const [main, joined] = state.wars;
    expect(joined!.joined).toBe(main!.id);
    expect(joined!.attacker).toBe(main!.attacker); // both allies face the same attacker
  });

  it("a bordering ally joins an attack", () => {
    SIM.ALLY_ATTACK_PROB = 1;
    SIM.ALLY_DEFEND_PROB = 1;
    const state = untilWar(() => {
      const s = triangle();
      s.alliances.push({ a: 1, b: 3, since: 0 });
      return s;
    });
    expect(state.wars).toHaveLength(2);
    expect(state.wars.every((w) => w.attacker === 2 || w.defender === 2)).toBe(true); // 1 and 3 side together
  });

  it("an ally that doesn't border the attacker stays out", () => {
    SIM.ALLY_DEFEND_PROB = 1;
    // [1][2][3][4]: 2 and 4 are allies, but 4 doesn't touch 1.
    for (let trial = 0; trial < 300; trial++) {
      const state = makeState(row(4), [1, 2, 3, 4], [
        makeNation(1, 0, { reserve: 100 }),
        makeNation(2, 1, { reserve: 1 }),
        makeNation(3, 2, { reserve: 1 }),
        makeNation(4, 3, { reserve: 1 }),
      ]);
      state.alliances.push({ a: 2, b: 4, since: 0 });
      declareWars(state, createRng(`f${trial}`));
      expect(state.wars.some((w) => pairKey(w.attacker, w.defender) === pairKey(1, 4))).toBe(false);
    }
  });

  it("allies go home when the war they joined ends", () => {
    const state = triangle();
    state.year = 5;
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 1, score: 0, battleScore: SIM.PEACE_SCORE, goal: "conquer" as const, goalCells: [] });
    state.wars.push({ id: 2, attacker: 1, defender: 3, startYear: 1, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [], joined: 1 });
    endWars(state);
    expect(state.wars).toHaveLength(0);
    expect(state.truces).toHaveLength(2);
  });

  it("allies keep fighting while the main war goes on", () => {
    const state = triangle();
    state.year = 2;
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 1, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [] });
    state.wars.push({ id: 2, attacker: 1, defender: 3, startYear: 1, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [], joined: 1 });
    endWars(state);
    expect(state.wars.map((w) => w.id)).toEqual([1, 2]);
  });
});

describe("saves", () => {
  it("keep opinions and alliances, and refuse saves from before them", () => {
    const { world, state } = generateWorld("diplo", 320, 180);
    state.relations.set(pairKey(1, 2), -0.4);
    state.alliances.push({ a: 1, b: 2, since: 3 });
    const snapshot = JSON.parse(JSON.stringify(toSnapshot(state, SIM)));
    const back = fromSnapshot(snapshot, world);
    expect(back.relations.get(pairKey(1, 2))).toBe(-0.4);
    expect(back.alliances).toEqual([{ a: 1, b: 2, since: 3 }]);
    expect(() => fromSnapshot({ ...snapshot, version: 2 }, world)).toThrow(/diplomacy/);
  });
});
