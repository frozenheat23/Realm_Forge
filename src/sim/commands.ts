// Commands (M15, docs/systems/controllers.md): a choice a nation has made, as data.
// A controller's answer becomes a command; the rules check it and carry it out.
// Each rule file applies its own commands (`applyDeclareWar` in war.ts, and so on);
// `applyCommand` is the one door for callers outside the yearly steps, such as a
// future sandbox or player.
import type { CellId, FaithId, NationId, SimEvent, War, WarGoal, WorldState } from "../core/types";
import { applyMobilize, applyOrderArmy } from "./armies";
import { applyBreakAlliance, applyFormAlliance } from "./diplomacy";
import { applyAdoptFaith } from "./faith";
import { applyCrushRevolt } from "./rebellion";
import { applyDeclareWar, applyJoinWar } from "./war";

export type Command =
  | { kind: "declareWar"; nation: NationId; target: NationId; goal: WarGoal }
  | { kind: "joinWar"; nation: NationId; war: number; side: "attack" | "defend" }
  | { kind: "formAlliance"; a: NationId; b: NationId }
  | { kind: "breakAlliance"; nation: NationId; other: NationId }
  | { kind: "mobilize"; nation: NationId; war: number; size: number }
  | { kind: "orderArmy"; army: number; target: CellId }
  | { kind: "crushRevolt"; nation: NationId; rebels: NationId }
  | { kind: "adoptFaith"; nation: NationId; faith: FaithId };

/** The command of one kind, e.g. `CommandOf<"mobilize">`. */
export type CommandOf<K extends Command["kind"]> = Extract<Command, { kind: K }>;

/** What happened: done (with any events, and the war it started), or refused and why. */
export type CommandResult = { ok: true; events: SimEvent[]; war?: War } | { ok: false; reason: string };

/** Checks a command against the rules and, if it's allowed, carries it out. */
export function applyCommand(state: WorldState, command: Command): CommandResult {
  switch (command.kind) {
    case "declareWar":
      return applyDeclareWar(state, command);
    case "joinWar":
      return applyJoinWar(state, command);
    case "formAlliance":
      return applyFormAlliance(state, command);
    case "breakAlliance":
      return applyBreakAlliance(state, command);
    case "mobilize":
      return applyMobilize(state, command);
    case "orderArmy":
      return applyOrderArmy(state, command);
    case "crushRevolt":
      return applyCrushRevolt(state, command);
    case "adoptFaith":
      return applyAdoptFaith(state, command);
  }
}
