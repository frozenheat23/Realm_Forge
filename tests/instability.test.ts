import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { generateWorld } from "../src/gen";
import { collapses } from "../src/sim/collapse";
import { emergence, emptyRegions } from "../src/sim/emergence";
import { SIM } from "../src/sim/params";
import { rebel } from "../src/sim/rebellion";
import { controlMap } from "../src/sim/control";
import { updateStability } from "../src/sim/stability";
import { tick } from "../src/sim/tick";
import { makeNation, makeState, row } from "./tinyWorld";

describe("stability", () => {
  it("recovers slowly for a small nation at peace", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { stability: 0.5, area: 3 })]);
    updateStability(state);
    expect(state.nations.get(1)!.stability).toBeCloseTo(0.5 + SIM.STAB_RECOVERY);
  });

  it("drops for a nation far past its admin cap", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { stability: 0.5, area: SIM.ADMIN_CAP_BASE + 100 })]);
    updateStability(state);
    expect(state.nations.get(1)!.stability).toBeLessThan(0.5);
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
