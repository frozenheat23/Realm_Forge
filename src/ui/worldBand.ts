// The band below the map (SPEC §5.4q): standings of the largest crowns, and a chronicle of
// the great news so far. It fills whatever height the map and controls leave, and hides when
// that is too little. Only reads the world.
import type { NationId, WorldState } from "../core/types";
import { BAND_MIN_HEIGHT, CHRONICLE_MAX, STANDINGS_COUNT } from "./config";
import type { News } from "./headlines";

/** One row of the standings: a crown (a realm with its vassals) and the land it holds. */
export interface Standing {
  id: NationId;
  name: string;
  color: string;
  /** Share of all land held by the realm and its vassals together, 0..1. */
  share: number;
  /** The part of `share` that is the vassals' land. */
  vassalShare: number;
  vassals: number;
}

/** The `count` largest crowns, largest first. `land` = how many land cells the map has. */
export function standings(state: WorldState, land: number, count: number): Standing[] {
  const rows = new Map<NationId, Standing>();
  for (const n of state.nations.values()) {
    if (!n.alive) continue;
    const overlord = n.overlord !== undefined ? state.nations.get(n.overlord) : undefined;
    const head = overlord?.alive ? overlord : n;
    const row = rows.get(head.id) ?? { id: head.id, name: head.name, color: head.color, share: 0, vassalShare: 0, vassals: 0 };
    row.share += n.area / land;
    if (head !== n) {
      row.vassalShare += n.area / land;
      row.vassals++;
    }
    rows.set(head.id, row);
  }
  // Ties go to the older realm (the lower id), so the order never flickers.
  return [...rows.values()].sort((a, b) => b.share - a.share || a.id - b.id).slice(0, count);
}

export interface WorldBand {
  /** Redraws the standings; call when the world has changed. */
  update(state: WorldState): void;
  /** Adds a piece of great news to the top of the chronicle. */
  addNews(news: News): void;
}

/** Makes an element with a class and, optionally, text. */
function make(tag: string, className: string, text = ""): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** `onPick` runs with a row's realms when a standing or a chronicle line is clicked. */
export function createWorldBand(container: HTMLElement, land: number, onPick: (nations: NationId[]) => void): WorldBand {
  const standingsBox = make("div", "band-part band-standings");
  const standingsList = make("div", "band-list");
  standingsBox.append(make("h4", "", "Greatest crowns"), standingsList);
  const chronicleBox = make("div", "band-part band-chronicle");
  const chronicleList = make("div", "band-list");
  chronicleBox.append(make("h4", "", "Chronicle"), chronicleList);
  container.append(standingsBox, chronicleBox);

  // The band takes the height left over below the map: with too little, it shows nothing.
  new ResizeObserver(() => container.classList.toggle("cramped", container.clientHeight < BAND_MIN_HEIGHT)).observe(container);

  return {
    update(state) {
      standingsList.replaceChildren(
        ...standings(state, land, STANDINGS_COUNT).map((row) => {
          const line = make("div", "standing");
          const swatch = make("span", "sw");
          swatch.style.background = row.color;
          const bar = make("div", "standing-bar");
          // The bar is the whole crown; its paler end is the land held through vassals.
          const own = make("div", "standing-own");
          own.style.width = `${(row.share - row.vassalShare) * 100}%`;
          own.style.background = row.color;
          const held = make("div", "standing-vassals");
          held.style.width = `${row.vassalShare * 100}%`;
          held.style.background = row.color;
          bar.append(own, held);
          const note = row.vassals > 0 ? ` · ${row.vassals} vassal${row.vassals === 1 ? "" : "s"}` : "";
          line.append(swatch, make("span", "standing-name", row.name), bar, make("span", "standing-share", `${Math.round(row.share * 100)}%${note}`));
          line.addEventListener("click", () => onPick([row.id]));
          return line;
        }),
      );
    },

    addNews(news) {
      const line = make("div", "chronicle-line");
      const swatch = make("span", "sw");
      swatch.style.background = news.color;
      line.append(make("span", "chronicle-year", String(news.year)), swatch, make("span", "", news.text));
      line.addEventListener("click", () => onPick(news.actors));
      chronicleList.prepend(line);
      while (chronicleList.childElementCount > CHRONICLE_MAX) chronicleList.lastElementChild!.remove();
    },
  };
}
