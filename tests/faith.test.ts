import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Faith, Race } from "../src/core/types";
import { faithAt } from "../src/gen/faiths";
import { opinionTarget } from "../src/sim/diplomacy";
import { commonFaith, conversionChance, convertRealms, spreadFaith } from "../src/sim/faith";
import { updateLand } from "../src/sim/land";
import { SIM } from "../src/sim/params";
import { makeNation, makeState, row } from "./tinyWorld";

/** Run spreading for `years` and return the state. */
function run(state: ReturnType<typeof makeState>, years: number) {
  const rng = createRng("faith");
  for (let y = 0; y < years; y++) spreadFaith(state, rng);
  return state;
}

describe("faith at the start", () => {
  const homes = [
    { race: Race.Orc, at: [0, 0] as [number, number] },
    { race: Race.Orc, at: [100, 0] as [number, number] },
  ];
  it("gives each homeland of a race the next of its faiths", () => {
    expect(faithAt(homes, Race.Orc, 10, 0)).toBe(Faith.RedHunger);
    expect(faithAt(homes, Race.Orc, 90, 0)).toBe(Faith.BoneDrums);
  });
});

describe("spreading", () => {
  it("carries the ruler's faith outward through the realm", () => {
    const state = makeState(row(4), [1, 1, 1, 1], [makeNation(1, 0)]);
    state.state.faith.set([Faith.RadiantCovenant, Faith.RedHunger, Faith.RedHunger, Faith.RedHunger]);
    run(state, 1000);
    expect([...state.state.faith]).toEqual(Array(4).fill(Faith.RadiantCovenant));
  });

  it("never changes a capital", () => {
    const state = makeState(row(2), [1, 1], [makeNation(1, 0)]);
    state.state.faith.set([Faith.RadiantCovenant, Faith.RedHunger]);
    run(state, 100);
    expect(state.state.faith[0]).toBe(Faith.RadiantCovenant);
  });

  it("is slower across the ruler's own faith", () => {
    const state = makeState(row(2), [1, 1], [makeNation(1, 0)]);
    const nation = state.nations.get(1)!;
    expect(conversionChance(state, 1, Faith.RedHunger, nation)).toBeLessThan(conversionChance(state, 1, Faith.RadiantCovenant, nation));
  });

  it("keeps elves-only faiths among Light Elves", () => {
    const state = makeState(row(2), [1, 1], [makeNation(1, 0)]);
    expect(conversionChance(state, 1, Faith.EvergreenVow, state.nations.get(1)!)).toBe(0);
    state.state.race[1] = Race.LightElf;
    expect(conversionChance(state, 1, Faith.EvergreenVow, state.nations.get(1)!)).toBeGreaterThan(0);
  });

  it("lets the Old Gods run through restless land and barely among elves", () => {
    const state = makeState(row(2), [1, 1], [makeNation(1, 0)]);
    const nation = state.nations.get(1)!;
    const calm = conversionChance(state, 1, Faith.OldGods, nation);
    state.state.unrest[1] = 1;
    expect(conversionChance(state, 1, Faith.OldGods, nation)).toBeGreaterThan(calm);
    state.state.unrest[1] = 0;
    state.state.race[1] = Race.DarkElf;
    expect(conversionChance(state, 1, Faith.OldGods, nation)).toBeLessThan(calm);
  });
});

describe("the Old Gods", () => {
  it("rise by themselves in very restless land, and say so", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { name: "Kethar" })]);
    state.state.unrest[2] = SIM.OLD_GODS_MIN_UNREST;
    const old = SIM.OLD_GODS_SPARK;
    SIM.OLD_GODS_SPARK = 1;
    const events = spreadFaith(state, createRng("spark"));
    SIM.OLD_GODS_SPARK = old;
    expect(state.state.faith[2]).toBe(Faith.OldGods);
    expect(events[0]!.text).toContain("the Old Gods stir in the east of Kethar");
  });

  it("don't rise in calm land", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0)]);
    run(state, 500);
    expect(state.state.faith.includes(Faith.OldGods)).toBe(false);
  });
});

describe("rebels", () => {
  it("take the faith most of their people hold", () => {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0)], [1, 5, 2]);
    state.state.faith.set([Faith.RadiantCovenant, Faith.BoneDrums, Faith.RadiantCovenant]);
    expect(commonFaith(state, [0, 1, 2])).toBe(Faith.BoneDrums);
  });
});

describe("a realm changes faith", () => {
  /** Nation 1 with its capital on cell 0, every other cell believing `faith`. */
  function drifted(faith: number, pop = [1, 1, 1]) {
    const state = makeState(row(3), [1, 1, 1], [makeNation(1, 0, { name: "Kethar" })], pop);
    state.state.faith.set([Faith.RadiantCovenant, faith, faith]);
    return state;
  }
  const always = () => {
    const old = SIM.FAITH_ADOPT;
    SIM.FAITH_ADOPT = 1;
    return () => (SIM.FAITH_ADOPT = old);
  };

  it("when most of its people follow another", () => {
    const state = drifted(Faith.BoneDrums);
    const restore = always();
    const events = convertRealms(state, createRng("c"));
    restore();
    expect(state.nations.get(1)!.faith).toBe(Faith.BoneDrums);
    expect(state.state.faith[0]).toBe(Faith.BoneDrums); // the capital goes with it
    expect(events[0]!.text).toContain("Kethar embraces the Bone Drums");
  });

  it("says it turned to the Old Gods", () => {
    const state = drifted(Faith.OldGods);
    const restore = always();
    const events = convertRealms(state, createRng("c"));
    restore();
    expect(events[0]!.text).toContain("Kethar turns to the Old Gods");
  });

  it("not while its faith still holds half the people", () => {
    const state = drifted(Faith.BoneDrums, [4, 1, 1]);
    const restore = always();
    convertRealms(state, createRng("c"));
    restore();
    expect(state.nations.get(1)!.faith).toBe(Faith.RadiantCovenant);
  });
});

describe("faith and the realm", () => {
  it("makes believers of another faith more restless, the more fervent the faith", () => {
    const unrestWith = (faith: number) => {
      const state = makeState(row(2), [1, 1], [makeNation(1, 0)]);
      state.state.faith[1] = faith;
      state.state.unrest[1] = 0.5;
      updateLand(state, new Float32Array([1, 1]), createRng("l"));
      return state.state.unrest[1]!;
    };
    expect(unrestWith(Faith.BoneDrums)).toBeGreaterThan(unrestWith(Faith.RadiantCovenant));
    expect(unrestWith(Faith.HollowMother)).toBeGreaterThan(unrestWith(Faith.BoneDrums));
  });

  it("warms nations of one faith to each other and cools others", () => {
    const a = makeNation(1, 0);
    const b = makeNation(2, 1);
    const same = opinionTarget(a, b, false, new Map());
    b.faith = Faith.RedHunger;
    expect(opinionTarget(a, b, false, new Map())).toBeLessThan(same);
  });
});
