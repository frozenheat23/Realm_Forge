// Misjudgment (M18 part 1, docs/systems/realwar.md): nations go to war on what they believe.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Race, type RaceId, type WorldState } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { traits } from "../src/gen/races";
import { makeRuler } from "../src/gen/rulers";
import { AI, estimate } from "../src/sim/ai/default";
import type { WarContext } from "../src/sim/ai/controller";
import { SIM } from "../src/sim/params";
import { fromSnapshot, toSnapshot } from "../src/sim/snapshot";
import { makeNation, makeState, row } from "./tinyWorld";

const RACES: RaceId[] = [Race.Human, Race.LightElf, Race.DarkElf, Race.Dwarf, Race.Orc];
const nothing: WarContext = { claim: false, myHelpers: [], theirHelpers: [] };

/** Average estimate of a fair fight (true ratio 1) over many years. */
function averageEstimate(race: RaceId, boldness = 1, rivalRace: RaceId = race): number {
  const me = makeNation(1, 0, { race });
  me.ruler.boldness = boldness;
  const them = makeNation(2, 1, { race: rivalRace });
  const rng = createRng("estimates");
  let sum = 0;
  for (let i = 0; i < 2000; i++) sum += estimate(me, them, 1, rng);
  return sum / 2000;
}

describe("misjudgment", () => {
  it("proud races and bold rulers overrate themselves", () => {
    expect(averageEstimate(Race.Orc)).toBeGreaterThan(averageEstimate(Race.Human));
    expect(averageEstimate(Race.Human)).toBeGreaterThan(averageEstimate(Race.Dwarf));
    expect(averageEstimate(Race.Human, 1.5)).toBeCloseTo(1.5 * averageEstimate(Race.Human), 5);
  });

  it("strangers are harder to judge than kin", () => {
    const spread = (rival: RaceId) => {
      const me = makeNation(1, 0, { race: Race.Human });
      const them = makeNation(2, 1, { race: rival });
      const rng = createRng("spread");
      const logs = Array.from({ length: 2000 }, () => Math.log(estimate(me, them, 1, rng)));
      return Math.max(...logs) - Math.min(...logs);
    };
    expect(spread(Race.Orc)).toBeGreaterThan(spread(Race.Human) * 1.3);
    expect(spread(Race.Human)).toBeLessThanOrEqual(2 * SIM.INTEL_ERROR);
  });

  it("rulers' boldness stays in their race's range, and Humans vary most", () => {
    const rng = createRng("crowns");
    const range = (race: RaceId) => {
      const b = Array.from({ length: 500 }, () => makeRuler(rng, race, 0, "House Test").boldness);
      const t = traits(race).temper;
      for (const x of b) expect(Math.abs(Math.log(x))).toBeLessThanOrEqual(t + 1e-9);
      return Math.max(...b) / Math.min(...b);
    };
    const human = range(Race.Human);
    for (const race of RACES.filter((r) => r !== Race.Human)) expect(human).toBeGreaterThan(range(race));
  });

  it("a timid weak realm never attacks; a reckless one sometimes does", () => {
    // Nation 1 has a third of nation 2's soldiers.
    const state: WorldState = makeState(row(6), [1, 1, 1, 2, 2, 2], [makeNation(1, 0, { reserve: 10 }), makeNation(2, 5, { reserve: 30 })]);
    const [weak, strong] = [state.nations.get(1)!, state.nations.get(2)!];
    const attacks = () => {
      let n = 0;
      for (let i = 0; i < 3000; i++) if (AI.declareWar(state, weak, strong, nothing, createRng(`try-${i}`)) !== null) n++;
      return n;
    };
    weak.ruler.boldness = 1;
    expect(attacks()).toBe(0);
    weak.ruler.boldness = 5;
    expect(attacks()).toBeGreaterThan(0);
  });

  it("rulers from saves before boldness judge plainly", () => {
    const { world, state } = generateWorld("misjudgment-save", 320, 180);
    const snapshot = JSON.parse(JSON.stringify(toSnapshot(state, SIM)));
    for (const n of snapshot.nations) delete n.ruler.boldness;
    const loaded = fromSnapshot({ ...snapshot, version: 11 }, world);
    for (const n of loaded.nations.values()) expect(n.ruler.boldness).toBe(1);
  });
});
