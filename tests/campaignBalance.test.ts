// An opt-in measuring tool, not a claim that one set of averages proves good balance.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { createWorld } from "../src/sim/start";
import { tick } from "../src/sim/tick";
import { runYears } from "./longRun";

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const set = env.CAMPAIGN_BALANCE;
const YEARS = 500;
const WORLDS = 10;

describe.runIf(set)("campaign balance report", () => {
  it("reports fixed worlds separately for tuning and unseen validation", async () => {
    const rows = [];
    for (let i = 0; i < WORLDS; i++) {
      const seed = `campaign-${set}-${i}`;
      const { state } = createWorld(seed, { kind: "settled", kingdoms: 10 }, 320, 180);
      const rng = createRng(seed).fork("sim");
      let peakEmpire = 0;
      const land = state.cells.filter((c) => c.isLand).length;
      await runYears(YEARS, () => {
        tick(state, rng);
        for (const n of state.nations.values()) if (n.alive) peakEmpire = Math.max(peakEmpire, n.area / land);
      });
      const ended = state.warRecords.filter((w) => w.end !== undefined);
      const decided = ended.filter((w) => w.outcome?.winner !== undefined);
      const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
      const mean = (values: number[]) => sum(values) / Math.max(1, values.length);
      const row = {
        seed,
        warsPerCentury: state.warRecords.length / (YEARS / 100),
        averageWarYears: mean(ended.map((w) => w.end! - w.start)),
        attackerWinShare: decided.filter((w) => w.outcome!.winner === w.attacker).length / Math.max(1, decided.length),
        whitePeaceShare: ended.filter((w) => w.outcome?.winner === undefined).length / Math.max(1, ended.length),
        lossesPerWar: mean(ended.map((w) => w.fallen.attack + w.fallen.defend)),
        cellsChangedPerCentury: sum(ended.map((w) => w.outcome?.cells ?? 0)) / (YEARS / 100),
        battlesPerWar: mean(ended.map((w) => w.battles.length)),
        peakEmpireShare: peakEmpire,
        livingRealms: [...state.nations.values()].filter((n) => n.alive).length,
      };
      for (const value of Object.values(row)) if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      rows.push(row);
    }
    console.log(`CAMPAIGN_REPORT ${JSON.stringify({ set, years: YEARS, width: 320, height: 180, rows })}`);
  }, 600_000);
});
