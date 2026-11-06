// The War Room (M16, docs/systems/warroom.md): the side panel's tabs, the list of
// wars going on, past wars, and the report of a war. Only reads the world.
import type { NationId, WarRecord, WorldState } from "../core/types";
import { menText } from "../sim/events";
import { SIM } from "../sim/params";
import { sideOf } from "../sim/warRecords";

export type Tab = "wars" | "past" | "log";

export interface WarRoom {
  /** Brings the lists up to date (after each year, or when following changes). */
  update(state: WorldState): void;
  /** Opens the report of a war in the Wars tab. */
  showReport(record: WarRecord, state: WorldState): void;
  showTab(tab: Tab): void;
}

/** Every nation fighting in a war, allies included. */
export function nationsOf(record: WarRecord): NationId[] {
  return [record.attacker, record.defender, ...record.allies.map((a) => a.nation)];
}

/** "The War of Kethar and Velmora". */
export function warTitle(record: WarRecord, state: WorldState): string {
  return `The War of ${nameOf(state, record.attacker)} and ${nameOf(state, record.defender)}`;
}

const GOALS: Record<WarRecord["goal"], string> = { conquer: "Conquest", reclaim: "Reclaiming lost lands", raid: "Raid", support: "Support" };
const ENDINGS: Record<NonNullable<WarRecord["outcome"]>["how"], string> = {
  goal: "the attacker took what it went to war for",
  decisive: "won on the field",
  exhausted: "the fighting wore one side out",
  "too long": "it dragged on until both gave up",
  "side fell": "one side fell",
  imposed: "the gods imposed peace",
};

const nameOf = (state: WorldState, id: NationId) => state.nations.get(id)?.name ?? "?";
const colorOf = (state: WorldState, id: NationId) => state.nations.get(id)?.color ?? "#777";
/** Event text without its "Year 412: " start. */
const sentence = (text: string) => text.replace(/^Year -?\d+: /, "");

/** A new element with a class and some text. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function swatch(state: WorldState, id: NationId): HTMLElement {
  const s = el("span", "sw");
  s.style.background = colorOf(state, id);
  return s;
}

/** "Kethar ⚔ Velmora (+2 allies)" with color swatches. */
function sides(record: WarRecord, state: WorldState): HTMLElement {
  const row = el("div", "war-sides");
  const allies = (side: "attack" | "defend") => record.allies.filter((a) => a.side === side).length;
  const more = (n: number) => (n > 0 ? el("span", "allies", `+${n}`) : el("span"));
  row.append(
    swatch(state, record.attacker),
    nameOf(state, record.attacker),
    more(allies("attack")),
    el("span", "vs", "vs"),
    swatch(state, record.defender),
    nameOf(state, record.defender),
    more(allies("defend")),
  );
  return row;
}

/** A bar from the defender's win (left) to the attacker's (right), filled toward whoever leads. */
function scoreBar(state: WorldState, record: WarRecord, score: number): HTMLElement {
  const bar = el("div", "score");
  const share = Math.max(-1, Math.min(1, score / SIM.PEACE_SCORE));
  const fill = el("div", "fill");
  fill.style.background = colorOf(state, share >= 0 ? record.attacker : record.defender);
  fill.style.left = `${50 + Math.min(0, share) * 50}%`;
  fill.style.width = `${Math.abs(share) * 50}%`;
  bar.append(fill, el("div", "mid"));
  return bar;
}

/** Soldiers each side has in the field in this war, allies included. */
function inTheField(state: WorldState, record: WarRecord): { attack: number; defend: number } {
  const wars = new Set(state.wars.filter((w) => w.id === record.id || w.joined === record.id).map((w) => w.id));
  const field = { attack: 0, defend: 0 };
  for (const army of state.armies) if (wars.has(army.war)) field[sideOf(record, army.owner)] += army.size;
  return field;
}

