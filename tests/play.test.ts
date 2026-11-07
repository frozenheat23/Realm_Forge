// Playing a nation (M20 step 1, docs/systems/play.md): the player's controller, orders and log.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import type { PlayerCommand, WorldState } from "../src/core/types";
import { generateWorld } from "../src/gen";
import { controllersOf, PLAYER } from "../src/sim/ai/player";
import { pairKey } from "../src/sim/helpers";
import { SIM } from "../src/sim/params";
import { giveCommand, replayCommands } from "../src/sim/sandbox";
import { fromSnapshot, toSnapshot } from "../src/sim/snapshot";
import { tick } from "../src/sim/tick";
import { startWar } from "../src/sim/war";
import { runYears } from "./longRun";
import { makeNation, makeState, row } from "./tinyWorld";

// Two nations side by side: [1][1][1] | [2][2][2]
function twoNations(): WorldState {
  return makeState(row(6), [1, 1, 1, 2, 2, 2], [makeNation(1, 0, { reserve: 10 }), makeNation(2, 5, { reserve: 10 })]);
}

/** `twoNations`, with nation 1 played. */
function playing(): WorldState {
  const state = twoNations();
  expect(giveCommand(state, { kind: "play", nation: 1 }).ok).toBe(true);
  return state;
}

describe("the player's controller", () => {
  it("answers the nation's questions only for the played nation", () => {
    const state = playing();
    const controllers = controllersOf(state);
    expect(controllers(1)).toBe(PLAYER);
    expect(controllers(2)).not.toBe(PLAYER);
    giveCommand(state, { kind: "play", nation: null });
    expect(controllers(1)).not.toBe(PLAYER); // read afresh each time
  });

  it("never starts a war, an alliance or a conversion by itself", () => {
    const state = playing();
    const [me, them] = [state.nations.get(1)!, state.nations.get(2)!];
    const rng = createRng("p");
    expect(PLAYER.declareWar(state, me, them, { claim: true, myHelpers: [], theirHelpers: [] }, rng)).toBeNull();
    expect(PLAYER.proposeAlliance(state, me, them, rng)).toBe(false);
    expect(PLAYER.keepAlliance(state, me, them, 500, rng)).toBe(true);
    expect(PLAYER.adoptFaith(state, me, 1, rng)).toBe(false);
  });

  it("joins allies' wars as its policy says", () => {
    const state = playing();
    const [me, friend, enemy] = [state.nations.get(1)!, state.nations.get(2)!, state.nations.get(2)!];
    const rng = createRng("p");
    const answers = (joinWar: "always" | "defending" | "kin" | "never") => {
      state.player!.policies.joinWar = joinWar;
      return [PLAYER.joinWar(state, me, friend, enemy, "defend", rng), PLAYER.joinWar(state, me, friend, enemy, "attack", rng)];
    };
    expect(answers("always")).toEqual([true, true]);
    expect(answers("defending")).toEqual([true, false]);
    expect(answers("never")).toEqual([false, false]);
    friend.race = me.race === 0 ? 1 : 0;
    expect(answers("kin")).toEqual([false, false]);
  });

  it("raises the share of the reserve its policy says, and sues and accepts terms once weary", () => {
    const state = playing();
    const me = state.nations.get(1)!;
    const war = startWar(state, me, state.nations.get(2)!, "raid", []);
    state.player!.policies.mobilize = 0.5;
    expect(PLAYER.mobilize(state, me, [war])).toEqual([5]);

    const rng = createRng("p");
    me.warWeariness = SIM.PLAYER_WEARY - 0.01;
    expect(PLAYER.suePeace(state, me, war, rng)).toBe(false);
    expect(PLAYER.acceptTerms(state, me, war, rng)).toBe(false);
    me.warWeariness = SIM.PLAYER_WEARY;
    expect(PLAYER.suePeace(state, me, war, rng)).toBe(true);
    expect(PLAYER.acceptTerms(state, me, war, rng)).toBe(true);
    state.player!.policies.enemySues = "refuse";
    expect(PLAYER.acceptTerms(state, me, war, rng)).toBe(false);
  });
});

