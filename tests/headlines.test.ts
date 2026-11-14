// Headlines (src/ui/headlines.ts): which of a year's events reaches the banner on the map.
import { describe, expect, it } from "vitest";
import type { Nation, SimEvent, WorldState } from "../src/core/types";
import { HEADLINE_SECONDS, HEADLINE_WEIGHTS } from "../src/ui/config";
import { createHeadlines, headlineKind, headlineText, importance, successionNews } from "../src/ui/headlines";

/** Just the parts of a nation that headlines read. */
function nation(id: number, name: string, area: number, rulerName = "Aldric", crowned = 0): Nation {
  const ruler = { name: rulerName, dynasty: "House Varrin", female: false, crowned, ends: 99, boldness: 1 };
  return { id, name, color: `#00000${id}`, race: 1, alive: true, area, ruler } as unknown as Nation;
}
function worldOf(year: number, nations: Nation[]): WorldState {
  return { year, nations: new Map(nations.map((n) => [n.id, n])) } as unknown as WorldState;
}
const event = (type: SimEvent["type"], actors: number[], text: string): SimEvent => ({ year: 5, type, actors, text: `Year 5: ${text}` });

describe("headlineKind", () => {
  it("tells kinds of news apart by type and wording", () => {
    expect(headlineKind(event("peace", [1, 2], "Kethar and Ordhun sign a white peace."))).toBe("whitePeace");
    expect(headlineKind(event("peace", [1, 2], "Kethar defeats Ordhun, taking 12 provinces."))).toBe("peace");
    expect(headlineKind(event("war", [3, 1, 2], "Vathor marches to defend Kethar against Ordhun."))).toBe("joinsWar");
    expect(headlineKind(event("vassal", [1, 2], "Kethar wins its independence from Ordhun."))).toBe("independenceWon");
    expect(headlineKind(event("battle", [1, 2], "at the Battle of Lothil, Kethar routs the host of Ordhun."))).toBe("minor");
  });
});

describe("importance", () => {
  it("ranks the same news higher for a bigger realm", () => {
    expect(importance("war", 0.3)).toBeGreaterThan(importance("war", 0.02));
  });
  it("ranks a great realm's war above a small realm's fall", () => {
    expect(importance("war", 0.3)).toBeGreaterThan(importance("collapse", 0.02));
  });
  it("never makes a headline of a battle", () => {
    expect(importance("minor", 1)).toBe(0);
  });
});

describe("headlineText", () => {
  it("drops the year and starts with a capital", () => {
    expect(headlineText("Year 412: the Orcs of Gruk rise against Kethar.")).toBe("The Orcs of Gruk rise against Kethar.");
  });
});

describe("successionNews", () => {
  it("says who died and who follows", () => {
    const realm = nation(1, "Kethar", 100, "Berin", 40);
    const old = { ...realm.ruler, name: "Aldric", crowned: 12 };
    expect(successionNews(40, realm, old).text).toBe("Year 40: King Aldric of Kethar dies after 28 years. King Berin is crowned.");
  });
  it("says when the old house ends", () => {
    const realm = nation(1, "Kethar", 100, "Berin", 40);
    realm.ruler.dynasty = "House Morn";
    const old = { ...realm.ruler, name: "Aldric", crowned: 12, dynasty: "House Varrin" };
    expect(successionNews(40, realm, old).text).toContain("House Varrin ends, and King Berin of House Morn takes the throne.");
  });
});

describe("createHeadlines", () => {
  const big = nation(1, "Kethar", 300);
  const small = nation(2, "Ordhun", 10);
  const state = worldOf(5, [big, small]);
  const war = event("war", [1, 2], "Kethar declares war on Ordhun.");
  const raid = event("peace", [2, 1], "Ordhun plunders Kethar and goes home laden with spoils.");

  it("shows the year's most important event, in the color of its first realm", () => {
    const headlines = createHeadlines(1000);
    headlines.noteYear(state, [raid, war], 0);
    expect(headlines.current(1, true)).toMatchObject({ text: "Kethar declares war on Ordhun.", color: big.color, alpha: 1 });
  });

  it("shows nothing in a quiet year", () => {
    const headlines = createHeadlines(1000);
    headlines.noteYear(state, [event("city_founded", [2], "Ordhun founds the city of Lothil.")], 0);
    expect(headlines.current(1, true)).toBeNull();
  });

  it("keeps fresh big news up when smaller news follows, and lets it go once old", () => {
    const headlines = createHeadlines(1000);
    headlines.noteYear(state, [war], 0);
    const lesser = event("peace", [1, 2], "Kethar and Ordhun sign a white peace.");
    expect(importance("whitePeace", 0.3)).toBeLessThan(importance("war", 0.3));
    headlines.noteYear(state, [lesser], 200);
    expect(headlines.current(201, true)!.text).toContain("declares war");
    headlines.noteYear(state, [lesser], HEADLINE_SECONDS * 1000 * 0.9);
    expect(headlines.current(HEADLINE_SECONDS * 1000 * 0.9 + 1, true)!.text).toContain("white peace");
  });

  it("goes away after its time, but stays up while paused", () => {
    const playing = createHeadlines(1000);
    playing.noteYear(state, [war], 0);
    playing.current(0, true);
    expect(playing.current(HEADLINE_SECONDS * 1000 + 1, true)).toBeNull();

    const paused = createHeadlines(1000);
    paused.noteYear(state, [war], 0);
    paused.current(0, false);
    expect(paused.current(HEADLINE_SECONDS * 1000 + 1, false)).not.toBeNull();
  });

  it("hands back great news for the chronicle, but not small news", () => {
    const headlines = createHeadlines(1000);
    expect(headlines.noteYear(state, [war], 0)).toMatchObject({ year: 5, text: "Kethar declares war on Ordhun.", actors: [1, 2] });
    expect(headlines.noteYear(state, [raid], 100)).toBeNull();
  });

  it("writes its own line when a throne changes hands", () => {
    const headlines = createHeadlines(1000);
    const realm = nation(1, "Kethar", 300, "Aldric", 0);
    headlines.noteYear(worldOf(5, [realm]), [], 0);
    realm.ruler = { ...realm.ruler, name: "Berin", crowned: 6 };
    headlines.noteYear(worldOf(6, [realm]), [], 1000);
    expect(headlines.current(1001, true)!.text).toBe("King Aldric of Kethar dies after 6 years. King Berin is crowned.");
  });

  it("judges a fallen realm by the size it had the year before", () => {
    const headlines = createHeadlines(1000);
    const empire = nation(1, "Kethar", 400);
    headlines.noteYear(worldOf(5, [empire]), [], 0);
    empire.alive = false;
    empire.area = 0;
    headlines.noteYear(worldOf(6, [empire]), [event("collapse", [1], "Kethar collapses.")], 1000);
    expect(headlines.current(1001, true)!.text).toBe("Kethar collapses.");
    expect(HEADLINE_WEIGHTS.collapse).toBeGreaterThan(0);
  });
});