/** The score line of a war, drawn small. */
function sparkline(scores: number[]): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const width = 300;
  const height = 60;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  const mid = document.createElementNS(ns, "line");
  mid.setAttribute("x1", "0");
  mid.setAttribute("x2", String(width));
  mid.setAttribute("y1", String(height / 2));
  mid.setAttribute("y2", String(height / 2));
  mid.setAttribute("stroke", "#4a5160");
  const line = document.createElementNS(ns, "polyline");
  const points = [0, ...scores].map((s, i, all) => {
    const x = (i / Math.max(1, all.length - 1)) * width;
    const y = height / 2 - Math.max(-1, Math.min(1, s / SIM.PEACE_SCORE)) * (height / 2 - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  line.setAttribute("points", points.join(" "));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#c9b26b");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(mid, line);
  return svg;
}

/** The report of a war, ongoing or over. */
export function reportOf(record: WarRecord, state: WorldState): HTMLElement {
  const box = el("div", "report");
  box.append(el("h3", "", warTitle(record, state)));
  const years = record.end === undefined ? `since year ${record.start} (${state.year - record.start} years so far)` : `years ${record.start}–${record.end}`;
  box.append(el("div", "years", years));
  box.append(sides(record, state));

  const declared = state.events.find((e) => e.type === "war" && e.year === record.start && e.actors[0] === record.attacker && e.actors[1] === record.defender);
  const facts = el("dl");
  const fact = (term: string, value: string) => facts.append(el("dt", "", term), el("dd", "", value));
  if (declared) fact("Began", sentence(declared.text));
  if (record.allies.length > 0) {
    fact("Allies", record.allies.map((a) => `${nameOf(state, a.nation)} (${a.side === "attack" ? nameOf(state, record.attacker) : nameOf(state, record.defender)}'s side)`).join(", "));
  }
  if (record.outcome) {
    fact("Ended", sentence(record.outcome.text));
    fact("How", ENDINGS[record.outcome.how]);
    if (record.outcome.cells > 0) fact("Land", `${record.outcome.cells} province${record.outcome.cells === 1 ? "" : "s"} changed hands`);
  }
  const won = { attack: 0, defend: 0 };
  for (const b of record.battles) won[sideOf(record, b.winner)]++;
  fact("Battles", record.battles.length === 0 ? "none" : `${record.battles.length}: ${won.attack} won by ${nameOf(state, record.attacker)}'s side, ${won.defend} by ${nameOf(state, record.defender)}'s`);
  fact("Fallen", `${menText(record.fallen.attack)} on ${nameOf(state, record.attacker)}'s side, ${menText(record.fallen.defend)} on ${nameOf(state, record.defender)}'s`);
  box.append(facts);

  if (record.scores.length > 0) {
    box.append(el("h4", "", "The score, year by year"), sparkline(record.scores));
  }
  if (record.moments.length > 0) {
    box.append(el("h4", "", "Turning points"));
    const list = el("ul");
    for (const m of record.moments) list.append(el("li", "", `Year ${m.year}: ${m.text}`));
    box.append(list);
  }
  return box;
}

type Sort = "newest" | "longest" | "bloodiest" | "land";
const SORTS: [Sort, string][] = [
  ["newest", "Newest"],
  ["longest", "Longest"],
  ["bloodiest", "Bloodiest"],
  ["land", "Most land"],
];
const sortKey: Record<Sort, (r: WarRecord) => number> = {
  newest: (r) => r.end ?? 0,
  longest: (r) => (r.end ?? 0) - r.start,
  bloodiest: (r) => r.fallen.attack + r.fallen.defend,
  land: (r) => r.outcome?.cells ?? 0,
};
/** Most past wars the list shows at once. */
const PAST_SHOWN = 150;

/**
 * Builds the panel. `onFollow` runs with a war's id when a war going on is clicked,
 * or null to stop following.
 */
export function createWarRoom(panel: HTMLElement, followed: () => number | null, onFollow: (id: number | null) => void): WarRoom {
  const tabs = { wars: panel.querySelector<HTMLElement>("#tab-wars")!, past: panel.querySelector<HTMLElement>("#tab-past")!, log: panel.querySelector<HTMLElement>("#tab-log")! };
  const buttons = [...panel.querySelectorAll<HTMLButtonElement>(".tabs button")];
  let shown: Tab = "wars";
  let report: { record: WarRecord } | null = null;
  let sort: Sort = "newest";
  let pastDrawn = "";
  let lastState: WorldState | null = null;

  const showTab = (tab: Tab) => {
    shown = tab;
    for (const [name, section] of Object.entries(tabs)) section.classList.toggle("shown", name === tab);
    for (const b of buttons) b.classList.toggle("active", b.dataset.tab === tab);
    if (lastState) room.update(lastState);
  };
  for (const b of buttons) b.addEventListener("click", () => showTab(b.dataset.tab as Tab));

  function drawWars(state: WorldState): void {
    const box = tabs.wars;
    box.replaceChildren();
    if (report) {
      const head = el("div", "room-head", "War report");
      const back = el("button", "", "Back to wars");
      back.addEventListener("click", () => {
        report = null;
        drawWars(state);
      });
      head.append(back);
      box.append(head, reportOf(report.record, state));
      return;
    }
    const following = followed();
    if (following !== null) {
      const head = el("div", "room-head", "Following a war");
      const stop = el("button", "", "Stop following");
      stop.addEventListener("click", () => onFollow(null));
      head.append(stop);
      box.append(head);
    }
    const going = state.wars.filter((w) => w.joined === undefined);
    if (going.length === 0) {
      box.append(el("div", "wars-empty", "The realms are at peace."));
      return;
    }
    for (const war of going) {
      const record = state.warRecords.find((r) => r.id === war.id);
      if (!record) continue;
      const row = el("div", `war-row${following === war.id ? " followed" : ""}`);
      row.title = "Follow this war";
      row.addEventListener("click", () => onFollow(war.id));
      const field = inTheField(state, record);
      row.append(
        sides(record, state),
        el("div", "war-meta", `${GOALS[record.goal]} · year ${state.year - record.start + 1} · ${record.battles.length} battles`),
        scoreBar(state, record, war.score),
      );
      const numbers = el("div", "war-numbers");
      numbers.append(
        el("span", "", `${menText(field.attack)} strong · ${menText(record.fallen.attack)} fallen`),
        el("span", "", `${menText(field.defend)} strong · ${menText(record.fallen.defend)} fallen`),
      );
      row.append(numbers);
      box.append(row);
    }
  }

  function drawPast(state: WorldState): void {
    const over = state.warRecords.filter((r) => r.outcome !== undefined);
    const key = `${over.length}-${sort}`;
    if (key === pastDrawn) return; // nothing new since last time
    pastDrawn = key;
    const box = tabs.past;
    box.replaceChildren();
    const bar = el("div", "sort");
    for (const [name, label] of SORTS) {
      const b = el("button", name === sort ? "active" : "", label);
      b.addEventListener("click", () => {
        sort = name;
        drawPast(state);
      });
      bar.append(b);
    }
    box.append(bar);
    if (over.length === 0) {
      box.append(el("div", "wars-empty", "No war has ended yet."));
      return;
    }
    const list = [...over].sort((a, b) => sortKey[sort](b) - sortKey[sort](a) || b.id - a.id).slice(0, PAST_SHOWN);
    for (const record of list) {
      const row = el("div", "war-row");
      row.title = "Read the report";
      row.addEventListener("click", () => room.showReport(record, state));
      row.append(sides(record, state), el("div", "war-meta", `Years ${record.start}–${record.end} · ${sentence(record.outcome!.text)}`));
      box.append(row);
    }
    if (over.length > PAST_SHOWN) box.append(el("div", "room-note", `${over.length - PAST_SHOWN} more not shown.`));
  }

  const room: WarRoom = {
    update(state) {
      lastState = state;
      if (shown === "wars") drawWars(state);
      if (shown === "past") drawPast(state);
    },
    showReport(record, state) {
      report = { record };
      if (shown !== "wars") showTab("wars");
      else drawWars(state);
    },
    showTab,
  };
  showTab("wars");
  return room;
}
