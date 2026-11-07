// Generals and peace offers (M18 part 3, docs/systems/realwar.md).
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { NO_TARGET, type Army, type BattleReport, type General, type War, type WorldState } from "../src/core/types";
import { AI } from "../src/sim/ai/default";
import type { Controller } from "../src/sim/ai/controller";
import { applyCommand } from "../src/sim/commands";
import { disbandArmies, raiseArmy } from "../src/sim/armies";
import { afterBattle, appointGeneral, generalBonus } from "../src/sim/generals";
import { armyPower } from "../src/sim/manpower";
import { SIM } from "../src/sim/params";
import { endWars, startWar } from "../src/sim/war";
import { makeNation, makeState, row } from "./tinyWorld";

const general = (extra: Partial<General> = {}): General => ({ name: "Arvel", female: false, skill: 1, wins: 0, since: 0, ...extra });

function twoAtWar(): { state: WorldState; war: War } {
  const state = makeState(row(10), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2], [makeNation(1, 0, { reserve: 10 }), makeNation(2, 9, { reserve: 10 })]);
  state.seed = "generals";
  const war: War = startWar(state, state.nations.get(1)!, state.nations.get(2)!, "conquer", [5, 6]);
  return { state, war };
}

const armyOf = (owner: number, g?: General): Army => ({ id: owner, owner, war: 1, cell: owner === 1 ? 4 : 5, size: 5, morale: 1, target: NO_TARGET, path: [], trail: [], ...(g ? { general: g } : {}) });

describe("generals", () => {
  it("a skilled general makes an army stronger, and victories sharpen them", () => {
    const { state } = twoAtWar();
    const plain = armyPower(state, armyOf(1));
    expect(armyPower(state, armyOf(1, general({ skill: 1.2 })))).toBeCloseTo(plain * 1.2);
    expect(generalBonus(general({ wins: 4 }))).toBeCloseTo(1 + 4 * SIM.GENERAL_WIN_BONUS);
    expect(generalBonus(general({ wins: 1000 }))).toBeCloseTo(1 + SIM.GENERAL_MAX_WINS * SIM.GENERAL_WIN_BONUS);
  });

  it("every new army gets a general, rolled once from its own dice", () => {
    const { state, war } = twoAtWar();
    const [a, b] = [state.nations.get(1)!, state.nations.get(2)!];
    raiseArmy(state, a, war, b, 2);
    raiseArmy(state, b, war, a, 2);
    const [g1, g2] = state.armies.map((x) => x.general!) as [General, General];
    expect(g1.name.length).toBeGreaterThan(0);
    expect(Math.abs(Math.log(g1.skill))).toBeLessThanOrEqual(SIM.GENERAL_SPREAD);
    expect(g1).not.toEqual(g2);
    expect(appointGeneral(state, a, state.armies[0]!.id)).toEqual(g1); // same army, same dice
  });

  it("a famous general's renown and death reach the battle report", () => {
    const { state } = twoAtWar();
    const victor = armyOf(1, general({ wins: SIM.GENERAL_FAMOUS - 1 }));
    const beaten = armyOf(2, general({ name: "Mora", wins: SIM.GENERAL_FAMOUS }));
    const report: BattleReport = { cell: 5, winner: 1, loser: 2, lost: 1, routed: false };
    afterBattle(state, victor, beaten, false, report, { ...createRng("x"), chance: () => true });
    expect(victor.general!.wins).toBe(SIM.GENERAL_FAMOUS);
    expect(report.general).toEqual({ name: "Mora", nation: 2, news: "fell" }); // the death is the bigger news
    expect(beaten.general!.name).not.toBe("Mora"); // a new leader takes over at once
  });

  it("a realm keeps its best general between wars to lead the next", () => {
    const { state, war } = twoAtWar();
    const a = state.nations.get(1)!;
    state.armies.push(armyOf(1, general({ name: "Veteran", wins: 7 })));
    state.wars = [];
    disbandArmies(state);
    expect(a.marshal?.name).toBe("Veteran");
    state.wars.push(war);
    raiseArmy(state, a, war, state.nations.get(2)!, 2);
    expect(state.armies[0]!.general!.name).toBe("Veteran");
    expect(a.marshal).toBeUndefined();
  });

  it("an old general retires instead of leading again", () => {
    const { state, war } = twoAtWar();
    const a = state.nations.get(1)!;
    a.marshal = general({ name: "Greybeard", since: 0 });
    state.year = SIM.GENERAL_CAREER;
    raiseArmy(state, a, war, state.nations.get(2)!, 2);
    expect(state.armies[0]!.general!.name).not.toBe("Greybeard");
  });
});

describe("peace offers", () => {
  // The AI, but always suing and always accepting.
  const eager: Controller = { ...AI, suePeace: () => true, acceptTerms: () => true };

  it("a side losing badly can sue, and gives up only the goal land it lost", () => {
    const { state, war } = twoAtWar();
    state.year = 2;
    state.state.occupier[5] = 1; // a goal cell
    state.state.occupier[7] = 1; // not a goal cell: a full victory could take it too
    war.battleScore = SIM.WIN_SCORE * 2;
    const [event] = endWars(state, () => eager);
    expect(state.wars).toHaveLength(0);
    expect(event!.text).toContain("Nation2 sues for peace and cedes 1 province to Nation1");
    expect(state.state.owner[5]).toBe(1);
    expect(state.state.owner[7]).toBe(2);
    expect(state.warRecords[0]!.outcome?.how).toBe("terms");
  });

  it("nobody sues in a close war, or when the winner refuses", () => {
    const { state, war } = twoAtWar();
    state.year = 2;
    state.state.occupier[5] = 1;
    war.battleScore = SIM.WIN_SCORE / 2 - SIM.SCORE_PER_OCCUPIED * SIM.GOAL_SCORE_MULT;
    endWars(state, () => eager);
    expect(state.wars).toHaveLength(1);
    war.battleScore = SIM.WIN_SCORE * 2;
    endWars(state, () => ({ ...eager, acceptTerms: () => false }));
    expect(state.wars).toHaveLength(1);
  });

  it("the AI won't take terms while it holds the loser's capital", () => {
    const { state, war } = twoAtWar();
    state.state.occupier[9] = 1;
    expect(AI.acceptTerms(state, state.nations.get(1)!, war, createRng("t"))).toBe(false);
  });

  it("the command refuses a side that isn't losing", () => {
    const { state, war } = twoAtWar();
    war.score = SIM.WIN_SCORE * 2; // the attacker is winning
    const refused = applyCommand(state, { kind: "suePeace", nation: 1, war: 1 });
    expect(refused.ok).toBe(false);
    expect(applyCommand(state, { kind: "suePeace", nation: 2, war: 1 }).ok).toBe(true);
    expect(state.wars).toHaveLength(0);
  });
});
