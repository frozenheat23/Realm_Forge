// The settled start (docs/systems/start.md): old kingdoms sharing all the land at year 0.
import { describe, expect, it } from "vitest";
import { Settlement } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { OLD_REALM_YEARS } from "../src/gen/params";
import { PLAYABLE_RACES } from "../src/gen/races";
import { cityAreas } from "../src/sim/land";
import { SIM } from "../src/sim/params";
import { createWorld, startFromText, startToText } from "../src/sim/start";

describe("a settled start", () => {
  const { state } = createWorld("kingdoms", { kind: "settled", kingdoms: 10 }, 320, 180);
  const s = state.state;
  const nations = [...state.nations.values()];

  it("has the kingdoms asked for, every race among them", () => {
    expect(nations).toHaveLength(10);
    for (const race of PLAYABLE_RACES) expect(nations.some((n) => n.race === race)).toBe(true);
    const five = createWorld("kingdoms", { kind: "settled", kingdoms: 5 }, 320, 180).state;
    expect(new Set([...five.nations.values()].map((n) => n.race)).size).toBe(5);
  });

  it("shares out all the land the capitals can reach, leaving no kingdom a scrap", () => {
    // Every habitable cell next to a kingdom's land is a kingdom's too.
    for (const cell of state.cells) {
      if (!cell.isLand || cell.capacity <= 0 || s.owner[cell.id] !== 0) continue;
      expect(cell.neighbors.some((n) => s.owner[n] !== 0 && state.cells[n]!.capacity > 0)).toBe(false);
    }
    for (const n of nations) expect([...s.owner].filter((o) => o === n.id).length).toBeGreaterThan(SIM.MIN_AREA);
  });

  it("holds subject peoples, each of a culture of their own race", () => {
    let foreign = 0;
    for (let c = 0; c < s.owner.length; c++) {
      if (s.owner[c] === 0) continue;
      if (s.race[c] !== state.nations.get(s.owner[c]!)!.race) foreign++;
      expect(state.nations.get(s.culture[c]!)!.race).toBe(s.race[c]);
    }
    expect(foreign).toBeGreaterThan(0);
  });

  it("is old: core land, towns and named cities kept apart", () => {
    for (let c = 0; c < s.owner.length; c++) if (s.owner[c] !== 0) expect(s.ownedSince[c]).toBe(-OLD_REALM_YEARS);
    const cities = [...s.settlement.keys()].filter((c) => s.settlement[c] === Settlement.City);
    expect(cities.length).toBeGreaterThan(0);
    expect([...s.settlement].some((l) => l === Settlement.Town)).toBe(true);
    for (const c of cities) expect(state.cityNames.has(c)).toBe(true);
    // No city stands in another's space.
    const near = cityAreas(state);
    for (const c of cities) expect(near[c]).toBe(0);
    expect(state.events.every((e) => e.type === "founded" && e.text.includes("ancient realm"))).toBe(true);
  });

  it("is the same every time for the same seed", () => {
    const again = createWorld("kingdoms", { kind: "settled", kingdoms: 10 }, 320, 180).state;
    expect([...again.state.owner]).toEqual([...s.owner]);
    expect(again.events).toEqual(state.events);
  });
});

describe("start options", () => {
  it("the open start is the old one, unchanged", () => {
    const open = createWorld("open", { kind: "open" }, 320, 180).state;
    expect(open.events).toEqual(generateWorld("open", 320, 180).state.events);
  });

  it("read from and written to the page address", () => {
    expect(startFromText("open")).toEqual({ kind: "open" });
    expect(startFromText("7")).toEqual({ kind: "settled", kingdoms: 7 });
    for (const bad of [null, "", "3", "12", "x"]) expect(startFromText(bad)).toEqual({ kind: "settled", kingdoms: 10 });
    expect(startToText({ kind: "settled", kingdoms: 6 })).toBe("6");
  });
});
