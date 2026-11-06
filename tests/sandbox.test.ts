// The sandbox's god commands and command log (docs/systems/sandbox.md).
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import type { GodCommand, WorldState } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { everyoneAI } from "../src/sim/ai/default";
import { neighborPairs, pairKey } from "../src/sim/helpers";
import { giveCommand, replayCommands } from "../src/sim/sandbox";
import { SIM } from "../src/sim/params";
import { fromSnapshot, toSnapshot } from "../src/sim/snapshot";
import { tick } from "../src/sim/tick";
import { startWar } from "../src/sim/war";
import { runYears } from "./longRun";
import { makeNation, makeState, row } from "./tinyWorld";

// Two nations side by side: [1][1][1] | [2][2][2]
function twoNations(): WorldState {
  return makeState(row(6), [1, 1, 1, 2, 2, 2], [makeNation(1, 0, { reserve: 10 }), makeNation(2, 5, { reserve: 10 })]);
}

describe("god commands", () => {
  it("start a war even through a truce and an alliance, and log it", () => {
    const state = twoNations();
    state.truces.push({ a: 1, b: 2, until: 100 });
    state.alliances.push({ a: 1, b: 2, since: 0, renewed: 0 });
    const result = giveCommand(state, { kind: "godWar", nation: 1, target: 2, goal: "raid" }, everyoneAI);
    expect(result.ok).toBe(true);
    expect(state.wars).toHaveLength(1);
    expect(state.truces).toHaveLength(0);
    expect(state.alliances).toHaveLength(0);
    expect(state.events.at(-1)!.text).toContain("by the will of the gods");
    expect(state.commands).toEqual([{ year: 0, command: { kind: "godWar", nation: 1, target: 2, goal: "raid" } }]);
  });

  it("refuse what the rules don't allow, and change nothing", () => {
    const state = makeState(row(7), [1, 1, 1, 0, 2, 2, 2], [makeNation(1, 0), makeNation(2, 6)]);
    const apart = giveCommand(state, { kind: "godWar", nation: 1, target: 2, goal: "raid" }, everyoneAI);
    expect(apart).toEqual({ ok: false, reason: "they don't share a border" });

    const allies = twoNations();
    allies.alliances.push({ a: 1, b: 2, since: 0, renewed: 0 });
    const noClaim = giveCommand(allies, { kind: "godWar", nation: 1, target: 2, goal: "reclaim" }, everyoneAI);
    expect(noClaim.ok).toBe(false);
    expect(allies.alliances).toHaveLength(1); // a refused war doesn't cost the alliance
    expect(allies.commands).toHaveLength(0);
  });

  it("impose peace: the chosen winner keeps the land it holds", () => {
    const state = twoNations();
    const war = startWar(state, state.nations.get(1)!, state.nations.get(2)!, "conquer", [3]);
    state.state.occupier[3] = 1;
    const result = giveCommand(state, { kind: "godPeace", war: war.id, winner: 1 }, everyoneAI);
    expect(result.ok).toBe(true);
    expect(state.wars).toHaveLength(0);
    expect(state.state.owner[3]).toBe(1);
    expect(state.warRecords[0]!.outcome).toMatchObject({ how: "imposed", winner: 1 });
    expect(state.events.at(-1)!.text).toContain("the gods impose peace");
    expect(state.truces.some((t) => pairKey(t.a, t.b) === pairKey(1, 2))).toBe(true);
  });

  it("impose a white peace: no land changes hands", () => {
    const state = twoNations();
    const war = startWar(state, state.nations.get(1)!, state.nations.get(2)!, "conquer", [3]);
    state.state.occupier[3] = 1;
    giveCommand(state, { kind: "godPeace", war: war.id, winner: null }, everyoneAI);
    expect(state.state.owner[3]).toBe(2);
    expect(state.warRecords[0]!.outcome!.winner).toBeUndefined();
  });

  it("end allies' wars with the war they joined", () => {
    const spec = [{ neighbors: [1, 2] }, { neighbors: [0, 2] }, { neighbors: [0, 1] }];
    const state = makeState(spec, [1, 2, 3], [makeNation(1, 0), makeNation(2, 1), makeNation(3, 2)]);
    const main = startWar(state, state.nations.get(1)!, state.nations.get(2)!, "raid", []);
    startWar(state, state.nations.get(1)!, state.nations.get(3)!, "support", [], main.id);
    giveCommand(state, { kind: "godPeace", war: main.id, winner: null }, everyoneAI);
    expect(state.wars).toHaveLength(0);
    expect(giveCommand(state, { kind: "godPeace", war: main.id, winner: null }, everyoneAI).ok).toBe(false);
  });
});

describe("the command log", () => {
  /** A short history on a small map, with a god war at year 20 and a forced peace at year 30. */
  async function alteredHistory(seed: string): Promise<WorldState> {
    const { state } = generateWorld(seed, 320, 180);
    const rng = createRng(seed).fork("sim");
    await runYears(50, () => {
      tick(state, rng);
      if (state.year === 20) {
        const [a, b] = neighborPairs(state)[0]!;
        expect(giveCommand(state, { kind: "godWar", nation: a, target: b, goal: "raid" }, everyoneAI).ok).toBe(true);
      }
      const godWar = state.wars.find((w) => w.startYear === 20 && w.joined === undefined);
      if (state.year === 30 && godWar) giveCommand(state, { kind: "godPeace", war: godWar.id, winner: godWar.defender }, everyoneAI);
    });
    return state;
  }

  const fingerprint = (state: WorldState) => state.events.map((e) => e.text).join("\n") + [...state.state.owner].join(",");

  it("replays to exactly the same history: seed + settings + log", async () => {
    const original = await alteredHistory("sandbox-replay");
    expect(original.commands.length).toBeGreaterThan(0);

    const { state } = generateWorld("sandbox-replay", 320, 180);
    const rng = createRng("sandbox-replay").fork("sim");
    await runYears(50, () => {
      tick(state, rng);
      replayCommands(state, original.commands, everyoneAI);
    });
    expect(fingerprint(state)).toBe(fingerprint(original));
    expect(state.commands).toEqual(original.commands);
  }, 60_000);

  it("is saved, and saves from before it still load", async () => {
    const original = await alteredHistory("sandbox-save");
    const generated = generateWorld("sandbox-save", 320, 180);
    const snapshot = JSON.parse(JSON.stringify(toSnapshot(original, SIM)));
    expect(fromSnapshot(snapshot, generated.world).commands).toEqual(original.commands);

    const oldSave = { ...snapshot, version: 10 };
    delete oldSave.commands;
    expect(fromSnapshot(oldSave, generated.world).commands).toEqual([]);
  }, 60_000);

  it("an untouched history gives no log", () => {
    const command: GodCommand = { kind: "godPeace", war: 999, winner: null };
    const state = twoNations();
    expect(giveCommand(state, command, everyoneAI).ok).toBe(false);
    expect(state.commands).toEqual([]);
  });
});
