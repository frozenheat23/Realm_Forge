// The scrolling event log: newest events at the top, filterable by type.
// Click a line to highlight the nations involved on the map.
import type { BattleReport, NationId, SimEvent, WorldState } from "../core/types";
import { menText } from "../sim/events";
import { EVENT_LOG_MAX } from "./config";

// A small symbol per event type, so the log is easy to scan.
const ICONS: Record<SimEvent["type"], string> = {
  founded: "✦",
  rebellion: "⚑",
  collapse: "✕",
  annexed: "⊕",
  capital_moved: "⌂",
  war: "⚔",
  peace: "☮",
  alliance: "∞",
  alliance_ended: "≠",
  city_founded: "♜",
  battle: "⚒",
  faith: "☽",
  ruler: "♛",
};

// Filter checkboxes: label → the event types it shows or hides.
const FILTERS: [string, SimEvent["type"][]][] = [
  ["Wars", ["war"]],
  ["Peace", ["peace"]],
  ["Alliances", ["alliance", "alliance_ended"]],
  ["Rebellions", ["rebellion"]],
  ["Foundings", ["founded"]],
  ["Collapses", ["collapse", "annexed"]],
  ["Capitals", ["capital_moved"]],
  ["Cities", ["city_founded"]],
  ["Faith", ["faith"]],
  ["Rulers", ["ruler"]],
  ["Battles", ["battle"]],
];

export interface EventLog {
  add(events: SimEvent[], state: WorldState): void;
  clear(): void;
}

/**
 * `filterBar` gets the checkboxes; `list` gets the events.
 * `onPick` runs with the nations of a clicked event.
 */
export function createEventLog(
  filterBar: HTMLElement,
  list: HTMLElement,
  onPick: (nations: NationId[]) => void,
): EventLog {
  // There are so many battles that they're off by default, and only kept while on:
  // otherwise they would push everything else past EVENT_LOG_MAX.
  let showBattles = false;

  // Hiding a type just adds a class to the list; CSS hides matching lines.
  for (const [label, types] of FILTERS) {
    const box = document.createElement("input");
    box.type = "checkbox";
    const battles = types.includes("battle");
    box.checked = !battles;
    box.addEventListener("change", () => {
      for (const t of types) list.classList.toggle(`hide-${t}`, !box.checked);
      if (battles) showBattles = box.checked;
    });
    const wrap = document.createElement("label");
    wrap.append(box, ` ${label}`);
    filterBar.append(wrap);
  }

  // One listener on the whole list, instead of one per line ("event delegation").
  list.addEventListener("click", (e) => {
    const line = (e.target as HTMLElement).closest<HTMLElement>(".event");
    if (line?.dataset.actors) onPick(line.dataset.actors.split(",").map(Number));
  });

  return {
    add(events, state) {
      const addLine = (type: SimEvent["type"], actors: NationId[], text: string) => {
        const line = document.createElement("div");
        line.className = `event event-${type}`;
        line.dataset.actors = actors.join(",");
        line.title = "Click to highlight on the map";

        // A color swatch for the main nation involved.
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = state.nations.get(actors[0]!)?.color ?? "transparent";

        line.append(swatch, `${ICONS[type]} ${text}`);
        list.prepend(line);
      };
      for (const event of events) if (event.type !== "battle") addLine(event.type, event.actors, event.text);
      // A year's battles between the same two nations read as one line.
      if (showBattles) for (const g of groupBattles(events, state.battles, state.year)) addLine("battle", [g.a, g.b], battleGroupText(g, state));
      // Keep the page light: drop the oldest lines past the limit.
      while (list.childElementCount > EVENT_LOG_MAX) list.lastElementChild?.remove();
    },
    clear() {
      list.replaceChildren();
    },
  };
}

/** One line in the log for all the battles two nations fought in a year. */
export interface BattleGroup {
  year: number;
  a: NationId;
  b: NationId;
  count: number;
  /** Soldiers who fell, if known (only for the year just played). */
  lost?: number;
}

/**
 * Folds battle events into one group per year and pair of nations, in the order
 * they first appear. `battles` (this year's reports) adds up who fell.
 */
export function groupBattles(events: SimEvent[], battles: BattleReport[] = [], year?: number): BattleGroup[] {
  const groups = new Map<string, BattleGroup>();
  for (const e of events) {
    if (e.type !== "battle") continue;
    const [a, b] = [Math.min(e.actors[0]!, e.actors[1]!), Math.max(e.actors[0]!, e.actors[1]!)];
    const key = `${e.year}-${a}-${b}`;
    const group = groups.get(key) ?? { year: e.year, a, b, count: 0 };
    group.count++;
    groups.set(key, group);
  }
  for (const r of battles) {
    const group = groups.get(`${year}-${Math.min(r.winner, r.loser)}-${Math.max(r.winner, r.loser)}`);
    if (group) group.lost = (group.lost ?? 0) + r.lost;
  }
  return [...groups.values()];
}

/** How a battle group reads in the log. */
export function battleGroupText(group: BattleGroup, state: WorldState): string {
  const name = (id: NationId) => state.nations.get(id)?.name ?? "?";
  const fights = group.count === 1 ? "a battle" : `${group.count} battles`;
  const fell = group.lost === undefined ? "" : ` (${menText(group.lost)} fell)`;
  return `Year ${group.year}: ${fights} between ${name(group.a)} and ${name(group.b)}${fell}.`;
}
