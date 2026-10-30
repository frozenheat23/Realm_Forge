import { describe, expect, it } from "vitest";
import { Biome, NO_TARGET, type Army } from "../src/core/types";
import { createRng } from "../src/core/rng";
import { generateWorld } from "../src/gen";
import { disbandArmies, findPath, marchArmies, musterArmies } from "../src/sim/armies";
import { loseSoldiers, soldiers } from "../src/sim/manpower";
import { SIM } from "../src/sim/params";
import { fromSnapshot, toSnapshot } from "../src/sim/snapshot";
import { tick } from "../src/sim/tick";
import { makeNation, makeState, row } from "./tinyWorld";

const war = (id = 1) => ({ id, attacker: 1, defender: 2, startYear: 0, score: 0 });

// Nation 1 owns 0–9, nation 2 owns 10–19, in a row.
function atWar() {
  const owners = Array.from({ length: 20 }, (_, i) => (i < 10 ? 1 : 2));
  const state = makeState(row(20), owners, [
    makeNation(1, 0, { reserve: 10, manpowerCap: 10 }),
    makeNation(2, 19, { reserve: 10, manpowerCap: 10 }),
  ]);
  state.wars.push(war());
  return state;
}

function army(extra: Partial<Army> = {}): Army {
  return { id: 1, owner: 1, war: 1, cell: 0, size: 1, morale: 1, target: NO_TARGET, path: [], trail: [0], ...extra };
}

describe("raising armies", () => {
  it("each side raises one army per war, out of its reserve", () => {
    const state = atWar();
    musterArmies(state);
    expect(state.armies.map((a) => a.owner)).toEqual([1, 2]);
    // Raised soldiers still count: they've only moved from the reserve to the army.
    expect(soldiers(state, state.nations.get(1)!)).toBeCloseTo(10);
    expect(state.armies[0]!.size).toBeGreaterThan(state.nations.get(1)!.reserve);
    musterArmies(state);
    expect(state.armies).toHaveLength(2); // no second army for the same war
  });

  it("splits the reserve between two new wars", () => {
    const state = atWar();
    state.wars.push({ ...war(2), attacker: 2, defender: 1 });
    musterArmies(state);
    const mine = state.armies.filter((a) => a.owner === 1);
    expect(mine).toHaveLength(2);
    expect(mine[0]!.size).toBeCloseTo(mine[1]!.size);
    expect(mine[0]!.size).toBeLessThan(10 * SIM.MOBILIZE_SHARE);
  });

  it("doesn't raise an army too small to matter", () => {
    const state = atWar();
    state.nations.get(1)!.reserve = SIM.MIN_ARMY_SIZE / 2;
    musterArmies(state);
    expect(state.armies.filter((a) => a.owner === 1)).toHaveLength(0);
  });

  it("only armies in supply get fresh soldiers", () => {
    const state = atWar();
    state.armies.push(army({ cell: 2, size: 1 }), army({ id: 2, war: 1, owner: 2, cell: 2, size: 1 }));
    musterArmies(state);
    expect(state.armies[0]!.size).toBeGreaterThan(1); // nation 1, at home
    expect(state.armies[1]!.size).toBe(1); // nation 2, deep in enemy land
  });

  it("battle losses come from the army of that war first", () => {
    const state = atWar();
    const nation = state.nations.get(1)!;
    state.armies.push(army({ size: 2 }));
    loseSoldiers(state, nation, 1.5, 1);
    expect(state.armies[0]!.size).toBeCloseTo(0.5);
    expect(nation.reserve).toBe(10);
  });
});

