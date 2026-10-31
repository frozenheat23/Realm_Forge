import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Race } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { collapses } from "../src/sim/collapse";
import { emergence, emptyRegions } from "../src/sim/emergence";
import { SIM } from "../src/sim/params";
import { rebel, rebellions } from "../src/sim/rebellion";
import { controlMap } from "../src/sim/control";
import { adminCap, updateStability } from "../src/sim/stability";
import { tick } from "../src/sim/tick";
import { makeNation, makeState, row } from "./tinyWorld";

describe("stability", () => {
  it("recovers slowly for a small nation at peace", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { stability: 0.5, area: 3 })]);
    updateStability(state);
    expect(state.nations.get(1)!.stability).toBeCloseTo(0.5 + SIM.STAB_RECOVERY);
  });

  it("drops for a nation far past its admin cap", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { stability: 0.5, area: 10000 })]);
    state.year = 10000; // old enough that its vigor has gone
    updateStability(state);
    expect(state.nations.get(1)!.stability).toBeLessThan(0.5);
  });

  it("a young nation can rule far more land than an old one", () => {
    const state = makeState(row(1), [1], [makeNation(1, 0)]);
    const nation = state.nations.get(1)!;
    const young = adminCap(state, nation);
    state.year = SIM.VIGOR_YEARS * 10;
    expect(young).toBeCloseTo(SIM.ADMIN_CAP_BASE * (1 + SIM.VIGOR_BONUS));
    expect(adminCap(state, nation)).toBeLessThan(young / 2);
    expect(adminCap(state, nation)).toBeGreaterThanOrEqual(SIM.ADMIN_CAP_BASE);
  });

  it("drops when the nation's grip on its land is weak", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { stability: 0.5, area: 3, control: 0 })]);
    updateStability(state);
    expect(state.nations.get(1)!.stability).toBeCloseTo(0.5 + SIM.STAB_RECOVERY - SIM.CONTROL_FREE * SIM.CONTROL_STAB_K);
  });

  it("control fades with travel cost from the capital, and mountains cost more", () => {
    // Capital at 0. In the second world, cell 2 sits behind a mountain (cell 1).
    const plains = makeState(row(3), [1, 1, 1], [makeNation(1, 0)]);
    const hills = makeState(row(3).map((c, i) => ({ ...c, mountain: i === 1 })), [1, 1, 1], [makeNation(1, 0)]);
    const p = controlMap(plains);
    const m = controlMap(hills);
    expect(p[0]).toBe(1);
    expect(p[2]).toBeLessThan(p[1]!);
    expect(m[2]).toBeLessThan(p[2]!);
  });

  it("gives land the capital can't reach the island control", () => {
    const state = makeState([{ neighbors: [] }, { neighbors: [] }], [1, 1], [makeNation(1, 0)]);
    expect(controlMap(state)[1]).toBeCloseTo(SIM.CONTROL_ISLAND);
  });

  it("builds war weariness only while at war", () => {
    const state = makeState(row(2), [1, 2], [makeNation(1, 0), makeNation(2, 1)]);
    state.wars.push({ id: 1, attacker: 1, defender: 2, startYear: 0, score: 0, battleScore: 0, goal: "conquer" as const, goalCells: [] });
    updateStability(state);
    expect(state.nations.get(1)!.warWeariness).toBeGreaterThan(0);
  });
});

