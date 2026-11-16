// Ghost names (SPEC §5.4s): when a great realm breaks apart, its name stays on the map,
// faint and wide, across the land it used to hold, and fades over a generation.
import type { GeneratedWorld } from "../gen";
import type { CellId, Nation, NationId, SimEvent, WorldState } from "../core/types";
import { clamp } from "../core/math";
import {
  GHOST_ALPHA,
  GHOST_LETTER_SPACING,
  GHOST_LOSS,
  GHOST_MAX_SIZE,
  GHOST_MIN_SHARE,
  GHOST_SIZE,
  GHOST_WINDOW,
  GHOST_YEARS,
  LABEL_MIN_SIZE,
  LABEL_SIZE_PER_SQRT_AREA,
  type MapLook,
} from "./palette";

/** The faint name of a broken realm. */
export interface Ghost {
  name: string;
  /** The middle of the land it held, and its letter height, in map pixels. */
  x: number;
  y: number;
  size: number;
  /** The year it broke. */
  year: number;
}

/** A great realm that broke apart this year. */
export interface Shatter {
  nation: Nation;
  /** The share of the land (0..1) it held before breaking. */
  share: number;
  /** How many living realms were born from it while it broke. */
  successors: number;
}

export interface Ghosts {
  /** Call after each simulated year, with its events. Returns the realms that broke apart this year. */
  noteYear(state: WorldState, events: SimEvent[]): Shatter[];
  /** The ghost names still showing in `year`. */
  showing(year: number): Ghost[];
}

/** The realm a "rebellion" or "collapse" event broke, if it is one of those. */
function brokenBy(event: SimEvent): NationId | undefined {
  if (event.type === "rebellion") return event.actors[1];
  return event.type === "collapse" ? event.actors[0] : undefined;
}

/** "Sylvathe breaks apart; three realms rise from its lands." */
export function shatterNews(shatter: Shatter): string {
  const { nation, successors } = shatter;
  if (successors === 0) return `${nation.name} breaks apart.`;
  const count = ["", "a new realm rises", "two realms rise", "three realms rise", "four realms rise"][successors] ?? `${successors} realms rise`;
  return `${nation.name} breaks apart; ${count} from its lands.`;
}

/** `land` = land cells on the map. */
export function createGhosts(world: Pick<GeneratedWorld, "cells">, land: number): Ghosts {
  // Each realm's land at its largest in the last GHOST_WINDOW years.
  const peaks = new Map<NationId, { year: number; cells: CellId[] }>();
  // The last year a rebellion or collapse hit each realm.
  const lastBreak = new Map<NationId, number>();
  let ghosts: Ghost[] = [];

  function ghostOf(nation: Nation, cells: CellId[], year: number): Ghost {
    let x = 0;
    let y = 0;
    for (const c of cells) {
      x += world.cells[c]!.site[0];
      y += world.cells[c]!.site[1];
    }
    const size = clamp(Math.sqrt(cells.length) * LABEL_SIZE_PER_SQRT_AREA * GHOST_SIZE, LABEL_MIN_SIZE, GHOST_MAX_SIZE);
    return { name: nation.name, x: x / cells.length, y: y / cells.length, size, year };
  }

  return {
    noteYear(state, events) {
      const year = state.year;
      for (const event of events) {
        const id = brokenBy(event);
        if (id !== undefined) lastBreak.set(id, year);
      }
      const owned = new Map<NationId, CellId[]>();
      state.state.owner.forEach((id, cell) => {
        if (id === 0) return;
        if (!owned.has(id)) owned.set(id, []);
        owned.get(id)!.push(cell);
      });

      const shatters: Shatter[] = [];
      // Realms seen before (they may have died this year) and realms seen for the first time.
      for (const id of new Set([...peaks.keys(), ...owned.keys()])) {
        const nation = state.nations.get(id);
        const now = nation?.alive ? (owned.get(id) ?? []) : [];
        const peak = peaks.get(id);
        const fresh = peak !== undefined && year - peak.year <= GHOST_WINDOW;
        const broke = year - (lastBreak.get(id) ?? -Infinity) <= GHOST_WINDOW;
        const great = peak !== undefined && peak.cells.length / land >= GHOST_MIN_SHARE;
        if (nation && peak && fresh && broke && great && now.length <= peak.cells.length * (1 - GHOST_LOSS)) {
          ghosts.push(ghostOf(nation, peak.cells, year));
          const successors = [...state.nations.values()].filter((n) => n.alive && n.parent === id && n.founded >= peak.year).length;
          shatters.push({ nation, share: peak.cells.length / land, successors });
          peaks.delete(id);
        }
        // A new high, or the old one is out of date: measure from today.
        const kept = peaks.get(id);
        if (now.length === 0) peaks.delete(id);
        else if (!kept || now.length >= kept.cells.length || year - kept.year > GHOST_WINDOW) peaks.set(id, { year, cells: now });
      }
      ghosts = ghosts.filter((g) => year - g.year < GHOST_YEARS);
      return shatters;
    },

    showing: (year) => ghosts.filter((g) => year - g.year < GHOST_YEARS),
  };
}

/** Draws the ghost names: no halo, wide letters, fainter each year. `k` shrinks them when zoomed in (see marks.ts). */
export function drawGhosts(ctx: CanvasRenderingContext2D, ghosts: Ghost[], year: number, look: MapLook, k: number): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = look.labelColor;
  for (const ghost of ghosts) {
    const size = ghost.size * k;
    ctx.globalAlpha = GHOST_ALPHA * (1 - (year - ghost.year) / GHOST_YEARS);
    ctx.font = `${look.labelWeight} ${size.toFixed(1)}px ${look.labelFont}`;
    ctx.letterSpacing = `${(size * GHOST_LETTER_SPACING).toFixed(1)}px`;
    ctx.fillText(ghost.name.toUpperCase(), ghost.x, ghost.y);
  }
  ctx.restore();
}