describe("marching", () => {
  it("heads for the enemy and walks at most ARMY_MOVE per season", () => {
    const state = atWar();
    state.armies.push(army({ cell: 0 }));
    marchArmies(state);
    const a = state.armies[0]!;
    expect(a.target).toBeGreaterThanOrEqual(10);
    expect(a.cell).toBe(Math.min(SIM.ARMY_MOVE * SIM.CAMPAIGN_STEPS, a.target));
    expect(a.trail[0]).toBe(0);
    expect(a.trail[a.trail.length - 1]).toBe(a.cell);
  });

  it("hard ground is slower, but an army can always enter one cell per season", () => {
    const spec = row(20, { biome: Biome.Tundra });
    const owners = Array.from({ length: 20 }, (_, i) => (i < 10 ? 1 : 2));
    const state = makeState(spec, owners, [makeNation(1, 0), makeNation(2, 19)]);
    state.wars.push(war());
    state.armies.push(army({ cell: 0 }));
    marchArmies(state);
    const walked = state.armies[0]!.cell;
    expect(walked).toBeLessThan(SIM.ARMY_MOVE * SIM.CAMPAIGN_STEPS);
    expect(walked).toBeGreaterThanOrEqual(SIM.CAMPAIGN_STEPS);
  });

  it("never crosses a neutral nation", () => {
    // 1 1 3 3 2 2: nation 3 is at peace with both and blocks the way.
    const state = makeState(row(6), [1, 1, 3, 3, 2, 2], [makeNation(1, 0), makeNation(2, 5), makeNation(3, 2)]);
    expect(findPath(state, 0, 5, 1)).toEqual([]);
    state.alliances.push({ a: 1, b: 3, since: 0 });
    expect(findPath(state, 0, 5, 1)).toEqual([]); // allied with 3, but 2 is neutral to it too
    state.wars.push(war());
    expect(findPath(state, 0, 5, 1)).toEqual([1, 2, 3, 4, 5]); // now it can march through its ally
  });

  it("takes the cheaper way round a mountain of move cost", () => {
    // 0 can reach 3 through 1 (hard) or 2 (easy).
    const state = makeState(
      [{ neighbors: [1, 2] }, { neighbors: [0, 3], biome: Biome.Desert }, { neighbors: [0, 3] }, { neighbors: [1, 2] }],
      [1, 1, 1, 1],
      [makeNation(1, 0)],
    );
    expect(findPath(state, 0, 3, 1)).toEqual([2, 3]);
  });

  it("picks a new target once its target has changed hands", () => {
    const state = atWar();
    state.armies.push(army({ cell: 12, target: 12 }));
    state.state.owner[12] = 1;
    marchArmies(state);
    expect(state.armies[0]!.target).not.toBe(12);
  });
});

describe("disbanding", () => {
  it("soldiers go home when the war ends", () => {
    const state = atWar();
    musterArmies(state);
    state.wars = [];
    disbandArmies(state);
    expect(state.armies).toHaveLength(0);
    expect(state.nations.get(1)!.reserve).toBeCloseTo(10);
  });

  it("a dead nation's army melts away", () => {
    const state = atWar();
    musterArmies(state);
    state.nations.get(1)!.alive = false;
    disbandArmies(state);
    expect(state.armies.map((a) => a.owner)).toEqual([2]);
  });
});

describe("a whole history", () => {
  const SEED = "armies";
  const run = (state: ReturnType<typeof generateWorld>["state"], years: number) => {
    const rng = createRng(SEED).fork("sim");
    for (let y = 0; y < years; y++) tick(state, rng);
  };

  it("armies come and go, and every one belongs to a living nation in a war", () => {
    const { state } = generateWorld(SEED, 320, 180);
    let seen = 0;
    const rng = createRng(SEED).fork("sim");
    for (let y = 0; y < 300; y++) {
      tick(state, rng);
      seen += state.armies.length;
      const wars = new Set(state.wars.map((w) => w.id));
      for (const a of state.armies) {
        expect(wars.has(a.war)).toBe(true);
        expect(state.nations.get(a.owner)!.alive).toBe(true);
        expect(a.size).toBeGreaterThan(0);
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 60000);

  it("armies survive a save and load", () => {
    const { state } = generateWorld(SEED, 320, 180);
    run(state, 120);
    const world = generateWorld(SEED, 320, 180).world;
    const copy = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(state, SIM))), world);
    expect(copy.armies).toEqual(state.armies);
    expect(copy.nextArmyId).toBe(state.nextArmyId);
  }, 60000);
});
