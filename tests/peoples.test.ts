// Peoples (src/ui/peoples.ts): which races still rule, and the news when one falls or returns.
import { describe, expect, it } from "vitest";
import { Race, type Nation, type WorldState } from "../src/core/types";
import { createPeoplesWatch, peopleNews, peoples } from "../src/ui/peoples";
import { peopleNote } from "../src/ui/worldBand";

function nation(id: number, race: number, area: number, overlord?: number): Nation {
  return { id, name: `Realm ${id}`, race, area, overlord, alive: true } as unknown as Nation;
}
/** A world where each living realm owns as many cells as its `area` says. */
function worldOf(nations: Nation[], year = 1): WorldState {
  const world = { year, nations: new Map(nations.map((n) => [n.id, n])), state: { owner: [] as number[] } };
  const redraw = () => (world.state.owner = [...world.nations.values()].flatMap((n) => (n.alive ? Array<number>(n.area).fill(n.id) : [])));
  redraw();
  return Object.assign(world, { redraw }) as unknown as WorldState;
}
/** A realm falls: it dies this year and its land goes to nobody. */
function fall(world: WorldState, id: number): void {
  const n = world.nations.get(id)!;
  n.alive = false;
  n.fell = world.year;
  (world as unknown as { redraw(): void }).redraw();
}

describe("peoples", () => {
  it("counts each race's realms, vassals and land", () => {
    const world = worldOf([nation(1, Race.Human, 200), nation(2, Race.Orc, 100), nation(3, Race.Orc, 50, 1)]);
    const rows = peoples(world, 1000);
    expect(rows.find((r) => r.race === Race.Human)).toMatchObject({ realms: [1], vassals: 0, share: 0.2 });
    expect(rows.find((r) => r.race === Race.Orc)).toMatchObject({ realms: [2, 3], vassals: 1, share: 0.15 });
    expect(rows.find((r) => r.race === Race.Dwarf)).toMatchObject({ realms: [], share: 0 });
  });

  it("tells when a race loses its last realm, and names it", () => {
    const world = worldOf([nation(1, Race.Human, 200), nation(2, Race.Orc, 100), nation(3, Race.Orc, 50)]);
    const watch = createPeoplesWatch();
    expect(watch.noteYear(world, 1000)).toEqual([]);
    world.year = 2;
    fall(world, 2);
    // One Orc realm still stands: no news yet.
    expect(watch.noteYear(world, 1000)).toEqual([]);
    world.year = 3;
    fall(world, 3);
    const [change] = watch.noteYear(world, 1000);
    expect(change).toMatchObject({ race: Race.Orc, kind: "lastOfRace", peak: 0.15 });
    expect(peopleNews(change!)).toBe("Realm 3 falls, and with it the last realm of the Orcs.");
    expect(watch.fellIn(Race.Orc)).toBe(3);
  });

  it("tells when a fallen race rules again, but not when a race rules for the first time", () => {
    const world = worldOf([nation(1, Race.Human, 200), nation(2, Race.Orc, 100)]);
    const watch = createPeoplesWatch();
    watch.noteYear(world, 1000);
    world.year = 2;
    fall(world, 2);
    watch.noteYear(world, 1000);
    world.year = 3;
    world.nations.set(4, nation(4, Race.Orc, 30));
    // Dwarves never ruled before: their first realm is not a return.
    world.nations.set(5, nation(5, Race.Dwarf, 30));
    const changes = watch.noteYear(world, 1000);
    expect(changes.map((c) => [c.race, c.kind])).toEqual([[Race.Orc, "raceReturns"]]);
    expect(peopleNews(changes[0]!)).toBe("The Orcs rule again: Realm 4 rises.");
    expect(watch.fellIn(Race.Orc)).toBeUndefined();
  });

  it("writes the list's note", () => {
    expect(peopleNote(3, 0.214, undefined)).toBe("3 realms · 21%");
    expect(peopleNote(1, 0.05, undefined)).toBe("1 realm · 5%");
    expect(peopleNote(0, 0, 812)).toBe("fell in 812");
    expect(peopleNote(0, 0, undefined)).toBe("no realm");
  });
});
