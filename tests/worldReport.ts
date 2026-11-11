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

/** A realm holding this share of a broken empire's old land counts as one of its successor states. */
export const SUCCESSOR_SHARE = 0.05;

/** How a vassal's service ended. */
export type ServiceEnd = "revolt" | "overlordFell" | "absorbed" | "changedCrown" | "letGo";

/**
 * Why a vassal stopped serving, from what is true afterwards:
 * it is gone (absorbed), its overlord is gone, it now serves another overlord (changed crown),
 * it won a war of independence (revolt), or it was simply let go (too far to hold, or its overlord submitted to another).
 */
export function serviceEnd(vassalAlive: boolean, overlordAlive: boolean, servesAnother: boolean, wonIndependence: boolean): ServiceEnd {
  if (!vassalAlive) return "absorbed";
  if (!overlordAlive) return "overlordFell";
  if (servesAnother) return "changedCrown";
  return wonIndependence ? "revolt" : "letGo";
}

/**
 * Successor states of a broken empire: how many realms outside its crown each hold
 * at least `minShare` of the land (`cells`) the empire held at its height.
 */
export function countSuccessors(owner: ArrayLike<number>, cells: number[], crown: Set<number>, minShare: number): number {
  const held = new Map<number, number>();
  for (const cell of cells) {
    const id = owner[cell]!;
    if (id !== 0 && !crown.has(id)) held.set(id, (held.get(id) ?? 0) + 1);
  }
  return [...held.values()].filter((count) => count >= cells.length * minShare).length;
}

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

/** The realms of one crown: the overlord and its living vassals. */
function crownMembers(state: WorldState, crown: number): Set<number> {
  const members = new Set([crown]);
  for (const n of state.nations.values()) if (n.alive && n.overlord === crown) members.add(n.id);
  return members;
}

/** Every cell owned by one of `members`. */
function cellsOf(state: WorldState, members: Set<number>): number[] {
  const cells: number[] = [];
  state.state.owner.forEach((id, cell) => {
    if (members.has(id)) cells.push(cell);
  });
  return cells;
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
  // Great empires: years spent at GIANT_SHARE or more, the most each held (and which cells), and whether it later broke apart.
  const giants = new Map<number, { years: number; broken: boolean; peak: number; cells: number[] }>();
  let successors = 0;
  // Realms alive: the most there ever were, and the fewest after that.
  let realmsPeak = 0;
  let realmsLowAfterPeak = 0;
  const crownsAt: Record<number, number> = {};
  const ends: Record<ServiceEnd, number> = { revolt: 0, overlordFell: 0, absorbed: 0, changedCrown: 0, letGo: 0 };
  // Vassals: when each began serving its current overlord; how long finished services lasted.
  const serving = new Map<number, { overlord: number; since: number }>();
  const served: number[] = [];

  await runYears(YEARS, () => {
    const t = performance.now();
    const events = tick(state, rng);
    tickMs += performance.now() - t;
    const shares = crownShares(state, land);
    for (const n of state.nations.values()) if (n.alive) peakRealm = Math.max(peakRealm, n.area / land);
    for (const [crown, share] of shares) {
      peakCrown = Math.max(peakCrown, share);
      if (share >= GIANT_SHARE) {
        const giant = giants.get(crown) ?? { years: 0, broken: false, peak: 0, cells: [] };
        giant.years++;
        // Remember the land it held at its height, to count who holds it after a breakup.
        if (share > giant.peak) {
          giant.peak = share;
          giant.cells = cellsOf(state, crownMembers(state, crown));
        }
        giants.set(crown, giant);
      }
    }
    for (const [crown, giant] of giants) {
      if (giant.broken || (shares.get(crown) ?? 0) >= BROKEN_SHARE) continue;
      giant.broken = true;
      successors += countSuccessors(state.state.owner, giant.cells, crownMembers(state, crown), SUCCESSOR_SHARE);
    }
    const wonFree = new Set(events.filter((e) => e.type === "vassal" && e.text.includes("wins its independence")).map((e) => e.actors[0]));
    for (const n of state.nations.values()) {
      const now = n.alive ? n.overlord : undefined;
      const was = serving.get(n.id);
      if (was && was.overlord !== now) {
        served.push(state.year - was.since);
        ends[serviceEnd(n.alive, state.nations.get(was.overlord)?.alive ?? false, now !== undefined, wonFree.has(n.id))]++;
        serving.delete(n.id);
      }
      if (now !== undefined && !serving.has(n.id)) serving.set(n.id, { overlord: now, since: state.year });
    }
    const realms = alive();
    if (realms > realmsPeak) realmsLowAfterPeak = realmsPeak = realms;
    realmsLowAfterPeak = Math.min(realmsLowAfterPeak, realms);
    if (state.year === 250 || state.year === 500 || state.year === 1000) {
      aliveAt[state.year] = realms;
      crownsAt[state.year] = shares.size;
    }
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
    realmsPeak,
    realmsLowAfterPeak,
    crownsAt250: crownsAt[250] ?? 0,
    crownsAt500: crownsAt[500] ?? 0,
    crownsAt1000: crownsAt[1000] ?? 0,
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
    successorStates: successors,
    // Vassals
    submissionsPerCentury: events((text, type) => type === "vassal" && text.includes("submits")) / centuries,
    independenceWarsPerCentury: events((text, type) => type === "vassal" && text.includes("declares independence")) / centuries,
    independenceWins: events((text, type) => type === "vassal" && text.includes("wins its independence")),
    vassalsAt1000: vassals.length,
    vassalLandShareAt1000: sum(vassals.map((n) => n.area)) / land,
    averageServiceYears: mean(served),
    vassalsRevolted: ends.revolt,
    vassalsFreedByFall: ends.overlordFell,
    vassalsAbsorbed: ends.absorbed,
    vassalsChangedCrown: ends.changedCrown,
    vassalsLetGo: ends.letGo,
    // Races
    biggestRaceShare: Math.max(...PLAYABLE_RACES.map((r) => (raceCounts.get(r) ?? 0) / Math.max(settled, 1))),
    // Speed (wall time; several shards share the machine, so read it as a rough guide)
    tickMs: tickMs / YEARS,
  };
}
