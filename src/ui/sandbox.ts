// The Sandbox tab (M17, docs/systems/sandbox.md): god powers over wars, and the odds of
// possible futures. It never changes the world itself: every change is a god command
// handed to the rules (`giveCommand`), and odds run on copies.
import type { GodCommand, NationId, SimEvent, WorldState } from "../core/types";
import type { GeneratedWorld } from "../gen";
import { everyoneAI } from "../sim/ai/default";
import { livingNations, neighborPairs } from "../sim/helpers";
import { runFutures, type Odds } from "../sim/odds";
import { ODDS_RUNS, ODDS_YEARS, SIM } from "../sim/params";
import { GOD_GOALS, giveCommand, godWarRefusals } from "../sim/sandbox";
import { toSnapshot } from "../sim/snapshot";

export interface SandboxHooks {
  /** The world as it is now. */
  state(): WorldState;
  world: GeneratedWorld;
  /** Stops playback, so nothing moves while you act. */
  pause(): void;
  /** Called after a god command, with its events, so the map, log and lists catch up. */
  changed(events: SimEvent[]): void;
}

export interface Sandbox {
  /** Brings the lists of nations and wars up to date. */
  update(state: WorldState): void;
}

const GOAL_NAMES: Record<(typeof GOD_GOALS)[number], string> = { conquer: "Conquer", reclaim: "Reclaim", raid: "Raid" };

/** A new element with a class and some text. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Fills a drop-down with options, keeping the chosen one if it's still there. */
function fill(select: HTMLSelectElement, options: [string, string][], blank?: string): void {
  const before = select.value;
  select.replaceChildren();
  if (blank !== undefined) select.append(new Option(blank, ""));
  for (const [value, label] of options) select.append(new Option(label, value));
  if ([...select.options].some((o) => o.value === before)) select.value = before;
}

const percent = (n: number, runs: number) => `${Math.round((100 * n) / runs)}%`;

/** The odds told in words: who wins the war, and how the nation fares. */
function oddsText(odds: Odds, state: WorldState, from: number): string[] {
  const name = (id: NationId) => state.nations.get(id)?.name ?? "?";
  const lines: string[] = [`${odds.runs} futures from year ${from}, ${odds.years} years each:`];
  if (odds.war) {
    const r = odds.war.results;
    const parts = [
      `${name(odds.war.attacker)} wins ${r.attacker} of ${odds.runs} (${percent(r.attacker, odds.runs)})`,
      `${name(odds.war.defender)} ${r.defender}`,
      `white peace ${r.white}`,
    ];
    if (r.fell) parts.push(`a side fell some other way ${r.fell}`);
    if (r.going) parts.push(`still going ${r.going}`);
    let line = `${parts.join(", ")}.`;
    if (r.attacker + r.defender > 0) line += ` On average the winner takes ${odds.war.cellsWon.toFixed(1)} provinces`;
    if (odds.runs - r.going > 0) line += ` after ${odds.war.years.toFixed(1)} years of war.`;
    lines.push(line);
  }
  if (odds.nation) {
    const n = odds.nation;
    const lived = n.areas.filter((a) => a > 0);
    let line = `${name(n.id)} survives in ${n.survived} of ${odds.runs} futures (${percent(n.survived, odds.runs)})`;
    if (lived.length) line += `; ends at ${lived[0]}–${lived.at(-1)} cells (now ${n.areaNow})`;
    line += n.largest ? `; the largest nation in ${n.largest}.` : ".";
    lines.push(line);
  }
  lines.push(`${odds.runs} futures can tell 90% from 50%, not 55% from 50%.`);
  return lines;
}

