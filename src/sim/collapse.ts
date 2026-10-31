// Step 8 (SPEC §4.7): nations that lose their capital move it; tiny nations dissolve.
import { Faith, Race, type Nation, type NationId, type SimEvent, type WorldState } from "../core/types";
import { annexedEvent, capitalMovedEvent, collapseEvent } from "./events";
import { cellsByNation, livingNations, setOwner } from "./helpers";
import { SIM } from "./params";
import { bestCapital } from "./newNation";

/**
 * Hands each of the nation's cells to its strongest neighboring nation, or
 * leaves it empty if there's none. Returns the nation that took the most cells.
 */
function dissolve(state: WorldState, nation: Nation, cells: number[]): Nation | null {
  const { owner, pop, race, culture, faith } = state.state;
  const taken = new Map<NationId, number>();
  // Decide using ownership from before the handover, so cells given away a
  // moment ago don't count as "neighbors" (otherwise one absorber chains through everything).
  const before = owner.slice();

  for (const c of cells) {
    let best: Nation | null = null;
    for (const n of state.cells[c]!.neighbors) {
      const other = state.nations.get(before[n]!);
      if (!other || other.id === nation.id || !other.alive) continue;
      if (!best || other.strength > best.strength || (other.strength === best.strength && other.id < best.id)) {
        best = other;
      }
    }
    setOwner(state, c, best ? best.id : 0);
    // Annexed cells keep their people; abandoned cells are emptied.
    if (!best) {
      pop[c] = 0;
      race[c] = Race.None;
      culture[c] = 0;
      faith[c] = Faith.None;
    } else taken.set(best.id, (taken.get(best.id) ?? 0) + 1);
  }

  let winner: Nation | null = null;
  let most = 0;
  for (const [id, count] of taken) {
    if (count > most || (count === most && winner && id < winner.id)) {
      winner = state.nations.get(id)!;
      most = count;
    }
  }
  return winner;
}

export function collapses(state: WorldState): SimEvent[] {
  const events: SimEvent[] = [];
  const groups = cellsByNation(state);

  for (const nation of livingNations(state)) {
    const cells = groups.get(nation.id) ?? [];
    // Cells may have changed hands earlier in this loop, so keep only ones still ours.
    const stillOurs = cells.filter((c) => state.state.owner[c] === nation.id);

    if (stillOurs.length === 0) {
      nation.alive = false;
      nation.fell = state.year;
      events.push(collapseEvent(state.year, nation));
      continue;
    }

    if (state.state.owner[nation.capital] !== nation.id) {
      nation.capital = bestCapital(state, stillOurs);
      nation.stability = Math.max(0, nation.stability - SIM.CAPITAL_LOSS_STAB_HIT);
      events.push(capitalMovedEvent(state.year, nation));
    }

    if (stillOurs.length < SIM.MIN_AREA) {
      const winner = dissolve(state, nation, stillOurs);
      nation.alive = false;
      nation.fell = state.year;
      events.push(winner ? annexedEvent(state.year, nation, winner) : collapseEvent(state.year, nation));
    }
  }
  return events;
}
