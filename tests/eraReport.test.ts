// The era report: an opt-in measuring tool for very long histories (2,000–5,000 years).
// It cuts one long run into eras and measures each, to show whether late history
// still moves or has frozen. Run a shard with:
//   ERA_REPORT=validation ERA_YEARS=5000 ERA_SHARD=0/6 npx vitest run tests/eraReport.test.ts
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import type { WorldState } from "../src/core/types";
import { PLAYABLE_RACES } from "../src/gen/races";
import { createWorld } from "../src/sim/start";
import { tick } from "../src/sim/tick";
import { runYears } from "./longRun";
import { BROKEN_SHARE, GIANT_SHARE, worldsOf, type WorldSpec } from "./worldReport";

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const set = env.ERA_REPORT;
const YEARS = Number(env.ERA_YEARS ?? 5000);
/** Length of one era in years. */
const ERA = Number(env.ERA_LENGTH ?? 500);
const [shard, shards] = (env.ERA_SHARD ?? "0/1").split("/").map(Number) as [number, number];

/** Each crown (overlord with its living vassals, or a realm on its own) and its share of the land. */
function crownShares(state: WorldState, land: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of state.state.owner) {
    if (id === 0) continue;
    const n = state.nations.get(id)!;
    const crown = n.overlord !== undefined && state.nations.get(n.overlord)?.alive ? n.overlord : id;
    counts.set(crown, (counts.get(crown) ?? 0) + 1);
  }
  for (const [crown, count] of counts) counts.set(crown, count / land);
  return counts;
}

/** What one era adds up while it runs. */
function emptyEra() {
  return { topShareSum: 0, peakCrown: 0, giantYears: 0, giantsRisen: 0, giantsBroken: 0, leadChanges: 0, tickMs: 0 };
}

async function measureEras(spec: WorldSpec): Promise<Record<string, number | string>[]> {
  const { state } = createWorld(spec.seed, spec.start, spec.width, spec.height);
  const rng = createRng(spec.seed).fork("sim");
  const land = state.cells.filter((c) => c.isLand).length;
  const founders = [...state.nations.keys()];
  const rows: Record<string, number | string>[] = [];
  // Great empires standing now (a crown that broke and rises again counts again).
  const giants = new Set<number>();
  let leader = 0;
  let era = emptyEra();

  await runYears(YEARS, () => {
    const t = performance.now();
    tick(state, rng);
    era.tickMs += performance.now() - t;

    const shares = crownShares(state, land);
    let top = 0;
    let topCrown = 0;
    for (const [crown, share] of shares) {
      if (share > top) [top, topCrown] = [share, crown];
      if (share >= GIANT_SHARE && !giants.has(crown)) {
        giants.add(crown);
        era.giantsRisen++;
      }
    }
    for (const crown of giants) {
      if ((shares.get(crown) ?? 0) >= BROKEN_SHARE) continue;
      giants.delete(crown);
      era.giantsBroken++;
    }
    if (topCrown !== leader && leader !== 0) era.leadChanges++;
    leader = topCrown;
    era.topShareSum += top;
    era.peakCrown = Math.max(era.peakCrown, top);
    if (top >= GIANT_SHARE) era.giantYears++;

    if (state.year % ERA !== 0) return;
    rows.push(eraRow(spec, state, era, shares, founders));
    era = emptyEra();
  });
  return rows;
}

/** The finished era's numbers. */
function eraRow(spec: WorldSpec, state: WorldState, era: ReturnType<typeof emptyEra>, shares: Map<number, number>, founders: number[]): Record<string, number | string> {
  const from = state.year - ERA;
  const centuries = ERA / 100;
  const inEra = (year: number) => year > from && year <= state.year;
  const wars = state.warRecords.filter((w) => inEra(w.start));
  const decided = wars.filter((w) => w.end !== undefined && w.outcome?.winner !== undefined);
  const events = state.events.filter((e) => inEra(e.year));
  const count = (test: (text: string, type: string) => boolean) => events.filter((e) => test(e.text, e.type)).length;
  const living = [...state.nations.values()].filter((n) => n.alive);
  const raceCounts = new Map<number, number>();
  let settled = 0;
  for (const r of state.state.race) {
    if (r === 0) continue;
    raceCounts.set(r, (raceCounts.get(r) ?? 0) + 1);
    settled++;
  }
  return {
    seed: spec.seed,
    kind: spec.kind,
    era: state.year,
    warsPerCentury: wars.length / centuries,
    attackerWinShare: decided.filter((w) => w.outcome!.winner === w.attacker).length / Math.max(1, decided.length),
    rebellionsPerCentury: count((_, type) => type === "rebellion") / centuries,
    civilWarsPerCentury: count((text) => text.includes("civil war tears")) / centuries,
    newRealmsPerCentury: [...state.nations.values()].filter((n) => inEra(n.founded)).length / centuries,
    realmsFallenPerCentury: count((_, type) => type === "collapse" || type === "annexed") / centuries,
    independenceWinsPerCentury: count((text, type) => type === "vassal" && text.includes("wins its independence")) / centuries,
    realmsAtEnd: living.length,
    crownsAtEnd: shares.size,
    vassalsAtEnd: living.filter((n) => n.overlord !== undefined && state.nations.get(n.overlord)?.alive).length,
    foundersAlive: founders.filter((id) => state.nations.get(id)!.alive).length,
    oldestRealmAge: Math.max(...living.map((n) => state.year - n.founded)),
    topCrownShare: era.topShareSum / ERA,
    peakCrownShare: era.peakCrown,
    giantYearsShare: era.giantYears / ERA,
    giantsRisen: era.giantsRisen,
    giantsBroken: era.giantsBroken,
    leadChanges: era.leadChanges,
    biggestRaceShare: Math.max(...PLAYABLE_RACES.map((r) => (raceCounts.get(r) ?? 0) / Math.max(settled, 1))),
    tickMs: era.tickMs / ERA,
  };
}

describe.runIf(set)("era report", () => {
  it("measures its share of the set's worlds, era by era", async () => {
    const worlds = worldsOf(set!).filter((_, i) => i % shards === shard);
    for (const world of worlds) {
      for (const row of await measureEras(world)) {
        for (const value of Object.values(row)) if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
        console.log(`ERA_ROW ${JSON.stringify(row)}`);
      }
    }
  }, 7_200_000);
});
