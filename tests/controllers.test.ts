// M15: every nation choice goes through a controller and comes back as a command
// the rules check (docs/systems/controllers.md).
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { Faith, NO_TARGET } from "../src/core/types";
import { generateWorld } from "../src/gen";
import type { Controller, Controllers } from "../src/sim/ai/controller";
import { AI } from "../src/sim/ai/default";
import { musterArmies } from "../src/sim/armies";
import { applyCommand, type Command } from "../src/sim/commands";
import { SIM } from "../src/sim/params";
import { neighborPairs } from "../src/sim/helpers";
import { tick } from "../src/sim/tick";
import { runYears } from "./longRun";
import { makeNation, makeState, row } from "./tinyWorld";

// Two nations side by side: [1][1][1][1][1] | [2][2][2][2][2]
function twoNations() {
  return makeState(row(10), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], [makeNation(1, 0, { reserve: 10 }), makeNation(2, 9, { reserve: 10 })]);
}

/** Applies `command` and returns why it was refused (or "done"). */
function outcome(state: ReturnType<typeof twoNations>, command: Command): string {
  const result = applyCommand(state, command);
  return result.ok ? "done" : result.reason;
}

describe("commands", () => {
  it("start a war between neighbors, through the same rules the AI uses", () => {
    const state = twoNations();
    expect(outcome(state, { kind: "declareWar", nation: 2, target: 1, goal: "raid" })).toBe("done");
    expect(state.wars).toHaveLength(1);
    // Either side may declare, not just the stronger one.
    expect(state.wars[0]!.attacker).toBe(2);
    expect(state.events).toHaveLength(0); // events are the step's to keep; the command only returns them
  });

  it("are refused when the rules don't allow them", () => {
    const state = twoNations();
    state.truces.push({ a: 1, b: 2, until: 50 });
    expect(outcome(state, { kind: "declareWar", nation: 1, target: 2, goal: "raid" })).toMatch(/truce/);

    const allies = twoNations();
    allies.alliances.push({ a: 1, b: 2, since: 0, renewed: 0 });
    expect(outcome(allies, { kind: "declareWar", nation: 1, target: 2, goal: "raid" })).toMatch(/allies/);
    expect(outcome(allies, { kind: "formAlliance", a: 1, b: 2 })).toMatch(/already allies/);

    const apart = makeState(row(3), [1, 0, 2], [makeNation(1, 0), makeNation(2, 2)]);
    expect(outcome(apart, { kind: "declareWar", nation: 1, target: 2, goal: "raid" })).toMatch(/border/);

    const fresh = twoNations();
    expect(outcome(fresh, { kind: "declareWar", nation: 1, target: 2, goal: "reclaim" })).toMatch(/claim/);
    expect(outcome(fresh, { kind: "declareWar", nation: 1, target: 2, goal: "support" })).toMatch(/goal/);
    expect(outcome(fresh, { kind: "breakAlliance", nation: 1, other: 2 })).toMatch(/aren't allies/);
    expect(outcome(fresh, { kind: "adoptFaith", nation: 1, faith: Faith.RadiantCovenant })).toMatch(/already holds/);
    expect(outcome(fresh, { kind: "crushRevolt", nation: 1, rebels: 2 })).toMatch(/break away/);
  });

  it("can't join a war without being a free ally that can reach it", () => {
    const state = makeState(row(6), [1, 1, 2, 2, 3, 3], [makeNation(1, 0), makeNation(2, 2), makeNation(3, 5)]);
    applyCommand(state, { kind: "declareWar", nation: 1, target: 2, goal: "raid" });
    const war = state.wars[0]!.id;
    expect(outcome(state, { kind: "joinWar", nation: 3, war, side: "defend" })).toMatch(/ally/);
    state.alliances.push({ a: 2, b: 3, since: 0, renewed: 0 });
    expect(outcome(state, { kind: "joinWar", nation: 3, war, side: "defend" })).toBe("done");
    expect(state.wars.at(-1)!.joined).toBe(war);
  });

  it("raise armies only from soldiers the reserve has, and send them only where they can go", () => {
    const state = twoNations();
    applyCommand(state, { kind: "declareWar", nation: 1, target: 2, goal: "raid" });
    const war = state.wars[0]!.id;
    expect(outcome(state, { kind: "mobilize", nation: 1, war, size: 11 })).toMatch(/reserve/);
    expect(outcome(state, { kind: "mobilize", nation: 1, war, size: 5 })).toBe("done");
    expect(outcome(state, { kind: "mobilize", nation: 1, war, size: 1 })).toMatch(/already has an army/);

    const army = state.armies[0]!;
    expect(outcome(state, { kind: "orderArmy", army: army.id, target: 9 })).toBe("done");
    expect(army.target).toBe(9);
    expect(outcome(state, { kind: "orderArmy", army: army.id, target: -5 })).toMatch(/can't get there/);
    expect(outcome(state, { kind: "orderArmy", army: army.id, target: NO_TARGET })).toBe("done");
    expect(army.path).toEqual([]);
  });
});

describe("controllers", () => {
  it("decide how many soldiers go to war", () => {
    const state = twoNations();
    applyCommand(state, { kind: "declareWar", nation: 1, target: 2, goal: "raid" });
    const halfHearted: Controller = { ...AI, mobilize: (_view, me, wars) => wars.map(() => me.reserve / 10) };
    musterArmies(state, (id) => (id === 1 ? halfHearted : AI));
    const mine = state.armies.find((a) => a.owner === 1)!;
    const theirs = state.armies.find((a) => a.owner === 2)!;
    expect(mine.size).toBeCloseTo(1);
    expect(theirs.size).toBeCloseTo(10 * SIM.MOBILIZE_SHARE);
  });

  it("a world where no one wants war has no wars declared, but rebellions still happen", async () => {
    const passive: Controller = { ...AI, declareWar: () => null, crushRevolt: () => false };
    const { state } = generateWorld("passive", 320, 180);
    const rng = createRng("passive").fork("sim");
    await runYears(1000, () => tick(state, rng, () => passive));
    expect(state.events.filter((e) => e.text.includes("declares war"))).toHaveLength(0);
    expect(state.events.some((e) => e.type === "rebellion")).toBe(true);
  }, 60_000);

  it("one nation's choices don't change the dice of nations it doesn't touch", () => {
    // From 60 moments in history, the next year is run twice: once as usual, once with
    // a middling nation attacking every neighbor it can. Wars declared that year between
    // nations that are neither it nor its neighbors must come out the same.
    const { state } = generateWorld("isolation");
    const rng = createRng("isolation").fork("sim");
    for (let y = 0; y < 100; y++) tick(state, rng);
    const elsewhere = (copy: typeof state, controllers: Controllers, near: Set<number>) =>
      tick(copy, rng, controllers)
        .filter((e) => e.text.includes("declares war") && !e.actors.some((id) => near.has(id)))
        .map((e) => e.text);

    let compared = 0;
    for (let moment = 0; moment < 60; moment++) {
      const living = [...state.nations.values()].filter((n) => n.alive).sort((a, b) => b.area - a.area || a.id - b.id);
      const chosen = living[Math.floor(living.length / 2)]!;
      const near = new Set([chosen.id]);
      for (const [a, b] of neighborPairs(state)) {
        if (a === chosen.id) near.add(b);
        if (b === chosen.id) near.add(a);
      }
      const warmonger: Controller = { ...AI, declareWar: () => "raid" };
      const usual = elsewhere(structuredClone(state), () => AI, near);
      expect(elsewhere(structuredClone(state), (id) => (id === chosen.id ? warmonger : AI), near)).toEqual(usual);
      compared += usual.length;
      tick(state, rng);
    }
    expect(compared).toBeGreaterThan(0);
  }, 120_000);

  it("the rules never turn down one of the AI's own commands", async () => {
    const refused: string[] = [];
    const watched: Controller = { ...AI, refused: (command, reason) => refused.push(`${command.kind}: ${reason}`) };
    const everyone: Controllers = () => watched;
    const { state } = generateWorld("never-refused", 320, 180);
    const rng = createRng("never-refused").fork("sim");
    await runYears(1000, () => tick(state, rng, everyone));
    expect(state.events.some((e) => e.type === "war")).toBe(true);
    expect(refused).toEqual([]);
  }, 60_000);
});