describe("rebellion", () => {
  it("breaks off a far province as a new nation with the old one as parent", () => {
    const length = SIM.REBEL_MIN_CAPITAL_DIST + SIM.MIN_AREA + 2;
    const owners = Array(length).fill(1);
    const state = makeState(row(length), owners, [makeNation(1, 0)]);
    const rebelNation = rebel(state, state.nations.get(1)!, [...owners.keys()], createRng("r"));

    expect(rebelNation).not.toBeNull();
    expect(rebelNation!.parent).toBe(1);
    expect(state.state.owner[0]).toBe(1); // the capital stays loyal
    const rebelCells = [...state.state.owner].filter((o) => o === rebelNation!.id).length;
    expect(rebelCells).toBeGreaterThanOrEqual(SIM.MIN_AREA);
  });

  it("can't happen in a nation with no far provinces", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0)]);
    expect(rebel(state, state.nations.get(1)!, [0, 1, 2], createRng("r"))).toBeNull();
  });

  it("a handful of subject people too few to form a nation can't shield an empire", () => {
    const length = SIM.REBEL_MIN_CAPITAL_DIST + SIM.MIN_AREA + 3;
    const owners = Array(length).fill(1);
    const races = owners.map((_, i) => (i === length - 1 ? Race.Orc : Race.Human));
    const state = makeState(row(length), owners, [makeNation(1, 0)], undefined, races);
    const rebelNation = rebel(state, state.nations.get(1)!, [...owners.keys()], createRng("r"));
    expect(rebelNation?.race).toBe(Race.Human); // the ruling people rise instead
  });

  it("subject people who can form a nation still rise first", () => {
    const length = SIM.REBEL_MIN_CAPITAL_DIST + SIM.MIN_AREA + 3;
    const owners = Array(length).fill(1);
    const races = owners.map((_, i) => (i >= length - SIM.MIN_AREA ? Race.Orc : Race.Human));
    const state = makeState(row(length), owners, [makeNation(1, 0)], undefined, races);
    expect(rebel(state, state.nations.get(1)!, [...owners.keys()], createRng("r"))?.race).toBe(Race.Orc);
  });

  describe("how often", () => {
    const LENGTH = 60;
    // Revolts are rare by default: make them common enough to count in a few hundred tries.
    const restless = SIM.REBEL_RESTLESS_CELLS;
    beforeAll(() => { SIM.REBEL_RESTLESS_CELLS = LENGTH / 2; });
    afterAll(() => { SIM.REBEL_RESTLESS_CELLS = restless; });

    // A shaky nation holding a long row of land, as restless as `unrest`.
    function shaky(unrest: number) {
      const owners = Array(LENGTH).fill(1);
      const state = makeState(row(LENGTH), owners, [makeNation(1, 0, { stability: 0, reserve: 10, manpowerCap: 10 })]);
      state.state.unrest.fill(unrest);
      return state;
    }
    const revolts = (unrest: number, seed: string) =>
      rebellions(shaky(unrest), createRng(seed)).filter((e) => e.type === "rebellion").length;
    const total = (unrest: number) => Array.from({ length: 300 }, (_, i) => revolts(unrest, `s${i}`)).reduce((a, b) => a + b, 0);

    it("calm land doesn't revolt, however shaky the nation", () => {
      expect(total(0)).toBe(0);
    });

    it("the more restless the land, the more often it revolts", () => {
      expect(total(1)).toBeGreaterThan(total(0.1) * 2);
    });

    it("one revolt can set off more in the same year", () => {
      const spread = SIM.REBEL_SPREAD;
      SIM.REBEL_SPREAD = 1;
      const most = Math.max(...Array.from({ length: 300 }, (_, i) => revolts(1, `s${i}`)));
      SIM.REBEL_SPREAD = 0;
      const one = Math.max(...Array.from({ length: 300 }, (_, i) => revolts(1, `s${i}`)));
      SIM.REBEL_SPREAD = spread;
      expect(most).toBeGreaterThan(1);
      expect(most).toBeLessThanOrEqual(SIM.REBEL_MAX_SPREAD);
      expect(one).toBe(1);
    });
  });
});

describe("collapse", () => {
  it("dissolves a tiny nation into its strongest neighbor", () => {
    // Nation 1 (strong) owns 0–6; nation 2 (tiny) owns 7–8.
    const owners = [1, 1, 1, 1, 1, 1, 1, 2, 2];
    const state = makeState(row(9), owners, [
      makeNation(1, 0, { strength: 10 }),
      makeNation(2, 8, { strength: 1 }),
    ]);
    const events = collapses(state);
    expect(state.nations.get(2)!.alive).toBe(false);
    expect([...state.state.owner]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 0]); // cell 8 has no foreign neighbor
    expect(events[0]!.type).toBe("annexed");
  });

  it("moves the capital when it's lost", () => {
    const owners = [2, 1, 1, 1, 1, 1, 1, 1];
    const state = makeState(row(8), owners, [makeNation(1, 0, { stability: 0.8 }), makeNation(2, 0)]);
    const events = collapses(state);
    const nation = state.nations.get(1)!;
    expect(state.state.owner[nation.capital]).toBe(1);
    expect(nation.stability).toBeLessThan(0.8);
    expect(events.some((e) => e.type === "capital_moved")).toBe(true);
  });
});