/** Builds the tab inside `box`. */
export function createSandbox(box: HTMLElement, hooks: SandboxHooks): Sandbox {
  box.replaceChildren();
  const section = (title: string) => {
    const s = el("div", "sandbox-part");
    s.append(el("h4", "", title));
    box.append(s);
    return s;
  };

  // --- Start a war ---
  const startPart = section("Start a war");
  const nationPick = el("select");
  const targetPick = el("select");
  const goalButtons = GOD_GOALS.map((goal) => {
    const b = el("button", "", GOAL_NAMES[goal]);
    b.addEventListener("click", () => declare(goal));
    return b;
  });
  const startNote = el("div", "sandbox-note");
  const goalRow = el("div", "sandbox-row");
  goalRow.append(...goalButtons);
  startPart.append(labelled("Nation", nationPick), labelled("goes to war on", targetPick), goalRow, startNote);

  // --- End a war ---
  const endPart = section("End a war");
  const warPick = el("select");
  const endButtons = (["attacker", "defender", "white"] as const).map((how) => {
    const b = el("button", "", how === "white" ? "White peace" : how === "attacker" ? "Attacker wins" : "Defender wins");
    b.addEventListener("click", () => endWar(how));
    return b;
  });
  const endNote = el("div", "sandbox-note");
  const endRow = el("div", "sandbox-row");
  endRow.append(...endButtons);
  endPart.append(labelled("War", warPick), endRow, endNote);

  // --- Odds ---
  const oddsPart = section("Odds");
  const oddsWar = el("select");
  const oddsNation = el("select");
  const yearsBox = el("input");
  yearsBox.type = "number";
  yearsBox.min = "1";
  yearsBox.max = "500";
  yearsBox.value = String(ODDS_YEARS);
  const runButton = el("button", "", `Run ${ODDS_RUNS} futures`);
  const progress = el("progress");
  progress.max = ODDS_RUNS;
  progress.hidden = true;
  const result = el("div", "sandbox-odds");
  const runRow = el("div", "sandbox-row");
  runRow.append(runButton, progress);
  oddsPart.append(labelled("War", oddsWar), labelled("Nation", oddsNation), labelled("Years", yearsBox), runRow, result);
  runButton.addEventListener("click", () => void runOdds());

  function labelled(text: string, input: HTMLElement): HTMLElement {
    const row = el("label", "sandbox-field");
    row.append(el("span", "", text), input);
    return row;
  }

  // --- Filling the lists ---
  const nationOptions = (state: WorldState): [string, string][] =>
    livingNations(state)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => [String(n.id), n.name]);

  const warOptions = (state: WorldState): [string, string][] =>
    state.wars
      .filter((w) => w.joined === undefined)
      .map((w) => [String(w.id), `${state.nations.get(w.attacker)!.name} ⚔ ${state.nations.get(w.defender)!.name}`]);

  function fillTargets(state: WorldState): void {
    const me = Number(nationPick.value);
    const touching = neighborPairs(state)
      .filter(([a, b]) => a === me || b === me)
      .map(([a, b]) => state.nations.get(a === me ? b : a)!)
      .sort((a, b) => a.name.localeCompare(b.name));
    fill(targetPick, touching.map((n) => [String(n.id), n.name]));
    fillGoals(state);
  }

  /** Greys out the goals the rules wouldn't allow, with the reason on hover. */
  function fillGoals(state: WorldState): void {
    const refusals = targetPick.value ? godWarRefusals(state, Number(nationPick.value), Number(targetPick.value)) : null;
    GOD_GOALS.forEach((goal, i) => {
      const why = refusals ? refusals[goal] : "pick a neighbor first";
      goalButtons[i]!.disabled = why !== null;
      goalButtons[i]!.title = why ?? `Go to war to ${goal}`;
    });
  }

  nationPick.addEventListener("change", () => fillTargets(hooks.state()));
  targetPick.addEventListener("change", () => fillGoals(hooks.state()));

  function update(state: WorldState): void {
    fill(nationPick, nationOptions(state));
    fillTargets(state);
    fill(warPick, warOptions(state));
    for (const b of endButtons) b.disabled = warPick.value === "";
    fill(oddsWar, warOptions(state), "— no war —");
    fill(oddsNation, nationOptions(state), "— no nation —");
  }

  // --- Acting ---
  function give(command: GodCommand, note: HTMLElement): void {
    hooks.pause();
    const state = hooks.state();
    const result = giveCommand(state, command, everyoneAI);
    note.textContent = result.ok ? "Done." : `The rules refuse: ${result.reason}.`;
    if (result.ok) hooks.changed(result.events);
    update(state);
  }

  function declare(goal: (typeof GOD_GOALS)[number]): void {
    give({ kind: "godWar", nation: Number(nationPick.value), target: Number(targetPick.value), goal }, startNote);
  }

  function endWar(how: "attacker" | "defender" | "white"): void {
    const state = hooks.state();
    const war = state.wars.find((w) => w.id === Number(warPick.value));
    if (!war) return;
    const winner = how === "white" ? null : how === "attacker" ? war.attacker : war.defender;
    give({ kind: "godPeace", war: war.id, winner }, endNote);
  }

  async function runOdds(): Promise<void> {
    const war = oddsWar.value ? Number(oddsWar.value) : undefined;
    const nation = oddsNation.value ? Number(oddsNation.value) : undefined;
    if (war === undefined && nation === undefined) {
      result.textContent = "Pick a war, a nation, or both.";
      return;
    }
    const years = Math.max(1, Math.min(500, Math.round(Number(yearsBox.value)) || ODDS_YEARS));
    hooks.pause();
    const state = hooks.state();
    const from = state.year;
    // A save of this moment: each future starts from its own copy of it.
    const snapshot = toSnapshot(state, SIM);
    runButton.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    result.textContent = "";
    const odds = await runFutures(snapshot, hooks.world, { war, nation, years }, ODDS_RUNS, (done) => (progress.value = done));
    runButton.disabled = false;
    progress.hidden = true;
    result.replaceChildren(...oddsText(odds, hooks.state(), from).map((line) => el("p", "", line)));
  }

  update(hooks.state());
  return { update };
}
