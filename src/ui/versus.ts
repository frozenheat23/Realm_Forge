// The versus screen (SPEC §5.4p): when a realm of some size is conquered, its last ruler's card
// faces the conqueror's, the outcome is told, and then the loser's card burns.
// It sits in the empty band below the map when there is room, otherwise over the map.
import type { Nation, NationId, SimEvent } from "../core/types";
import { VERSUS_CARD_WIDTH, VERSUS_GAP } from "../render/palette";
import { VERSUS_FACE_SECONDS, VERSUS_MIN_SHARE, VERSUS_SECONDS } from "./config";
import { burnCanvas, CARD_H, CARD_W, prepareCard } from "./rulerCard";

/** A conquest worth a versus screen: who won, who fell, and the log's line about it. */
export interface Duel {
  winner: NationId;
  loser: NationId;
  event: SimEvent;
}

/**
 * The year's conquest to show, or null: the one whose fallen realm was once the biggest,
 * if at its height it held at least VERSUS_MIN_SHARE of the land. `sizeOf` gives that share (0..1).
 * (Realms are usually worn down to very little by the time they are conquered, so their last size says little.)
 */
export function pickDuel(events: SimEvent[], sizeOf: (id: NationId) => number): Duel | null {
  let best: Duel | null = null;
  for (const event of events) {
    // A conquest's actors are [the fallen realm, its conqueror].
    if (event.type !== "annexed" || !event.text.includes("conquers the whole realm")) continue;
    const [loser, winner] = event.actors as [NationId, NationId];
    if (sizeOf(loser) < VERSUS_MIN_SHARE) continue;
    if (!best || sizeOf(loser) > sizeOf(best.loser)) best = { winner, loser, event };
  }
  return best;
}

/**
 * Where the screen's top edge goes (page pixels): in the band below the page's content if
 * the whole screen fits there, otherwise centered on the map.
 */
export function versusTop(map: { top: number; height: number }, contentBottom: number, windowHeight: number, boxHeight: number): number {
  const below = contentBottom + VERSUS_GAP;
  if (below + boxHeight + VERSUS_GAP <= windowHeight) return below;
  return map.top + (map.height - boxHeight) / 2;
}

export interface Versus {
  /** True while a versus screen is up; a second conquest then burns as an ordinary card. */
  readonly busy: boolean;
  /** Shows winner against loser with `line` as the outcome, then burns the loser's card. */
  show(winner: Nation, loser: Nation, line: string): void;
}

/** `mapRect` and `contentBottom` say where the map and the end of the page's content are right now. */
export function createVersus(container: HTMLElement, mapRect: () => DOMRect, contentBottom: () => number): Versus {
  const card = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    canvas.style.width = `${VERSUS_CARD_WIDTH}px`;
    return [canvas, canvas.getContext("2d", { willReadFrequently: true })!];
  };
  const [winnerCanvas, winnerCtx] = card();
  const [loserCanvas, loserCtx] = card();
  const swords = document.createElement("div");
  swords.className = "versus-swords";
  swords.textContent = "⚔";
  const cards = document.createElement("div");
  cards.className = "versus-cards";
  cards.append(winnerCanvas, swords, loserCanvas);
  const outcome = document.createElement("div");
  outcome.className = "versus-line";
  container.append(cards, outcome);

  let busy = false;
  // Counts screens, so an old screen's timers can't touch a newer one.
  let showId = 0;

  return {
    get busy() {
      return busy;
    },
    async show(winner, loser, line) {
      busy = true;
      const id = ++showId;
      const [paintWinner, paintLoser] = await Promise.all([prepareCard(winner), prepareCard(loser)]);
      if (id !== showId) return;
      paintWinner(winnerCtx);
      paintLoser(loserCtx);
      outcome.textContent = line;
      outcome.style.visibility = "hidden";
      container.hidden = false;
      const map = mapRect();
      container.style.left = `${map.left + map.width / 2}px`;
      container.style.top = `${versusTop(map, contentBottom(), window.innerHeight, container.offsetHeight)}px`;
      // First the two rulers face each other; then the outcome is told and the loser burns.
      setTimeout(() => {
        if (id !== showId) return;
        outcome.style.visibility = "visible";
        burnCanvas(loserCtx, loser.name, () => id === showId);
      }, VERSUS_FACE_SECONDS * 1000);
      setTimeout(() => {
        if (id !== showId) return;
        container.hidden = true;
        busy = false;
      }, VERSUS_SECONDS * 1000);
    },
  };
}
