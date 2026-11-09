// Vassals (docs/systems/vassalage.md): who serves whom under one crown.
// A vassal keeps its own land, ruler and army, but serves its overlord. One level only.
import type { Nation, NationId, WorldState } from "../core/types";

/** The living overlord `id` serves, if any. */
export function overlordOf(state: WorldState, id: NationId): Nation | undefined {
  const overlord = state.nations.get(state.nations.get(id)?.overlord ?? 0);
  return overlord?.alive ? overlord : undefined;
}

/** The living vassals of `id`, in id order. */
export function vassalsOf(state: WorldState, id: NationId): Nation[] {
  const found: Nation[] = [];
  for (const nation of state.nations.values()) if (nation.alive && nation.overlord === id) found.push(nation);
  return found.sort((a, b) => a.id - b.id);
}

/** The crown `id` lives under: its overlord's id, or its own if it's independent. */
export function crownOf(state: WorldState, id: NationId): NationId {
  return overlordOf(state, id)?.id ?? id;
}

/** Do two different nations live under the same crown (overlord and vassal, or two vassals of one overlord)? */
export function sameCrown(state: WorldState, a: NationId, b: NationId): boolean {
  return a !== b && crownOf(state, a) === crownOf(state, b);
}

/** Who must fight beside `id`: its overlord and its own vassals (not fellow vassals), in id order. */
export function crownPartners(state: WorldState, id: NationId): NationId[] {
  const overlord = overlordOf(state, id);
  const partners = vassalsOf(state, id).map((n) => n.id);
  if (overlord) partners.push(overlord.id);
  return partners.sort((a, b) => a - b);
}

/**
 * `vassal` submits to `overlord`: its own vassals go free (one level only),
 * and its alliances end, since a vassal makes no pacts of its own.
 */
export function becomeVassal(state: WorldState, vassal: Nation, overlord: Nation): void {
  for (const own of vassalsOf(state, vassal.id)) setFree(own);
  state.alliances = state.alliances.filter((al) => al.a !== vassal.id && al.b !== vassal.id);
  vassal.overlord = overlord.id;
}

/** `vassal` serves no one any more. */
export function setFree(vassal: Nation): void {
  delete vassal.overlord;
}
