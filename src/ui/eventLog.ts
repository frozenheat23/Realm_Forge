// The scrolling event log: newest events at the top, filterable by type.
// Click a line to highlight the nations involved on the map.
import type { NationId, SimEvent, WorldState } from "../core/types";
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
  // Hiding a type just adds a class to the list; CSS hides matching lines.
  for (const [label, types] of FILTERS) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.addEventListener("change", () => {
      for (const t of types) list.classList.toggle(`hide-${t}`, !box.checked);
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
      for (const event of events) {
        const line = document.createElement("div");
        line.className = `event event-${event.type}`;
        line.dataset.actors = event.actors.join(",");
        line.title = "Click to highlight on the map";

        // A color swatch for the main nation involved.
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = state.nations.get(event.actors[0]!)?.color ?? "transparent";

        line.append(swatch, `${ICONS[event.type]} ${event.text}`);
        list.prepend(line);
      }
      // Keep the page light: drop the oldest lines past the limit.
      while (list.childElementCount > EVENT_LOG_MAX) list.lastElementChild?.remove();
    },
    clear() {
      list.replaceChildren();
    },
  };
}
