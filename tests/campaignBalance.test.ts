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
      let peakCrown = 0;
      const land = state.cells.filter((c) => c.isLand).length;
      // Vassals (docs/systems/vassalage.md): when each began serving its current overlord, and how long finished services lasted.
      const serving = new Map<number, { overlord: number; since: number }>();
      const served: number[] = [];
      await runYears(YEARS, () => {
        tick(state, rng);
        const crowns = new Map<number, number>();
        for (const n of state.nations.values()) {
          if (n.alive) peakEmpire = Math.max(peakEmpire, n.area / land);
          const now = n.alive ? n.overlord : undefined;
          const was = serving.get(n.id);
          if (was && was.overlord !== now) {
            served.push(state.year - was.since);
            serving.delete(n.id);
          }
          if (now !== undefined && !serving.has(n.id)) serving.set(n.id, { overlord: now, since: state.year });
          if (n.alive) crowns.set(now ?? n.id, (crowns.get(now ?? n.id) ?? 0) + n.area);
        }
        for (const area of crowns.values()) peakCrown = Math.max(peakCrown, area / land);
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
        peakCrownShare: peakCrown,
        submissionsPerCentury: state.events.filter((e) => e.type === "vassal" && e.text.includes("submits")).length / (YEARS / 100),
        independenceWarsPerCentury: state.events.filter((e) => e.type === "vassal" && e.text.includes("declares independence")).length / (YEARS / 100),
        vassalsAtEnd: [...state.nations.values()].filter((n) => n.alive && n.overlord !== undefined).length,
        vassalLandShareAtEnd: [...state.nations.values()].filter((n) => n.alive && n.overlord !== undefined).reduce((a, n) => a + n.area, 0) / land,
        finishedServices: served.length,
        averageServiceYears: mean(served),
      };
      for (const value of Object.values(row)) if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      rows.push(row);
    }
    console.log(`CAMPAIGN_REPORT ${JSON.stringify({ set, years: YEARS, width: 320, height: 180, rows })}`);
  }, 600_000);
});
