// Dispatches (M20 step 4, docs/systems/play.md): what happened to the played realm this year.
import { describe, expect, it } from "vitest";
import type { SimEvent, WorldState } from "../src/core/types";
import { giveCommand } from "../src/sim/sandbox";
import { dispatchesFor, watchRealm } from "../src/ui/dispatches";
import { makeNation, makeState, row } from "./tinyWorld";

// Three nations in a row: [1][1] | [2][2] | [3][3], with nation 1 played.
function played(): WorldState {
  const state = makeState(row(6), [1, 1, 2, 2, 3, 3], [makeNation(1, 0), makeNation(2, 2), makeNation(3, 4)]);
  giveCommand(state, { kind: "play", nation: 1 });
  return state;
}

const event = (type: SimEvent["type"], actors: number[], text = "Year 1: something happens."): SimEvent => ({ year: 1, type, actors, text });

describe("dispatches", () => {
  it("tell nothing when no one plays", () => {
    const state = makeState(row(2), [1, 2], [makeNation(1, 0), makeNation(2, 1)]);
    expect(dispatchesFor(state, [event("war", [2, 1])], watchRealm(state))).toEqual([]);
  });

  it("report a war declared on you, but not wars between others", () => {
    const state = played();
    const before = watchRealm(state);
    const news = dispatchesFor(state, [event("war", [2, 1], "Year 1: Nation2 declares war on Nation1."), event("war", [3, 2])], before);
    expect(news).toEqual([{ kind: "war", text: "Nation2 declares war on Nation1." }]);
  });

  it("say when you stayed out of an ally's war, and why, or that you joined", () => {
    const state = played();
    state.alliances.push({ a: 1, b: 3, since: 0, renewed: 0 });
    const before = watchRealm(state);
    const attacked = event("war", [2, 3], "Year 1: Nation2 declares war on Nation3.");
    const stayed = dispatchesFor(state, [attacked], before);
    expect(stayed[0]!.text).toContain("You stayed out: your policy is to join only when an ally is attacked");
    const joined = dispatchesFor(state, [attacked, event("war", [1, 2, 3], "Year 1: Nation1 marches to defend Nation3 against Nation2.")], before);
    expect(joined).toHaveLength(1);
    expect(joined[0]!.text).toContain("marches to defend");
  });

  it("report revolts, routs, a new ruler and the realm's fall", () => {
    const state = played();
    const before = watchRealm(state);
    const me = state.nations.get(1)!;
    state.battles.push({ cell: 1, winner: 2, loser: 1, lost: 1, routed: true });
    me.ruler = { ...me.ruler, name: "Novus", crowned: 1 };
    const news = dispatchesFor(state, [event("rebellion", [4, 1], "Year 1: Nation4 breaks away from Nation1.")], before);
    // An ordinary succession is its own kind ("heir"), off by default.
    expect(news.map((d) => d.kind)).toEqual(["revolt", "battle", "heir"]);
    expect(news[2]!.text).toContain("Novus");

    state.battles = [];
    me.alive = false;
    expect(dispatchesFor(state, [], before)).toEqual([{ kind: "fall", text: "Nation1 has fallen." }]);
  });

  it("report only the first rout of each war", () => {
    const state = played();
    const before = watchRealm(state);
    state.year = 5;
    state.battles.push({ cell: 1, winner: 2, loser: 1, lost: 1, routed: true });
    const record = { id: 1, attacker: 2, defender: 1, allies: [], goal: "conquer" as const, start: 3, scores: [], fallen: { attack: 0, defend: 0 }, moments: [],
      battles: [{ year: 5, cell: 1, winner: 2, loser: 1, lost: 1, routed: true }] };
    state.warRecords.push(record);
    expect(dispatchesFor(state, [], before).map((d) => d.kind)).toEqual(["battle"]);
    // Routed once already in this war (year 4): no pause this time.
    record.battles.unshift({ year: 4, cell: 0, winner: 2, loser: 1, lost: 1, routed: true });
    expect(dispatchesFor(state, [], before)).toEqual([]);
  });

  it("report the capital besieged once, not every year", () => {
    const state = played();
    const before = watchRealm(state);
    state.state.siege[0] = 0.5;
    expect(dispatchesFor(state, [], before).map((d) => d.kind)).toEqual(["battle"]);
    expect(dispatchesFor(state, [], watchRealm(state))).toEqual([]);
  });
});
