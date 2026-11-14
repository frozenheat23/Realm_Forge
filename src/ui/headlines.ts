// Headlines (SPEC §5.4o): each year's most important event, picked for the banner on the map.
// An event's importance is its kind's weight × the size of the biggest realm involved,
// so the fall of an empire outranks a border raid. Only reads the world.
import type { Nation, NationId, Ruler, SimEvent, WorldState } from "../core/types";
import { rulerName } from "../gen/rulers";
import { HEADLINE_FADE_SECONDS, HEADLINE_HOLD_SECONDS, HEADLINE_MIN_SCORE, HEADLINE_SECONDS, HEADLINE_SIZE_FLOOR, HEADLINE_WEIGHTS } from "./config";

export type HeadlineKind = keyof typeof HEADLINE_WEIGHTS;

/** What the banner shows right now. */
export interface Headline {
  text: string;
  /** Color of the realm the news is about, for the banner's seal. */
  color: string;
  /** 0..1: fades out at the end of its time. */
  alpha: number;
}

/** Which kind of news an event is. Events carry only a type and their text, so some kinds are told apart by their wording. */
export function headlineKind(event: SimEvent): HeadlineKind {
  const has = (words: string) => event.text.includes(words);
  switch (event.type) {
    case "annexed": return "conquest";
    case "collapse": return "collapse";
    case "rebellion": return has("is reborn") ? "reborn" : "rebellion";
    case "war": return has("joins") || has("marches to defend") ? "joinsWar" : "war";
    case "peace": return has("white peace") ? "whitePeace" : has("plunders") ? "raid" : "peace";
    case "vassal":
      if (has("submits")) return "submission";
      if (has("wins its independence")) return "independenceWon";
      if (has("declares independence")) return "independenceWar";
      return "vassalOther";
    case "ruler":
      if (has("civil war")) return "civilWar";
      if (has("succession crisis")) return "crisis";
      return has("rises in") ? "greatRises" : "greatDies";
    case "faith": return "faith";
    case "founded": return "founded";
    case "alliance": return "alliance";
    default: return "minor";
  }
}

/** How important a piece of news is: its kind's weight × the size of the biggest realm in it (`share` = its share of all land, 0..1). */
export function importance(kind: HeadlineKind, share: number): number {
  return HEADLINE_WEIGHTS[kind] * (HEADLINE_SIZE_FLOOR + share);
}

/** The log's line as a headline: without "Year 12: " (the map shows the year) and starting with a capital. */
export function headlineText(text: string): string {
  const line = text.replace(/^Year \d+: /, "");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * News of a throne changing hands. The rules log only great rulers, so the banner
 * writes its own line for every succession: who died, and who follows.
 */
export function successionNews(year: number, nation: Nation, old: Ruler): SimEvent {
  const died = `${rulerName(old, nation.race)} of ${nation.name} dies after ${year - old.crowned} years`;
  const heir = rulerName(nation.ruler, nation.race);
  const next = old.dynasty === nation.ruler.dynasty ? `${heir} is crowned` : `${old.dynasty} ends, and ${heir} of ${nation.ruler.dynasty} takes the throne`;
  return { year, type: "ruler", actors: [nation.id], text: `Year ${year}: ${died}. ${next}.` };
}

export interface Headlines {
  /** Call after each simulated year, with its events and the time now (ms). */
  noteYear(state: WorldState, events: SimEvent[], now: number): void;
  /** The headline to draw at time `now`, or null. While paused it stays up, so it can be read. */
  current(now: number, playing: boolean): Headline | null;
  /** A realm's share of the land (0..1): this year's or last year's, whichever is larger, so a realm that just fell still has a size. */
  sizeOf(id: NationId): number;
  /** The largest share of the land a realm has held since the headlines began watching. */
  peakOf(id: NationId): number;
}

/** `land` = how many land cells the map has. */
export function createHeadlines(land: number): Headlines {
  // Last year's size and ruler of each realm: a realm that just fell has no land left to judge it by.
  let sharesBefore = new Map<NationId, number>();
  let sharesNow = new Map<NationId, number>();
  const peaks = new Map<NationId, number>();
  const sizeOf = (id: NationId) => Math.max(sharesNow.get(id) ?? 0, sharesBefore.get(id) ?? 0);
  let rulersBefore = new Map<NationId, Ruler>();
  let shown: { text: string; color: string; score: number; start: number } | null = null;
  let lastNow = 0;

  /** The banner's news keeps its full weight while held, then loses it as it ages, so later news can take its place. */
  function scoreLeft(now: number): number {
    if (!shown) return 0;
    const aged = (now - shown.start) / 1000 - HEADLINE_HOLD_SECONDS;
    return shown.score * Math.min(1, Math.max(0, 1 - aged / (HEADLINE_SECONDS - HEADLINE_HOLD_SECONDS)));
  }

  return {
    noteYear(state, events, now) {
      sharesBefore = sharesNow;
      sharesNow = new Map<NationId, number>();
      const shares = sharesNow;
      const rulers = new Map<NationId, Ruler>();
      for (const n of state.nations.values()) {
        if (!n.alive) continue;
        shares.set(n.id, n.area / land);
        peaks.set(n.id, Math.max(peaks.get(n.id) ?? 0, n.area / land));
        rulers.set(n.id, n.ruler);
      }
      // Every throne that changed hands this year gets its own line; the log's own "dies after" lines would repeat them.
      const news = events.filter((e) => !(e.type === "ruler" && e.text.includes("dies after"))).map((event) => ({ event, kind: headlineKind(event) }));
      for (const [id, ruler] of rulers) {
        const old = rulersBefore.get(id);
        if (!old || old === ruler || ruler.crowned !== state.year) continue;
        news.push({ event: successionNews(state.year, state.nations.get(id)!, old), kind: old.great !== undefined ? "greatDies" : "succession" });
      }
      let best: { event: SimEvent; score: number } | null = null;
      for (const { event, kind } of news) {
        const score = importance(kind, Math.max(0, ...event.actors.map(sizeOf)));
        if (!best || score > best.score) best = { event, score };
      }
      if (best && best.score >= HEADLINE_MIN_SCORE && best.score > scoreLeft(now)) {
        const about = state.nations.get(best.event.actors[0]!);
        shown = { text: headlineText(best.event.text), color: about?.color ?? "#000", score: best.score, start: now };
      }
      rulersBefore = rulers;
    },

    sizeOf,
    peakOf: (id) => peaks.get(id) ?? 0,

    current(now, playing) {
      // While paused the clock stands still for the banner.
      if (shown && !playing) shown.start += now - lastNow;
      lastNow = now;
      if (!shown) return null;
      const left = HEADLINE_SECONDS - (now - shown.start) / 1000;
      if (left <= 0) {
        shown = null;
        return null;
      }
      return { text: shown.text, color: shown.color, alpha: Math.min(1, left / HEADLINE_FADE_SECONDS) };
    },
  };
}
