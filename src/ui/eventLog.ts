// The scrolling event log: newest events at the top.
import type { SimEvent, WorldState } from "../core/types";
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
};

export interface EventLog {
  add(events: SimEvent[], state: WorldState): void;
}

export function createEventLog(container: HTMLElement): EventLog {
  return {
    add(events, state) {
      // Newest first: insert each new line at the top.
      for (const event of events) {
        const line = document.createElement("div");
        line.className = `event event-${event.type}`;

        // A color swatch for the main nation involved.
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = state.nations.get(event.actors[0]!)?.color ?? "transparent";

        line.append(swatch, `${ICONS[event.type]} ${event.text}`);
        container.prepend(line);
      }
      // Keep the page light: drop the oldest lines past the limit.
      while (container.childElementCount > EVENT_LOG_MAX) container.lastElementChild?.remove();
    },
  };
}
