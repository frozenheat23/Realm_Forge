// Controllers (M15, docs/systems/controllers.md): who makes each nation's choices.
// The rules ask a nation's controller, and carry out its answer as a command.
// Today every nation has the AI controller (`ai/default.ts`); later a player can
// take one nation's place without the rules changing.
import type { Rng } from "../../core/rng";
import type { Army, CellId, FaithId, Nation, NationId, SimEvent, War, WarGoal, WorldState } from "../../core/types";
import type { Command, CommandResult } from "../commands";

/** The world as a controller sees it. A controller must never change it. */
export type View = Readonly<WorldState>;

/** What a nation weighs when deciding whether to go to war. Worked out by the rules. */
export interface WarContext {
  /** It lost land to the target recently, and could fight to take it back. */
  claim: boolean;
  /** The target's most valuable cell on their shared border, as this nation's race sees it. */
  prize?: { cell: CellId; value: number };
  /** Allies who could join on this nation's side, and on the target's. */
  myHelpers: Nation[];
  theirHelpers: Nation[];
}

/** What an army's controller needs to give it orders, worked out by the rules. */
export interface ArmyOrders {
  war: War;
  enemy: Nation;
  /** The war an ally joined, if this army's war is a joined one. */
  main: War | undefined;
  /** Pair keys of nations at war with each other. */
  hostile: Set<number>;
  /** Occupied land, by owner. */
  held: Map<NationId, CellId[]>;
  /** Each nation's grain bonus (index = nation id). */
  grain: Float64Array;
  /** Season of the year, from 0. */
  season: number;
  /** Can the army get to `cell`? Finds (and remembers) the way, changing nothing. */
  reach(cell: CellId): boolean;
}

/** Why a war could end now by agreement (forced endings aren't asked). */
export type PeaceReason = "goal" | "decisive";

/** One function per choice a nation makes. Each answers at once, from the view and its own dice. */
export interface Controller {
  /** Go to war with `target`? The goal to fight for, or null to stay at peace. */
  declareWar(view: View, me: Nation, target: Nation, why: WarContext, rng: Rng): WarGoal | null;
  /** Join an ally's war, on the `side` the ally is on? */
  joinWar(view: View, me: Nation, friend: Nation, enemy: Nation, side: "attack" | "defend", rng: Rng): boolean;
  /** Offer `other` an alliance? */
  proposeAlliance(view: View, me: Nation, other: Nation, rng: Rng): boolean;
  /** Accept an alliance `other` offers? */
  acceptAlliance(view: View, me: Nation, other: Nation): boolean;
  /** Stay allied with `other` another year? `idleYears` = years since they last fought a shared enemy. */
  keepAlliance(view: View, me: Nation, other: Nation, idleYears: number, rng: Rng): boolean;
  /** End `war` now? Asked of the side that's winning. */
  acceptPeace(view: View, me: Nation, war: War, reason: PeaceReason): boolean;
  /** Sue for peace in `war`? Asked each year of a side losing by SIM.WIN_SCORE or more (M18). */
  suePeace(view: View, me: Nation, war: War, rng: Rng): boolean;
  /** Accept the losing side's offer: end `war` now, taking only the goal land it holds? */
  acceptTerms(view: View, me: Nation, war: War, rng: Rng): boolean;
  /** Soldiers to raise for each of `wars` (wars this nation has no army in yet). */
  mobilize(view: View, me: Nation, wars: War[]): number[];
  /** Where `army` should go this season. Its scouting dice are stable across this year's seasons. */
  orderArmy(view: View, army: Army, orders: ArmyOrders, rng: Rng): CellId;
  /** How to approach a siege at the chosen destination this season. */
  orderSiege(view: View, army: Army, target: CellId, rng: Rng): "wait" | "assault";
  /** Go to war to crush `rebels`, who just broke away? */
  crushRevolt(view: View, me: Nation, rebels: Nation, rng: Rng): boolean;
  /** Declare independence from `overlord`, whose new ruler was crowned this year (docs/systems/vassalage.md)? */
  declareIndependence(view: View, me: Nation, overlord: Nation, rng: Rng): boolean;
  /** Adopt `faith`, now that most of the realm holds it? */
  adoptFaith(view: View, me: Nation, faith: FaithId, rng: Rng): boolean;
  /** Told when the rules turn down one of its commands, and why. */
  refused?(command: Command, reason: string): void;
}

/** Who controls each nation. Passed into `tick`; not part of the saved world. */
export type Controllers = (id: NationId) => Controller;

// Small helpers for the rule files that apply commands. They live here, not in
// commands.ts, because commands.ts imports every rule file.

/** The command was carried out. */
export const done = (events: SimEvent[] = [], war?: War): CommandResult => (war ? { ok: true, events, war } : { ok: true, events });
/** The rules turned the command down. */
export const refuse = (reason: string): CommandResult => ({ ok: false, reason });

/** Tells the controller if its command was refused. True if it was carried out. */
export function carryOut(controller: Controller, command: Command, result: CommandResult): result is CommandResult & { ok: true } {
  if (!result.ok) controller.refused?.(command, result.reason);
  return result.ok;
}
