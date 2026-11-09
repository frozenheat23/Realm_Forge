// Dispatches (M20, docs/systems/play.md): what happened to the played realm this year, worth
// pausing for. Worked out from the year's events and from comparing the realm before and after
// the year. Only reads the world; no page code, so tests can check it.
import type { FaithId, NationId, Policies, SimEvent, WorldState } from "../core/types";
import { faithInfo } from "../gen/faiths";
import { battlePlace } from "../sim/battle";
import { alliesOf } from "../sim/diplomacy";
import { menText } from "../sim/events";
import { offeredFaith } from "../sim/faith";
import { overlordOf } from "../sim/vassals";

/** The kinds of dispatch, each of which the player can switch off. */
export const DISPATCH_KINDS = ["war", "battle", "peace", "ruler", "heir", "revolt", "alliance", "vassal", "faith", "fall"] as const;
export type DispatchKind = (typeof DISPATCH_KINDS)[number];

export const DISPATCH_NAMES: Record<DispatchKind, string> = {
  war: "Wars declared on you or your allies",
  battle: "Your first rout in a war, capital besieged or taken",
  peace: "Your wars ending",
  ruler: "Great rulers rising and dying, crises, civil war",
  heir: "Every new ruler",
  revolt: "Revolts breaking away",
  alliance: "Alliances made or broken",
  vassal: "Submitting, vassals, a chance to break free",
  faith: "A faith on offer, the Old Gods",
  fall: "Your realm falling",
};

/** Kinds that don't pause until switched on: they come too often (a new ruler every ~25 years). */
export const DISPATCH_DEFAULT_OFF: readonly DispatchKind[] = ["heir"];

export interface Dispatch {
  kind: DispatchKind;
  text: string;
}

/** What is compared from one year to the next for the played realm. */
export interface RealmWatch {
  nation: NationId;
  alive: boolean;
  /** The ruler's name and year crowned: a change means a new ruler. */
  ruler: string;
  besieged: boolean;
  capitalTaken: boolean;
  faithOffered: FaithId | null;
}

/** The played realm as it is now, to compare with after the next year. Null if no one plays. */
export function watchRealm(state: WorldState): RealmWatch | null {
  const nation = state.player ? state.nations.get(state.player.nation) : undefined;
  if (!nation) return null;
  const { siege, occupier } = state.state;
  return {
    nation: nation.id,
    alive: nation.alive,
    ruler: `${nation.ruler.name}/${nation.ruler.crowned}`,
    besieged: nation.alive && siege[nation.capital]! > 0,
    capitalTaken: nation.alive && occupier[nation.capital]! !== 0,
    faithOffered: nation.alive ? offeredFaith(state, nation) : null,
  };
}

/** How the "Join allies' wars" policy reads in a sentence. */
const JOIN_WORDS: Record<Policies["joinWar"], string> = {
  always: "always join",
  defending: "join only when an ally is attacked",
  kin: "join only allies of your own race",
  never: "never join",
};

/** An event's text as a sentence on its own: without "Year 412: ", capitalized. */
const sentence = (text: string) => capitalize(text.replace(/^Year -?\d+: /, ""));

/**
 * The dispatches for the year just played: `events` are its events, `before` the realm as it
 * was at the start of the year (from `watchRealm`).
 */
