// Vassalage v1 (docs/systems/vassalage.md): who serves whom, their duties, and the ways out.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import type { War } from "../src/core/types";
import { AI, everyoneAI } from "../src/sim/ai/default";
import type { Controller } from "../src/sim/ai/controller";
import { allianceRefusal } from "../src/sim/diplomacy";
import { independence, independenceRefusal } from "../src/sim/independence";
import { applyPlayerCommand } from "../src/sim/play";
import { callAllies, concludeWar, declareWarRefusal, endWars, helpers, warLookups } from "../src/sim/war";
import { becomeVassal, crownOf, sameCrown, vassalsOf } from "../src/sim/vassals";
import { makeNation, makeState, row } from "./tinyWorld";

// Three realms in a row: 1 owns 0–9, 2 owns 10–19, 3 owns 20–29. Nation 2 serves nation 1.
function crown() {
  const owners = Array.from({ length: 30 }, (_, i) => (i < 10 ? 1 : i < 20 ? 2 : 3));
  const state = makeState(row(30), owners, [makeNation(1, 0), makeNation(2, 15), makeNation(3, 29)]);
  state.nations.get(2)!.overlord = 1;
  return state;
}

const war = (attacker: number, defender: number, extra: Partial<War> = {}): War => ({
  id: 7, attacker, defender, startYear: 0, score: 0, battleScore: 0, goal: "conquer", goalCells: [], ...extra,
});

describe("the relationship", () => {
  it("knows who lives under one crown", () => {
    const state = crown();
    expect(crownOf(state, 2)).toBe(1);
    expect(sameCrown(state, 1, 2)).toBe(true);
    expect(sameCrown(state, 2, 3)).toBe(false);
    expect(vassalsOf(state, 1).map((n) => n.id)).toEqual([2]);
  });

  it("submitting frees the loser's own vassals and ends its alliances (one level only)", () => {
    const state = crown();
    state.alliances.push({ a: 2, b: 3, since: 0, renewed: 0 });
    state.nations.get(3)!.overlord = 2; // set by hand: 2 is the overlord of 3 for this test
    delete state.nations.get(2)!.overlord;
    becomeVassal(state, state.nations.get(2)!, state.nations.get(1)!);
    expect(state.nations.get(2)!.overlord).toBe(1);
    expect(state.nations.get(3)!.overlord).toBeUndefined();
    expect(state.alliances).toEqual([]);
  });
});

describe("duties", () => {
  it("a vassal starts no wars, and no war is declared inside a crown", () => {
    const state = crown();
    expect(declareWarRefusal(state, { kind: "declareWar", nation: 2, target: 3, goal: "raid" })).toContain("vassal");
    expect(declareWarRefusal(state, { kind: "declareWar", nation: 1, target: 2, goal: "raid" })).toContain("one crown");
    expect(declareWarRefusal(state, { kind: "declareWar", nation: 3, target: 2, goal: "raid" })).toBeNull();
  });

  it("a vassal makes no alliances", () => {
    expect(allianceRefusal(crown(), 2, 3)).toContain("vassal");
  });

  it("the overlord defends its vassal without being asked", () => {
    const state = crown();
    const unwilling: Controller = { ...AI, joinWar: () => false };
    const attack = war(3, 2);
    state.wars.push(attack);
    const lookups = warLookups(state);
    const theirs = helpers(state, lookups, 2, 3);
    expect(theirs.map((n) => n.id)).toEqual([1]);
    callAllies(state, lookups, attack, [], theirs, createRng("d"), () => unwilling);
    expect(state.wars.some((w) => w.joined === attack.id && w.defender === 1)).toBe(true);
  });

  it("wars between realms that come to serve one crown end quietly", () => {
    const state = crown();
    state.wars.push(war(1, 2));
    endWars(state, everyoneAI);
    expect(state.wars).toEqual([]);
    expect(state.warRecords).toEqual([]); // no record was opened for this hand-made war
  });
});

describe("ways out", () => {
  it("a vassal whose overlord falls goes free", () => {
    const state = crown();
    state.nations.get(1)!.alive = false;
    const events = independence(state, createRng("f"), everyoneAI);
    expect(state.nations.get(2)!.overlord).toBeUndefined();
    expect(events[0]!.text).toContain("serves no one");
  });

  it("only in the year the overlord's new ruler is crowned may a vassal declare independence", () => {
    const state = crown();
    state.year = 5;
    expect(independenceRefusal(state, state.nations.get(2))).toContain("new ruler");
    state.nations.get(1)!.ruler.crowned = 5;
    expect(independenceRefusal(state, state.nations.get(2))).toBeNull();
    expect(independenceRefusal(state, state.nations.get(3))).toContain("serves no overlord");
  });

  it("declaring starts a war of independence; fellow vassals stay out", () => {
    const state = crown();
    state.year = 5;
    state.nations.get(1)!.ruler.crowned = 5;
    // Nation 4 is a fellow vassal of 1, bordering 2 through cell 30.
    state.nations.set(4, makeNation(4, 0, { overlord: 1 }));
    const rising: Controller = { ...AI, declareIndependence: () => true };
    const events = independence(state, createRng("i"), () => rising);
    expect(events[0]!.text).toContain("declares independence");
    expect(state.wars).toHaveLength(1);
    expect(state.wars[0]).toMatchObject({ attacker: 2, defender: 1, goal: "independence" });
  });

  it("a vassal that no longer borders its overlord simply goes free when it declares", () => {
    const owners = Array.from({ length: 30 }, (_, i) => (i < 10 ? 1 : i < 20 ? 3 : 2));
    const state = makeState(row(30), owners, [makeNation(1, 0), makeNation(2, 25, { overlord: 1 }), makeNation(3, 15)]);
    state.year = 5;
    state.nations.get(1)!.ruler.crowned = 5;
    const events = independence(state, createRng("t"), () => ({ ...AI, declareIndependence: () => true }));
    expect(state.nations.get(2)!.overlord).toBeUndefined();
    expect(events[0]!.text).toContain("too far");
  });

  it("winning the war frees the vassal; anything else keeps it", () => {
    for (const [winner, free] of [[2, true], [1, false], [null, false]] as const) {
      const state = crown();
      const w = war(2, 1, { goal: "independence" });
      state.wars.push(w);
      state.warRecords.push({ id: w.id, attacker: 2, defender: 1, goal: "independence", start: 0, allies: [], scores: [], battles: [], fallen: { attack: 0, defend: 0 }, moments: [] } as never);
      const event = concludeWar(state, w, winner === null ? null : state.nations.get(winner)!, "decisive", false)!;
      expect(state.nations.get(2)!.overlord === undefined).toBe(free);
      expect(event.type).toBe("vassal");
      expect(state.state.owner.slice(10, 20).every((o) => o === 2)).toBe(true); // no land changes hands
    }
  });

  it("the player declares by an order, under the same rules", () => {
    const state = crown();
    state.player = { nation: 2, culture: 2, policies: { joinWar: "never", acceptAlliance: "never", wonWar: "peace", suePeace: "never", enemySues: "refuse", mobilize: 0.5, rebels: "fight" } };
    state.year = 5; // the overlord's ruler was crowned in year 0
    const order = { kind: "declareIndependence" } as const;
    expect(applyPlayerCommand(state, order, createRng("p"), everyoneAI).ok).toBe(false);
    state.nations.get(1)!.ruler.crowned = state.year;
    const result = applyPlayerCommand(state, order, createRng("p"), everyoneAI);
    expect(result.ok).toBe(true);
    expect(state.wars[0]).toMatchObject({ attacker: 2, defender: 1, goal: "independence" });
  });
});