describe("emergence", () => {
  it("finds connected empty regions", () => {
    // [0][1] empty, [2] owned, [3][4] empty → two regions.
    const state = makeState(row(5), [0, 0, 1, 0, 0], [makeNation(1, 2)]);
    expect(emptyRegions(state)).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });

  it("eventually founds a nation in a big empty region", () => {
    const size = SIM.EMERGENCE_MIN_REGION + 5;
    const state = makeState(row(size), Array(size).fill(0), []);
    for (let year = 1; year <= 2000 && state.nations.size === 0; year++) {
      state.year = year;
      emergence(state, createRng(`e${year}`));
    }
    expect(state.nations.size).toBe(1);
  });
});

describe("1,000 years of history", () => {
  // SPEC §7: same seed + same settings = identical history.
  function run(seed: string) {
    const { state } = generateWorld(seed, 320, 180);
    const rng = createRng(seed).fork("sim");
    for (let i = 0; i < 1000; i++) tick(state, rng);
    return state;
  }

  it("is identical for the same seed", () => {
    const a = run("determinism");
    const b = run("determinism");
    expect(a.events).toEqual(b.events);
    expect([...a.state.owner]).toEqual([...b.state.owner]);
  });

  it("has empires that break apart", () => {
    const state = run("determinism");
    expect(state.events.some((e) => e.type === "rebellion")).toBe(true);
  });
}, 60000);

describe("rebel armies", () => {
  // A long row: nation 1's far end rises up.
  function restless() {
    const state = makeState(row(30), Array(30).fill(1), [makeNation(1, 0, { reserve: 10, manpowerCap: 10, stability: 0 })]);
    state.state.pop.fill(5);
    state.state.unrest.fill(1);
    state.year = 100;
    return state;
  }
  const rise = (state: ReturnType<typeof restless>) => {
    const nation = state.nations.get(1)!;
    const before = SIM.REBEL_PROB;
    SIM.REBEL_PROB = 100; // always rebels
    const events = rebellions(state, createRng("rise"));
    SIM.REBEL_PROB = before;
    return { nation, events };
  };

  it("some of the old nation's soldiers go over to the rebels", () => {
    const state = restless();
    const { nation } = rise(state);
    expect(nation.reserve).toBeCloseTo(10 * (1 - SIM.REBEL_LEVY));
  });

  it("if the old nation fights, the rebels raise an army at once and it's a war to reclaim the land", () => {
    const before = SIM.REBEL_WAR_PROB;
    SIM.REBEL_WAR_PROB = 1;
    const state = restless();
    const { events } = rise(state);
    SIM.REBEL_WAR_PROB = before;
    const war = state.wars[0]!;
    expect(war.goal).toBe("reclaim");
    expect(war.goalCells.length).toBeGreaterThan(0);
    expect(state.armies.map((a) => a.owner)).toEqual([war.defender]);
    expect(state.armies[0]!.size).toBeGreaterThan(0);
    expect(events.some((e) => e.text.includes("crush the rebellion"))).toBe(true);
  });

  it("no war if the old nation lets them go, or is already at its limit", () => {
    const before = SIM.REBEL_WAR_PROB;
    SIM.REBEL_WAR_PROB = 0;
    const state = restless();
    rise(state);
    SIM.REBEL_WAR_PROB = 1;
    const busy = restless();
    for (let i = 0; i < SIM.MAX_WARS_PER_NATION; i++) {
      busy.wars.push({ id: i + 100, attacker: 1, defender: 9, startYear: 0, score: 0, battleScore: 0, goal: "raid" as const, goalCells: [] });
    }
    rise(busy);
    SIM.REBEL_WAR_PROB = before;
    expect(state.wars).toHaveLength(0);
    expect(busy.wars).toHaveLength(SIM.MAX_WARS_PER_NATION);
  });
});
