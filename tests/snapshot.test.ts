import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { generateWorld } from "../src/gen";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { fromSnapshot, toSnapshot } from "../src/sim/snapshot";
import { tick } from "../src/sim/tick";
import { runYears } from "./longRun";

const SEED = "snapshot";
const run = async (state: ReturnType<typeof generateWorld>["state"], from: number, to: number) => {
  const rng = createRng(SEED).fork("sim");
  await runYears(to - from, () => tick(state, rng));
};

describe("save and load", () => {
  it("continuing from a save gives exactly the same history", async () => {
    // Straight run: year 0 → 500.
    const straight = generateWorld(SEED, 320, 180).state;
    await run(straight, 0, 500);

    // Saved run: 0 → 300, save to JSON text, load, then 300 → 500.
    const first = generateWorld(SEED, 320, 180);
    await run(first.state, 0, 300);
    const text = JSON.stringify(toSnapshot(first.state, SIM));
    const world = generateWorld(SEED, 320, 180).world; // rebuilt from the seed, like the app does
    const resumed = fromSnapshot(JSON.parse(text), world);
    await run(resumed, 300, 500);

    expect(resumed.year).toBe(500);
    expect(resumed.events).toEqual(straight.events);
    expect([...resumed.state.owner]).toEqual([...straight.state.owner]);
  }, 60000);

  it("refuses a save made for another seed", () => {
    const { state } = generateWorld("one", 320, 180);
    const other = generateWorld("two", 320, 180).world;
    expect(() => fromSnapshot(toSnapshot(state, SIM), other)).toThrow();
  });

  it("stores the simulation settings with the save", () => {
    const { state } = generateWorld(SEED, 320, 180);
    expect(toSnapshot(state, SIM).params).toEqual(SIM_DEFAULTS);
  });
});
