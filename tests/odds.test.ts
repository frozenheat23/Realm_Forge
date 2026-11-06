// Odds: possible futures from the present (docs/systems/sandbox.md).
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import type { War, WorldState } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { runFuture, runFutures } from "../src/sim/odds";
import { SIM } from "../src/sim/params";
import { toSnapshot } from "../src/sim/snapshot";
import { tick } from "../src/sim/tick";
import { recordOf } from "../src/sim/warRecords";

const SEED = "odds-test";

/** A small world run until a war between two nations has just begun. */
function worldAtWar(): { state: WorldState; world: ReturnType<typeof generateWorld>["world"]; war: War } {
  const { world, state } = generateWorld(SEED, 320, 180);
  const rng = createRng(SEED).fork("sim");
  for (let y = 0; y < 300; y++) {
    tick(state, rng);
    const war = state.wars.find((w) => w.joined === undefined && w.startYear === state.year && w.goal !== "raid");
    if (war && state.year > 20) return { state, world, war };
  }
  throw new Error("no war in 300 years");
}

describe("odds", () => {
  it("future 0 is the real future", async () => {
    const { state, world, war } = worldAtWar();
    const snapshot = structuredClone(toSnapshot(state, SIM));
    const question = { war: war.id, nation: war.defender, years: 25 };
    const future = await runFuture(snapshot, world, question, 0);

    // Now let the real history run on.
    const rng = createRng(SEED).fork("sim");
    for (let y = 0; y < 25; y++) tick(state, rng);
    const outcome = recordOf(state, war.id)!.outcome;
    expect(future.war!.result === "going").toBe(outcome === undefined);
    expect(future.nation!.alive).toBe(state.nations.get(war.defender)!.alive);
    expect(future.nation!.area).toBe(state.nations.get(war.defender)!.alive ? state.nations.get(war.defender)!.area : 0);
  }, 60_000);

  it("gives the same odds for the same moment, and the futures differ", async () => {
    const { state, world, war } = worldAtWar();
    const snapshot = structuredClone(toSnapshot(state, SIM));
    const question = { war: war.id, nation: war.attacker, years: 25 };
    const first = await runFutures(snapshot, world, question, 6);
    const second = await runFutures(snapshot, world, question, 6);
    expect(second).toEqual(first);
    expect(new Set(first.nation!.areas).size).toBeGreaterThan(1);
    const counted = Object.values(first.war!.results).reduce((a, b) => a + b, 0);
    expect(counted).toBe(6);
  }, 60_000);

  it("a much stronger attacker wins in most futures", async () => {
    const { state, world, war } = worldAtWar();
    // Strip the defender of soldiers and give the attacker plenty.
    const attacker = state.nations.get(war.attacker)!;
    const defender = state.nations.get(war.defender)!;
    state.armies = state.armies.filter((a) => a.owner !== defender.id);
    defender.reserve = 0;
    attacker.reserve *= 20;
    const odds = await runFutures(structuredClone(toSnapshot(state, SIM)), world, { war: war.id, years: 30 }, 10);
    expect(odds.war!.results.attacker).toBeGreaterThanOrEqual(7);
  }, 60_000);

  it("never changes the real history", async () => {
    const { state, world, war } = worldAtWar();
    const before = JSON.stringify(toSnapshot(state, SIM));
    await runFutures(toSnapshot(state, SIM), world, { war: war.id, nation: war.attacker, years: 10 }, 3);
    expect(JSON.stringify(toSnapshot(state, SIM))).toBe(before);
  }, 60_000);
});
