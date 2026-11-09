// The player's controller (M20, docs/systems/play.md). The rules ask it the same questions
// they ask the AI. Choices a player makes on purpose (war, alliances, faith) come only from
// orders (`sim/play.ts`), so here they are always "no"; questions that come up during a
// year are answered by the policies the player set, with no dice.
import type { Controller, Controllers, View } from "./controller";
import type { Policies, WorldState } from "../../core/types";
import { SIM } from "../params";
import { AI } from "./default";

/** Every allowed answer for each policy, for checking a "setPolicy" order (and, later, the screen's choices). */
export const POLICY_CHOICES = {
  joinWar: ["always", "defending", "kin", "never"],
  acceptAlliance: ["opinion", "always", "never"],
  wonWar: ["peace", "fightOn"],
  suePeace: ["never", "weary"],
  enemySues: ["accept", "weary", "refuse"],
  rebels: ["fight", "letGo"],
} as const satisfies { [K in Exclude<keyof Policies, "mobilize">]: readonly Policies[K][] };

/** The policies a player starts with: as close to the AI's own behavior as fixed answers get. */
export function defaultPolicies(): Policies {
  return { joinWar: "defending", acceptAlliance: "opinion", wonWar: "peace", suePeace: "weary", enemySues: "weary", mobilize: SIM.MOBILIZE_SHARE, rebels: "fight" };
}

/** The played nation's policies (the defaults if no one is playing, which never happens when asked). */
function policies(view: View): Policies {
  return view.player?.policies ?? defaultPolicies();
}

export const PLAYER: Controller = {
  declareWar: () => null, // only by the "declareWar" order
  proposeAlliance: () => false, // only by the "proposeAlliance" order
  keepAlliance: () => true, // only the "breakAlliance" order ends a pact
  adoptFaith: () => false, // only by the "adoptFaith" order
  declareIndependence: () => false, // only by the "declareIndependence" order

  joinWar(view, me, friend, _enemy, side) {
    switch (policies(view).joinWar) {
      case "always":
        return true;
      case "defending":
        return side === "defend";
      case "kin":
        return friend.race === me.race;
      case "never":
        return false;
    }
  },

  acceptAlliance(view, me, other) {
    const policy = policies(view).acceptAlliance;
    if (policy === "opinion") return AI.acceptAlliance(view, me, other);
    return policy === "always";
  },

  acceptPeace(view) {
    return policies(view).wonWar === "peace";
  },

  suePeace(view, me) {
    return policies(view).suePeace === "weary" && me.warWeariness >= SIM.PLAYER_WEARY;
  },

  acceptTerms(view, me) {
    const policy = policies(view).enemySues;
    return policy === "accept" || (policy === "weary" && me.warWeariness >= SIM.PLAYER_WEARY);
  },

  mobilize(view, me, wars) {
    const size = (me.reserve * policies(view).mobilize) / Math.max(1, wars.length);
    return wars.map(() => size);
  },

  orderArmy: AI.orderArmy, // strategy only: armies march as the AI's do
  orderSiege: AI.orderSiege,

  crushRevolt(view) {
    return policies(view).rebels === "fight";
  },
};

/**
 * Who controls each nation in `state`: the player's nation by PLAYER, everyone else by the AI.
 * Reads `state.player` each time it's asked, so it stays right when the player changes nation.
 */
export function controllersOf(state: Readonly<WorldState>): Controllers {
  return (id) => (state.player?.nation === id ? PLAYER : AI);
}
