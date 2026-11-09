// The world report (docs/measurements/README.md): runs one world for 1,000 years and measures
// the big picture — wars, empires and crowns, breakups, realms, vassals, races, speed.
// Used by tests/worldReport.test.ts, which `npm run report` runs in parallel shards.
import { createRng } from "../src/core/rng";
import type { StartOptions, WorldState } from "../src/core/types";
import { PLAYABLE_RACES } from "../src/gen/races";
import { createWorld } from "../src/sim/start";
import { tick } from "../src/sim/tick";
import { runYears } from "./longRun";

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** 1,000 years; WORLD_YEARS shortens it for a quick check that the report runs. */
export const YEARS = Number(env.WORLD_YEARS ?? 1000);
/** A crown (a realm with its vassals) holding this share of the land counts as a great empire. */
export const GIANT_SHARE = 0.25;
/** A great empire that later falls below this share (or vanishes) has broken apart. */
export const BROKEN_SHARE = 0.125;

/** One world to run: its seed, start and map size. */
export interface WorldSpec {
  seed: string;
  kind: "small" | "full" | "open";
  start: StartOptions;
  width?: number;
  height?: number;
}

/** The worlds of a set: 16 small settled, 4 full-size settled, 4 small open starts. */
export function worldsOf(set: string): WorldSpec[] {
  const settled: StartOptions = { kind: "settled", kingdoms: 10 };
  const worlds: WorldSpec[] = [];
  for (let i = 0; i < 16; i++) worlds.push({ seed: `world-${set}-small-${i}`, kind: "small", start: settled, width: 320, height: 180 });
  for (let i = 0; i < 4; i++) worlds.push({ seed: `world-${set}-full-${i}`, kind: "full", start: settled });
  for (let i = 0; i < 4; i++) worlds.push({ seed: `world-${set}-open-${i}`, kind: "open", start: { kind: "open" }, width: 320, height: 180 });
  return worlds;
}

/** Each crown (overlord, or independent realm) and the land it holds, as a share of all land. */
function crownShares(state: WorldState, land: number): Map<number, number> {
  const shares = new Map<number, number>();
  for (const n of state.nations.values()) {
    if (!n.alive) continue;
    const overlord = n.overlord !== undefined && state.nations.get(n.overlord)?.alive ? n.overlord : n.id;
    shares.set(overlord, (shares.get(overlord) ?? 0) + n.area / land);
  }
  return shares;
}

export async function measureWorld(spec: WorldSpec): Promise<Record<string, number | string>> {
  const { state } = createWorld(spec.seed, spec.start, spec.width, spec.height);
  const rng = createRng(spec.seed).fork("sim");
  const land = state.cells.filter((c) => c.isLand).length;
  const founders = [...state.nations.keys()];
  const alive = () => [...state.nations.values()].filter((n) => n.alive).length;
  const aliveAt: Record<number, number> = {};

  let peakRealm = 0;
  let peakCrown = 0;
  let tickMs = 0;
  // Great empires: the most each crown held, years spent at GIANT_SHARE or more, and whether it later broke apart.
  const giants = new Map<number, { years: number; broken: boolean }>();
  // Vassals: when each began serving its current overlord; how long finished services lasted.
  const serving = new Map<number, { overlord: number; since: number }>();
  const served: number[] = [];

  await runYears(YEARS, () => {
    const t = performance.now();
    tick(state, rng);
    tickMs += performance.now() - t;
    const shares = crownShares(state, land);
    for (const n of state.nations.values()) if (n.alive) peakRealm = Math.max(peakRealm, n.area / land);
    for (const [crown, share] of shares) {
      peakCrown = Math.max(peakCrown, share);
      if (share >= GIANT_SHARE) {
        const giant = giants.get(crown) ?? { years: 0, broken: false };
        giant.years++;
        giants.set(crown, giant);
      }
    }
    for (const [crown, giant] of giants) if (!giant.broken && (shares.get(crown) ?? 0) < BROKEN_SHARE) giant.broken = true;
    for (const n of state.nations.values()) {
      const now = n.alive ? n.overlord : undefined;
      const was = serving.get(n.id);
      if (was && was.overlord !== now) {
        served.push(state.year - was.since);
        serving.delete(n.id);
      }
      if (now !== undefined && !serving.has(n.id)) serving.set(n.id, { overlord: now, since: state.year });
    }
    if (state.year === 250 || state.year === 500 || state.year === 1000) aliveAt[state.year] = alive();
  });

  const centuries = YEARS / 100;
  const ended = state.warRecords.filter((w) => w.end !== undefined);
  const decided = ended.filter((w) => w.outcome?.winner !== undefined);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const mean = (values: number[]) => sum(values) / Math.max(1, values.length);
  const events = (test: (text: string, type: string) => boolean) => state.events.filter((e) => test(e.text, e.type)).length;
  const raceCounts = new Map<number, number>();
  let settled = 0;
  for (const r of state.state.race) {
    if (r === 0) continue;
    raceCounts.set(r, (raceCounts.get(r) ?? 0) + 1);
    settled++;
  }
  const vassals = [...state.nations.values()].filter((n) => n.alive && n.overlord !== undefined);
  const giantList = [...giants.values()];

  return {
    seed: spec.seed,
    kind: spec.kind,
    // Wars
    warsPerCentury: state.warRecords.length / centuries,
    attackerWinShare: decided.filter((w) => w.outcome!.winner === w.attacker).length / Math.max(1, decided.length),
    noWinnerShare: ended.filter((w) => w.outcome?.winner === undefined).length / Math.max(1, ended.length),
    averageWarYears: mean(ended.map((w) => w.end! - w.start)),
    battlesPerWar: mean(ended.map((w) => w.battles.length)),
    cellsChangedPerCentury: sum(ended.map((w) => w.outcome?.cells ?? 0)) / centuries,
    // Breaking apart
    rebellionsPerCentury: events((_, type) => type === "rebellion") / centuries,
    civilWarsPerCentury: events((text) => text.includes("civil war tears")) / centuries,
    newRealmsPerCentury: (state.nations.size - founders.length) / centuries,
    // Realms
    realmsAt250: aliveAt[250] ?? 0,
    realmsAt500: aliveAt[500] ?? 0,
    realmsAt1000: aliveAt[1000] ?? 0,
    foundersAliveAt1000: founders.filter((id) => state.nations.get(id)!.alive).length,
    // Empires and crowns
    peakRealmShare: peakRealm,
    peakCrownShare: peakCrown,
    reached25: peakCrown >= 0.25 ? 1 : 0,
    reached40: peakCrown >= 0.4 ? 1 : 0,
    reached50: peakCrown >= 0.5 ? 1 : 0,
    giants: giantList.length,
    giantYears: mean(giantList.map((g) => g.years)),
    giantsBroken: giantList.filter((g) => g.broken).length,
    // Vassals
    submissionsPerCentury: events((text, type) => type === "vassal" && text.includes("submits")) / centuries,
    independenceWarsPerCentury: events((text, type) => type === "vassal" && text.includes("declares independence")) / centuries,
    independenceWins: events((text, type) => type === "vassal" && text.includes("wins its independence")),
    vassalsAt1000: vassals.length,
    vassalLandShareAt1000: sum(vassals.map((n) => n.area)) / land,
    averageServiceYears: mean(served),
    // Races
    biggestRaceShare: Math.max(...PLAYABLE_RACES.map((r) => (raceCounts.get(r) ?? 0) / Math.max(settled, 1))),
    // Speed (wall time; several shards share the machine, so read it as a rough guide)
    tickMs: tickMs / YEARS,
  };
}
