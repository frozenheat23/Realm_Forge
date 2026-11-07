// The sandbox's god commands (M17, docs/systems/sandbox.md): changes you make to history.
// Like every command they go through the rules here; the screen never changes the world itself.
// Every one given is logged, so history = seed + settings + the command log.
// The player's orders (M20, play.ts) go through the same log.
import { createRng, type Rng } from "../core/rng";
import type { GodCommand, LoggedCommand, NationId, PlayerCommand, SimEvent, WorldState } from "../core/types";
import { done, refuse, type Controllers } from "./ai/controller";
import { controllersOf } from "./ai/player";
import type { CommandResult } from "./commands";
import { applyPlayerCommand } from "./play";
import { pairKey } from "./helpers";
import { applyDeclareWar, atWar, callAllies, clearWinnerOf, concludeWar, directedKey, helpers, warLookups } from "./war";

/** The god command of one kind, e.g. `GodOf<"godWar">`. */
type GodOf<K extends GodCommand["kind"]> = Extract<GodCommand, { kind: K }>;

/** Retells an event as the gods' doing: "Year 412: by the will of the gods, …". Names keep their capitals. */
function byTheGods(event: SimEvent, phrase: string): SimEvent {
  const rest = event.text.replace(/^Year -?\d+: /, "");
  return { ...event, text: `Year ${event.year}: ${phrase}${rest}` };
}

/** The goals a god war may have. */
export const GOD_GOALS = ["conquer", "reclaim", "raid"] as const;

/**
 * For the Sandbox tab: why `nation` couldn't go to war on `target` with each goal,
 * or null where it could. The same checks `applyGodWar` makes, without changing anything.
 */
export function godWarRefusals(state: WorldState, nation: NationId, target: NationId): Record<(typeof GOD_GOALS)[number], string | null> {
  const lookups = warLookups(state);
  let both: string | null = null;
  const me = state.nations.get(nation);
  const them = state.nations.get(target);
  if (!me?.alive || !them?.alive || me === them) both = "there's no such pair of nations";
  else if (!lookups.touching.has(pairKey(nation, target))) both = "they don't share a border";
  else if (atWar(state, nation, target)) both = "they're already at war";
  return {
    conquer: both ?? (lookups.prizes.has(directedKey(nation, target)) ? null : "there's nothing to conquer"),
    reclaim: both ?? (lookups.claims.has(directedKey(nation, target)) ? null : "there's no claim to reclaim"),
    raid: both,
  };
}

/** "godWar": a war the gods start. They may break truces, the war limit and alliances, not geography. */
function applyGodWar(state: WorldState, cmd: GodOf<"godWar">, rng: Rng, controllers: Controllers): CommandResult {
  const me = state.nations.get(cmd.nation);
  const them = state.nations.get(cmd.target);
  if (!me?.alive || !them?.alive || me === them) return refuse("there's no such pair of nations");
  const lookups = warLookups(state);
  if (!lookups.touching.has(pairKey(me.id, them.id))) return refuse("they don't share a border");
  if (atWar(state, me.id, them.id)) return refuse("they're already at war");

  // Allies are found before the old ties are cut, as for any declaration.
  const myHelpers = helpers(state, lookups, me.id, them.id);
  const theirHelpers = helpers(state, lookups, them.id, me.id);
  const key = pairKey(me.id, them.id);
  const truces = state.truces;
  const alliances = state.alliances;
  state.truces = truces.filter((t) => pairKey(t.a, t.b) !== key);
  state.alliances = alliances.filter((al) => pairKey(al.a, al.b) !== key);

  const declared = applyDeclareWar(state, { kind: "declareWar", nation: me.id, target: them.id, goal: cmd.goal }, lookups, true);
  if (!declared.ok) {
    // Refused (no claim, nothing to conquer): leave the truce and alliance as they were.
    state.truces = truces;
    state.alliances = alliances;
    return declared;
  }
  const events = [byTheGods(declared.events[0]!, "by the will of the gods, ")];
  events.push(...callAllies(state, lookups, declared.war!, myHelpers, theirHelpers, rng, controllers));
  return done(events, declared.war);
}

/** "godPeace": the gods end a war now, with the winner they choose (or none). Allies' wars end with it. */
function applyGodPeace(state: WorldState, cmd: GodOf<"godPeace">): CommandResult {
  const war = state.wars.find((w) => w.id === cmd.war && w.joined === undefined);
  if (!war) return refuse("there's no such war going on");
  if (cmd.winner !== null && cmd.winner !== war.attacker && cmd.winner !== war.defender) return refuse("the winner must be one of the two sides");
  const winner = cmd.winner === null ? null : state.nations.get(cmd.winner)!;

  const event = concludeWar(state, war, winner, "imposed", false)!;
  // Allies' wars end quietly, each settled by its own score, as when a war ends by itself.
  const joined = state.wars.filter((w) => w.joined === war.id);
  for (const j of joined) concludeWar(state, j, clearWinnerOf(state, j), "imposed", true);
  state.wars = state.wars.filter((w) => w !== war && !joined.includes(w));
  return done([byTheGods(event, "the gods impose peace: ")]);
}

/** Checks a god command against the rules and, if it's allowed, carries it out. `rng` is for allies' choices. */
export function applyGodCommand(state: WorldState, cmd: GodCommand, rng: Rng, controllers: Controllers): CommandResult {
  switch (cmd.kind) {
    case "godWar":
      return applyGodWar(state, cmd, rng, controllers);
    case "godPeace":
      return applyGodPeace(state, cmd);
  }
}

/** Is this a god command (rather than a player's order)? */
function isGod(command: GodCommand | PlayerCommand): command is GodCommand {
  return command.kind === "godWar" || command.kind === "godPeace";
}

/** The dice for the `index`-th command of `year`: named, so a replay rolls the same. */
function commandRng(state: WorldState, command: GodCommand | PlayerCommand, index: number): Rng {
  return createRng(state.seed).fork("sim").fork(`${isGod(command) ? "god" : "player"}-${state.year}-${index}`);
}

/**
 * Gives a god command or a player's order now, between years: carries it out, logs it
 * and adds its events to the history. Returns the result, so a refusal's reason can be shown.
 */
export function giveCommand(state: WorldState, command: GodCommand | PlayerCommand, controllers: Controllers = controllersOf(state)): CommandResult {
  const index = state.commands.filter((c) => c.year === state.year).length;
  const rng = commandRng(state, command, index);
  const result = isGod(command) ? applyGodCommand(state, command, rng, controllers) : applyPlayerCommand(state, command, rng, controllers);
  if (!result.ok) return result;
  state.commands.push(isGod(command) ? { year: state.year, command } : { year: state.year, command, by: "player" });
  state.events.push(...result.events);
  return result;
}

/**
 * For replaying a history: carries out the logged commands given in the current year,
 * as they were the first time. Call after each year's tick.
 */
export function replayCommands(state: WorldState, log: LoggedCommand[], controllers: Controllers = controllersOf(state)): void {
  for (const entry of log) if (entry.year === state.year) giveCommand(state, entry.command, controllers);
}