describe("the player's orders", () => {
  it("can only take over a living nation, and keep their policies when changing nation", () => {
    const state = twoNations();
    state.nations.get(2)!.alive = false;
    expect(giveCommand(state, { kind: "play", nation: 2 })).toEqual({ ok: false, reason: "there's no such nation" });
    expect(giveCommand(state, { kind: "declareWar", target: 2, goal: "raid" })).toEqual({ ok: false, reason: "no one is playing a nation" });
    giveCommand(state, { kind: "play", nation: 1 });
    expect(state.player).toMatchObject({ nation: 1, culture: state.nations.get(1)!.culture });
  });

  it("change policies only to allowed answers", () => {
    const state = playing();
    expect(giveCommand(state, { kind: "setPolicy", policies: { joinWar: "never", mobilize: 1 } }).ok).toBe(true);
    expect(state.player!.policies).toMatchObject({ joinWar: "never", mobilize: 1 });
    const bad = { kind: "setPolicy", policies: { wonWar: "conquer the world" } } as unknown as PlayerCommand;
    expect(giveCommand(state, bad).ok).toBe(false);
    expect(giveCommand(state, { kind: "setPolicy", policies: { mobilize: 0 } }).ok).toBe(false);
    expect(state.player!.policies.wonWar).toBe("peace");
  });

  it("declare war by the same rules as everyone, and are logged as the player's", () => {
    const state = playing();
    state.truces.push({ a: 1, b: 2, until: 100 });
    expect(giveCommand(state, { kind: "declareWar", target: 2, goal: "raid" })).toEqual({ ok: false, reason: "there's a truce between them" });
    state.truces = [];
    expect(giveCommand(state, { kind: "declareWar", target: 2, goal: "raid" }).ok).toBe(true);
    expect(state.wars[0]).toMatchObject({ attacker: 1, defender: 2, goal: "raid" });
    expect(state.commands.at(-1)).toEqual({ year: 0, command: { kind: "declareWar", target: 2, goal: "raid" }, by: "player" });
  });

  it("propose alliances the other side may turn down", () => {
    const state = playing();
    state.relations.set(pairKey(1, 2), SIM.ALLIANCE_MIN_OPINION - 0.1);
    const declined = giveCommand(state, { kind: "proposeAlliance", other: 2 });
    expect(declined.ok).toBe(false);
    state.relations.set(pairKey(1, 2), SIM.ALLIANCE_MIN_OPINION + 0.1);
    expect(giveCommand(state, { kind: "proposeAlliance", other: 2 }).ok).toBe(true);
    expect(state.alliances).toHaveLength(1);
    expect(giveCommand(state, { kind: "breakAlliance", other: 2 }).ok).toBe(true);
    expect(state.alliances).toHaveLength(0);
  });

  it("sue for peace only when losing, and adopt only the faith on offer", () => {
    const state = playing();
    const war = startWar(state, state.nations.get(1)!, state.nations.get(2)!, "raid", []);
    expect(giveCommand(state, { kind: "suePeace", war: war.id }).ok).toBe(false); // not losing
    war.score = -SIM.WIN_SCORE;
    state.nations.get(2)!.warWeariness = 1; // the AI then always hears terms
    expect(giveCommand(state, { kind: "suePeace", war: war.id }).ok).toBe(true);
    expect(state.wars).toHaveLength(0);
    expect(giveCommand(state, { kind: "adoptFaith", faith: 3 })).toEqual({ ok: false, reason: "that faith doesn't hold most of the realm" });
  });
});

describe("a played history", () => {
  const SEED = "play-history";
  const fingerprint = (state: WorldState) => state.events.map((e) => e.text).join("\n") + [...state.state.owner].join(",");

  /** Plays the first nation from year 0, with a policy change at 10 and a war order at 15. */
  async function playedHistory(years: number): Promise<WorldState> {
    const { state } = generateWorld(SEED, 320, 180);
    const rng = createRng(SEED).fork("sim");
    const first = [...state.nations.keys()][0]!;
    expect(giveCommand(state, { kind: "play", nation: first }).ok).toBe(true);
    await runYears(years, () => {
      tick(state, rng);
      if (state.year === 10) giveCommand(state, { kind: "setPolicy", policies: { joinWar: "always", mobilize: 1 } });
      if (state.year === 15 && state.nations.get(first)!.alive) {
        // Any neighbor the rules allow: tried in turn, and only an allowed one is logged.
        for (const other of state.nations.values()) if (giveCommand(state, { kind: "declareWar", target: other.id, goal: "raid" }).ok) break;
      }
    });
    return state;
  }

  it("a played nation with its policies plays out 1,000 years, and never picks a fight by itself", async () => {
    const state = await playedHistory(1000);
    const played = state.player!.nation;
    expect(state.year).toBe(1000);
    // Its only wars as attacker: the ordered one and wars on rebels (crushRevolt). Allies' wars fold into the war they joined.
    const own = state.warRecords.filter((r) => r.attacker === played && r.start !== 15);
    expect(own.every((r) => r.goal === "reclaim")).toBe(true);
  }, 120_000);

  it("replays to the same history from the seed, the settings and the log", async () => {
    const original = await playedHistory(60);
    expect(original.commands.filter((c) => c.by === "player").length).toBeGreaterThanOrEqual(2);

    const { state } = generateWorld(SEED, 320, 180);
    const rng = createRng(SEED).fork("sim");
    replayCommands(state, original.commands); // year 0's orders come before the first year
    await runYears(60, () => {
      tick(state, rng);
      replayCommands(state, original.commands);
    });
    expect(fingerprint(state)).toBe(fingerprint(original));
    expect(state.player).toEqual(original.player);
  }, 60_000);

  it("is saved (v13), and a loaded game plays on the same", async () => {
    const original = await playedHistory(30);
    const generated = generateWorld(SEED, 320, 180);
    const loaded = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(original, SIM))), generated.world);
    expect(loaded.player).toEqual(original.player);

    const rngA = createRng(SEED).fork("sim");
    const rngB = createRng(SEED).fork("sim");
    for (let y = 0; y < 20; y++) {
      tick(original, rngA);
      tick(loaded, rngB);
    }
    expect(fingerprint(loaded)).toBe(fingerprint(original));
  }, 60_000);
});