export function dispatchesFor(state: WorldState, events: SimEvent[], before: RealmWatch | null): Dispatch[] {
  if (!before || state.player?.nation !== before.nation) return [];
  const me = state.nations.get(before.nation)!;
  const now = watchRealm(state)!;
  const name = (id: NationId) => state.nations.get(id)?.name ?? "?";
  const out: Dispatch[] = [];
  const add = (kind: DispatchKind, text: string) => out.push({ kind, text });
  const allies = new Set(alliesOf(state, me.id));

  for (const event of events) {
    const mine = event.actors.includes(me.id);
    switch (event.type) {
      case "war": {
        const [first, second, third] = event.actors;
        if (third === undefined) {
          // A declaration: on you, or on an ally (did you go?).
          if (second === me.id) add("war", sentence(event.text));
          else if (second !== undefined && allies.has(second)) {
            const went = events.some((e) => e.type === "war" && e.actors[0] === me.id && e.actors[2] === second);
            if (!went) add("war", `${sentence(event.text)} You stayed out: your policy is to ${JOIN_WORDS[state.player!.policies.joinWar]}, and only allies who can reach the war are called.`);
          }
        } else if (first === me.id) {
          add("war", `${sentence(event.text)} Your policy is to ${JOIN_WORDS[state.player!.policies.joinWar]}.`);
        } else if (mine) {
          add("war", sentence(event.text)); // an ally of your enemy joins against you
        }
        break;
      }
      case "peace":
        if (mine) add("peace", sentence(event.text));
        break;
      case "ruler":
        if (event.actors[0] === me.id) add("ruler", sentence(event.text));
        break;
      case "rebellion":
        if (event.actors[1] === me.id) add("revolt", sentence(event.text));
        break;
      case "alliance":
      case "alliance_ended":
        if (mine) add("alliance", sentence(event.text));
        break;
      case "vassal":
        if (mine) add("vassal", sentence(event.text));
        break;
      case "faith":
        // Your own conversions come from your orders; the Old Gods stirring doesn't.
        if (mine && event.text.includes("Old Gods")) add("faith", sentence(event.text));
        break;
      case "collapse":
      case "annexed":
        if (event.actors[0] === me.id) add("fall", sentence(event.text));
        break;
    }
  }

  // Your first rout in each war (later ones are in the War Room, or every long war would pause each year).
  const routedBefore = (battle: { cell: number; winner: NationId }) =>
    state.warRecords.some(
      (r) =>
        r.battles.some((b) => b.year === state.year && b.cell === battle.cell && b.loser === me.id) &&
        r.battles.some((b) => b.year < state.year && b.loser === me.id && b.routed),
    );
  const told = new Set<NationId>();
  for (const battle of state.battles) {
    if (battle.loser !== me.id || !battle.routed || told.has(battle.winner) || routedBefore(battle)) continue;
    told.add(battle.winner);
    add("battle", `${capitalize(battlePlace(state, battle.cell))}, ${name(battle.winner)} routs your host (${menText(battle.lost)} fell). Later routs in this war won't pause the game.`);
  }

  if (now.alive) {
    const capital = state.cityNames.get(me.capital) ?? "your capital";
    if (now.capitalTaken && !before.capitalTaken) add("battle", `The enemy takes ${capital}, the seat of ${me.name}.`);
    else if (now.besieged && !before.besieged) add("battle", `${capitalize(capital)} is besieged.`);
    // A new ruler not named by any event this year (an ordinary reign ending, or a great one's death).
    if (now.ruler !== before.ruler && !out.some((d) => d.kind === "ruler" && d.text.includes(me.ruler.name))) add(out.some((d) => d.kind === "ruler") ? "ruler" : "heir", `A new ruler takes the throne of ${me.name}: ${me.ruler.name} of ${me.ruler.dynasty}.`);
    const overlord = overlordOf(state, me.id);
    if (overlord && overlord.ruler.crowned === state.year && !state.wars.some((w) => w.goal === "independence" && w.attacker === me.id)) {
      add("vassal", `A new ruler takes the throne of ${overlord.name}, your overlord. You may declare independence under Orders, this year only.`);
    }
    if (now.faithOffered !== null && now.faithOffered !== before.faithOffered) {
      add("faith", `Most of your people now hold ${faithInfo(now.faithOffered).name}. You can adopt it under Orders.`);
    }
  }
  if (before.alive && !now.alive && !out.some((d) => d.kind === "fall")) add("fall", `${me.name} has fallen.`);
  return out;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
