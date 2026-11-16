// Realm titles and split marks (SPEC §5.4r, §5.4s).
import { describe, expect, it } from "vitest";
import { Race, type Nation, type SimEvent, type WorldState } from "../src/core/types";
import { createGhosts, shatterNews } from "../src/render/ghosts";
import { GHOST_YEARS, SEAM_YEARS, TITLE_FALL_YEARS } from "../src/render/palette";
import { freshSplits, isSeam } from "../src/render/seams";
import { createTitles, crownShares, rankFor, rankNews, titleWord } from "../src/render/titles";

function nation(id: number, extra: Partial<Nation> = {}): Nation {
  return { id, name: `Realm ${id}`, race: Race.Human, alive: true, founded: 0, ...extra } as Nation;
}

/** A world of 100 land cells in a row; `cells[id]` says how many each realm owns. */
function worldOf(nations: Nation[], cells: Record<number, number>, year = 1): WorldState {
  const owner = nations.flatMap((n) => Array<number>(cells[n.id] ?? 0).fill(n.id));
  while (owner.length < 100) owner.push(0);
  return { year, nations: new Map(nations.map((n) => [n.id, n])), state: { owner: Int32Array.from(owner) } } as unknown as WorldState;
}
const map = { cells: Array.from({ length: 100 }, (_, i) => ({ site: [i, 0] as [number, number] })) } as never;

describe("realm titles", () => {
  it("ranks a realm by its share of the land", () => {
    expect([rankFor(0.01), rankFor(0.05), rankFor(0.3)]).toEqual([0, 1, 2]);
  });

  it("uses each race's own words, and a vassal's word for a vassal", () => {
    expect(titleWord(nation(1), 1, false)).toBe("Kingdom");
    expect(titleWord(nation(1, { race: Race.Orc }), 2, false)).toBe("Great Horde");
    expect(titleWord(nation(1), 2, true)).toBe("March");
  });

  it("counts a vassal's land toward its overlord's crown", () => {
    const shares = crownShares(worldOf([nation(1), nation(2, { overlord: 1 })], { 1: 15, 2: 10 }), 100);
    expect(shares.get(1)).toBe(0.25);
    expect(shares.get(2)).toBe(0.1);
  });

  it("raises a rank at once but lowers it only after years of being small", () => {
    const titles = createTitles(100);
    const realm = nation(1);
    titles.noteYear(worldOf([realm], { 1: 10 }, 1));
    const rise = titles.noteYear(worldOf([realm], { 1: 30 }, 2));
    expect(rise.map((c) => [c.from, c.to])).toEqual([[1, 2]]);
    expect(rankNews(rise[0]!)).toBe("Realm 1 is proclaimed an Empire.");

    // Small again: still an empire until TITLE_FALL_YEARS have passed.
    expect(titles.noteYear(worldOf([realm], { 1: 10 }, 3))).toEqual([]);
    const small = worldOf([realm], { 1: 10 }, 3 + TITLE_FALL_YEARS);
    const fall = titles.noteYear(small);
    expect(fall.map((c) => [c.from, c.to])).toEqual([[2, 1]]);
    expect(rankNews(fall[0]!)).toBe("The Empire of Realm 1 is no more: it is a Kingdom again.");
    expect(titles.rankOf(small, realm)).toBe(1);
  });
});

describe("fresh seams", () => {
  it("marks a breakaway's border with the realm it left and with fellow breakaways", () => {
    const state = worldOf([nation(1), nation(2, { parent: 1, founded: 100 }), nation(3, { parent: 1, founded: 105 }), nation(4)], {}, 106);
    const fresh = freshSplits(state);
    expect([...fresh.keys()]).toEqual([2, 3]);
    expect(isSeam(fresh, 2, 1)).toBe(true);
    expect(isSeam(fresh, 2, 3)).toBe(true);
    expect(isSeam(fresh, 2, 4)).toBe(false);
  });

  it("fades out after SEAM_YEARS", () => {
    const state = worldOf([nation(1), nation(2, { parent: 1, founded: 100 })], {}, 100 + SEAM_YEARS);
    expect(freshSplits(state).size).toBe(0);
  });
});

describe("ghost names", () => {
  const rebellion = (year: number): SimEvent => ({ year, type: "rebellion", actors: [2, 1], text: "" });

  it("leaves the name of a great realm that breaks apart, then lets it fade", () => {
    const ghosts = createGhosts(map, 100);
    const empire = nation(1);
    expect(ghosts.noteYear(worldOf([empire], { 1: 40 }, 1), [])).toEqual([]);
    const rebels = nation(2, { parent: 1, founded: 2 });
    const shatters = ghosts.noteYear(worldOf([empire, rebels], { 1: 20, 2: 20 }, 2), [rebellion(2)]);
    expect(shatters).toHaveLength(1);
    expect(shatters[0]).toMatchObject({ share: 0.4, successors: 1 });
    expect(shatterNews(shatters[0]!)).toBe("Realm 1 breaks apart; a new realm rises from its lands.");
    // The name sits in the middle of the land it held (cells 0..39).
    expect(ghosts.showing(2)[0]).toMatchObject({ name: "Realm 1", x: 19.5 });
    expect(ghosts.showing(2 + GHOST_YEARS)).toEqual([]);
  });

  it("ignores land lost to conquest, and small realms", () => {
    const ghosts = createGhosts(map, 100);
    ghosts.noteYear(worldOf([nation(1), nation(3)], { 1: 40, 3: 5 }, 1), []);
    // Realm 1 loses half its land with no rebellion; realm 3 is too small to matter.
    expect(ghosts.noteYear(worldOf([nation(1), nation(3)], { 1: 20, 3: 1 }, 2), [{ year: 2, type: "rebellion", actors: [9, 3], text: "" }])).toEqual([]);
  });
});
