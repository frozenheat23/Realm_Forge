// The player's orders (M20, docs/systems/play.md): given between years, checked by the
// same rules as every nation's commands, and logged like the sandbox's god commands
// (`giveCommand` in sandbox.ts), so a replay gives the same history.
import type { Rng } from "../core/rng";
import type { Nation, NationId, Policies, PlayerCommand, WorldState } from "../core/types";
import { carryOut, done, refuse, type Controllers } from "./ai/controller";
import { defaultPolicies, POLICY_CHOICES } from "./ai/player";
import type { CommandOf, CommandResult } from "./commands";
import { allianceRefusal, applyBreakAlliance, applyFormAlliance } from "./diplomacy";
import { applyAdoptFaith, offeredFaith } from "./faith";
import { livingNations } from "./helpers";
import { applyDeclareWar, applySuePeace, callAllies, declareWarRefusal, helpers, suePeaceRefusal, warLookups, winningSide } from "./war";

/** The player order of one kind, e.g. `OrderOf<"declareWar">`. */
type OrderOf<K extends PlayerCommand["kind"]> = Extract<PlayerCommand, { kind: K }>;

/** "play": take over a living nation, keeping any policies already set; or stop playing. */
function applyPlay(state: WorldState, cmd: OrderOf<"play">): CommandResult {
  if (cmd.nation === null) {
    delete state.player;
    return done();
  }
  const nation = state.nations.get(cmd.nation);
  if (!nation?.alive) return refuse("there's no such nation");
  state.player = { nation: nation.id, culture: nation.culture, policies: state.player?.policies ?? defaultPolicies() };
  return done();
}

/** Why `value` isn't an allowed answer for `policy`, or null if it is. */
function policyRefusal(policy: string, value: unknown): string | null {
  if (policy === "mobilize") return typeof value === "number" && value > 0 && value <= 1 ? null : "soldiers raised must be a share of the reserve, above 0 and at most 1";
  const choices = (POLICY_CHOICES as Record<string, readonly string[]>)[policy];
  if (!choices) return `there's no policy "${policy}"`;
  return choices.includes(value as string) ? null : `"${String(value)}" isn't a choice for ${policy}`;
}

/** "setPolicy": change one or more policies. All must be allowed, or none change. */
function applySetPolicy(state: WorldState, cmd: OrderOf<"setPolicy">): CommandResult {
  const player = state.player!;
  for (const [policy, value] of Object.entries(cmd.policies)) {
    const why = policyRefusal(policy, value);
    if (why !== null) return refuse(why);
  }
  player.policies = { ...player.policies, ...cmd.policies } as Policies;
  return done();
}

/** "declareWar": as when the AI declares, the rules check it, then allies of both sides are asked to join. */
function applyPlayerWar(state: WorldState, me: Nation, cmd: OrderOf<"declareWar">, rng: Rng, controllers: Controllers): CommandResult {
  const lookups = warLookups(state);
  // Allies are found before the war begins, as for any declaration.
  const myHelpers = helpers(state, lookups, me.id, cmd.target);
  const theirHelpers = helpers(state, lookups, cmd.target, me.id);
  const declared = applyDeclareWar(state, { kind: "declareWar", nation: me.id, target: cmd.target, goal: cmd.goal }, lookups);
  if (!declared.ok) return declared;
  const events = [...declared.events, ...callAllies(state, lookups, declared.war!, myHelpers, theirHelpers, rng, controllers)];
  return done(events, declared.war);
}

/**
 * Who the player may carry on as when their realm has fallen (docs/systems/play.md): the living
 * realms of their people (culture); if none, of their race; if none, nobody. Largest first.
 */
export function heirsOf(state: WorldState): { by: "people" | "race" | "none"; nations: Nation[] } {
  const player = state.player;
  const played = player ? state.nations.get(player.nation) : undefined;
  if (!player || !played) return { by: "none", nations: [] };
  const area = new Map<NationId, number>();
  for (const owner of state.state.owner) if (owner !== 0) area.set(owner, (area.get(owner) ?? 0) + 1);
  const living = livingNations(state)
    .filter((n) => n.id !== played.id)
    .sort((a, b) => (area.get(b.id) ?? 0) - (area.get(a.id) ?? 0));
  const people = living.filter((n) => n.culture === player.culture);
  if (people.length > 0) return { by: "people", nations: people };
  const race = living.filter((n) => n.race === played.race);
  if (race.length > 0) return { by: "race", nations: race };
  return { by: "none", nations: [] };
}

