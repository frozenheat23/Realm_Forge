// Odds (M17, docs/systems/sandbox.md): run possible futures from the present with
// different dice, and count what happens to a war and a nation. Each future starts from
// a copy of a save, so the real history is never touched.
import { createRng } from "../core/rng";
import type { NationId, WorldState } from "../core/types";
import type { GeneratedWorld } from "../gen";
import { livingNations } from "./helpers";
import { ODDS_RUNS, ODDS_YEARS } from "./params";
import { fromSnapshot, type Snapshot } from "./snapshot";
import { tick } from "./tick";
import { recordOf } from "./warRecords";

/** What to watch. Either or both of a war (by id) and a nation. */
export interface FutureQuestion {
  war?: number;
  nation?: NationId;
  years: number;
}

/** How one future turned out. */
export interface Future {
  war?: { result: "attacker" | "defender" | "white" | "fell" | "going"; cells: number; years: number };
  nation?: { alive: boolean; area: number; largest: boolean };
}

/** All the futures, counted. */
export interface Odds {
  runs: number;
  years: number;
  war?: {
    attacker: NationId;
    defender: NationId;
    /** How many futures ended each way. "fell" = a side died some other way; "going" = not over yet. */
    results: Record<NonNullable<Future["war"]>["result"], number>;
    /** Average provinces the winner took, over the futures someone won. */
    cellsWon: number;
    /** Average years until it ended, over the futures it ended in. */
    years: number;
  };
  nation?: { id: NationId; areaNow: number; survived: number; areas: number[]; largest: number };
}

/** Future 0 rolls the real dice, so what will actually happen is one of the futures; the rest roll others. */
function futureRng(seed: string, k: number) {
  return createRng(k === 0 ? seed : `${seed}/future-${k}`).fork("sim");
}

/** Lets the page breathe between chunks of work, so it doesn't freeze. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Years run between breaths. */
const YEARS_PER_BREATH = 5;

/** Runs future number `k` from `snapshot` and says how it turned out. */
export async function runFuture(snapshot: Snapshot, world: GeneratedWorld, question: FutureQuestion, k: number): Promise<Future> {
  // structuredClone: each future gets its own copy, or futures would change each other's nations and wars.
  const state = fromSnapshot(structuredClone(snapshot), world);
  const rng = futureRng(snapshot.seed, k);
  const start = state.year;
  const warOver = () => question.war !== undefined && recordOf(state, question.war)?.outcome !== undefined;
  for (let y = 0; y < question.years; y++) {
    tick(state, rng);
    // Only a question about a war alone can stop when the war does.
    if (question.nation === undefined && warOver()) break;
    if (y % YEARS_PER_BREATH === YEARS_PER_BREATH - 1) await breathe();
  }
  return describe(state, question, start);
}

function describe(state: WorldState, question: FutureQuestion, start: number): Future {
  const future: Future = {};
  if (question.war !== undefined) {
    const record = recordOf(state, question.war);
    const outcome = record?.outcome;
    let result: NonNullable<Future["war"]>["result"] = "going";
    if (outcome?.how === "side fell") result = "fell";
    else if (outcome) result = outcome.winner === undefined ? "white" : outcome.winner === record!.attacker ? "attacker" : "defender";
    future.war = { result, cells: outcome?.cells ?? 0, years: (record?.end ?? state.year) - (record?.start ?? start) };
  }
  if (question.nation !== undefined) {
    const nation = state.nations.get(question.nation);
    const alive = nation?.alive ?? false;
    const biggest = Math.max(0, ...livingNations(state).map((n) => n.area));
    future.nation = { alive, area: alive ? nation!.area : 0, largest: alive && nation!.area === biggest };
  }
  return future;
}

/**
 * Runs `runs` futures of `question.years` years from `snapshot` and counts what happened.
 * `onProgress(done, total)` is called after each future.
 */
export async function runFutures(
  snapshot: Snapshot,
  world: GeneratedWorld,
  question: FutureQuestion = { years: ODDS_YEARS },
  runs = ODDS_RUNS,
  onProgress?: (done: number, total: number) => void,
): Promise<Odds> {
  const futures: Future[] = [];
  for (let k = 0; k < runs; k++) {
    futures.push(await runFuture(snapshot, world, question, k));
    onProgress?.(k + 1, runs);
  }
  const odds: Odds = { runs, years: question.years };

  if (question.war !== undefined) {
    const record = snapshot.warRecords.find((r) => r.id === question.war)!;
    const results = { attacker: 0, defender: 0, white: 0, fell: 0, going: 0 };
    for (const f of futures) results[f.war!.result]++;
    const won = futures.filter((f) => f.war!.result === "attacker" || f.war!.result === "defender");
    const ended = futures.filter((f) => f.war!.result !== "going");
    const average = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
    odds.war = {
      attacker: record.attacker,
      defender: record.defender,
      results,
      cellsWon: average(won.map((f) => f.war!.cells)),
      years: average(ended.map((f) => f.war!.years)),
    };
  }
  if (question.nation !== undefined) {
    const now = snapshot.nations.find((n) => n.id === question.nation)!;
    odds.nation = {
      id: now.id,
      areaNow: now.area,
      survived: futures.filter((f) => f.nation!.alive).length,
      areas: futures.map((f) => f.nation!.area).sort((a, b) => a - b),
      largest: futures.filter((f) => f.nation!.largest).length,
    };
  }
  return odds;
}
