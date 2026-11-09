// The world report: an opt-in measuring tool, not a pass/fail check. Run it with
// `npm run report -- tuning` (or `validation`), which splits the worlds into shards.
import { describe, expect, it } from "vitest";
import { SIM } from "../src/sim/params";
import { measureWorld, worldsOf } from "./worldReport";

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const set = env.WORLD_REPORT;
// "2/6" = the third of six shards: worlds 2, 8, 14, ...
const [shard, shards] = (env.WORLD_SHARD ?? "0/1").split("/").map(Number) as [number, number];

describe.runIf(set)("world report", () => {
  it("measures its share of the set's worlds", async () => {
    // A variant to try (`--params '{"VASSAL_DEMAND_RATIO":3}'`): changed for this run only.
    Object.assign(SIM, JSON.parse(env.WORLD_PARAMS ?? "{}"));
    const worlds = worldsOf(set!).filter((_, i) => i % shards === shard);
    for (const world of worlds) {
      const row = await measureWorld(world);
      for (const value of Object.values(row)) if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      console.log(`WORLD_ROW ${JSON.stringify(row)}`);
    }
  }, 3_600_000);
});