/** The goals a player's war may have. */
export const WAR_GOALS = ["conquer", "reclaim", "raid"] as const;

/**
 * For the Play tab: why the played nation couldn't go to war on `target` with each goal, or null
 * where it could. The same check the "declareWar" order makes, without changing anything.
 */
export function playerWarRefusals(state: WorldState, target: NationId): Record<(typeof WAR_GOALS)[number], string | null> {
  const me = state.player?.nation ?? 0;
  const lookups = warLookups(state);
  const why = (goal: (typeof WAR_GOALS)[number]) => declareWarRefusal(state, { kind: "declareWar", nation: me, target, goal }, lookups);
  return { conquer: why("conquer"), reclaim: why("reclaim"), raid: why("raid") };
}

/** "suePeace": the player offers terms in a war they're losing; the winner's controller decides at once. */
function applyPlayerSue(state: WorldState, me: Nation, cmd: OrderOf<"suePeace">, rng: Rng, controllers: Controllers): CommandResult {
  const why = suePeaceRefusal(state, cmd.war, me.id);
  if (why !== null) return refuse(why);
  const war = state.wars.find((w) => w.id === cmd.war)!;
  const winner = winningSide(state, cmd.war)!;
  if (!controllers(winner.id).acceptTerms(state, winner, war, rng.fork(`terms-${war.id}`))) return refuse(`${winner.name} won't hear of peace`);
  return applySuePeace(state, { kind: "suePeace", nation: me.id, war: cmd.war });
}

/** "proposeAlliance": the other side's controller decides at once whether to accept. */
function applyPlayerAlliance(state: WorldState, me: Nation, cmd: OrderOf<"proposeAlliance">, controllers: Controllers): CommandResult {
  const why = allianceRefusal(state, me.id, cmd.other);
  if (why !== null) return refuse(why);
  const other = state.nations.get(cmd.other)!;
  const otherController = controllers(other.id);
  if (!otherController.acceptAlliance(state, other, me)) return refuse(`${other.name} turns the offer down`);
  const form: CommandOf<"formAlliance"> = { kind: "formAlliance", a: me.id, b: other.id };
  const result = applyFormAlliance(state, form);
  carryOut(otherController, form, result);
  return result;
}

/** "adoptFaith": only the faith most of the realm holds, while it's on offer. */
function applyPlayerFaith(state: WorldState, me: Nation, cmd: OrderOf<"adoptFaith">): CommandResult {
  if (offeredFaith(state, me) !== cmd.faith) return refuse("that faith doesn't hold most of the realm");
  return applyAdoptFaith(state, { kind: "adoptFaith", nation: me.id, faith: cmd.faith });
}

/**
 * Checks a player order against the rules and, if it's allowed, carries it out for the played nation.
 * `rng` is for others' answers (allies joining, the enemy hearing terms).
 */
export function applyPlayerCommand(state: WorldState, cmd: PlayerCommand, rng: Rng, controllers: Controllers): CommandResult {
  if (cmd.kind === "play") return applyPlay(state, cmd);
  const me = state.player ? state.nations.get(state.player.nation) : undefined;
  if (!me) return refuse("no one is playing a nation");
  if (cmd.kind === "setPolicy") return applySetPolicy(state, cmd);
  if (!me.alive) return refuse("your realm has fallen");
  switch (cmd.kind) {
    case "declareWar":
      return applyPlayerWar(state, me, cmd, rng, controllers);
    case "suePeace":
      return applyPlayerSue(state, me, cmd, rng, controllers);
    case "proposeAlliance":
      return applyPlayerAlliance(state, me, cmd, controllers);
    case "breakAlliance":
      return applyBreakAlliance(state, { kind: "breakAlliance", nation: me.id, other: cmd.other });
    case "adoptFaith":
      return applyPlayerFaith(state, me, cmd);
  }
}
