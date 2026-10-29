// Control (SPEC §4.2): how firm a grip each nation has on each of its cells.
// Worked out fresh every year from travel cost to the capital, never stored.
import type { WorldState } from "../core/types";
import { MinHeap } from "../gen/rivers";
import { traits } from "../gen/races";
import { moveCost } from "./helpers";
import { SIM } from "./params";

/**
 * Control 0..1 for every cell (0 for unowned land and water).
 * Travel cost from the capital, walking only through the nation's own land and
 * paying each cell's move cost for its ruling race, becomes
 * control = exp(−cost / (CONTROL_RANGE × cohesion)). So mountains and marshes,
 * not just distance, decide where an empire frays. Cells the capital can't
 * reach over its own land (e.g. islands) get CONTROL_ISLAND.
 */
export function controlMap(state: WorldState): Float32Array {
  const { cells } = state;
  const owner = state.state.owner;
  const cost = new Float64Array(cells.length).fill(Infinity);
  const heap = new MinHeap();

  // Every capital starts at cost 0. Nations never share cells, so one search covers them all.
  for (const nation of state.nations.values()) {
    if (!nation.alive || owner[nation.capital] !== nation.id) continue;
    cost[nation.capital] = 0;
    heap.push(nation.capital, 0);
  }
  while (heap.size > 0) {
    const c = heap.pop();
    const ruler = state.nations.get(owner[c]!)!;
    for (const n of cells[c]!.neighbors) {
      if (owner[n] !== owner[c]) continue;
      const next = cost[c]! + moveCost(cells[n]!, ruler.race);
      if (next < cost[n]!) {
        cost[n] = next;
        heap.push(n, next);
      }
    }
  }

  const control = new Float32Array(cells.length);
  for (let c = 0; c < cells.length; c++) {
    const nation = state.nations.get(owner[c]!);
    if (!nation) continue;
    control[c] =
      cost[c] === Infinity ? SIM.CONTROL_ISLAND : Math.exp(-cost[c]! / (SIM.CONTROL_RANGE * traits(nation.race).cohesion));
  }
  return control;
}
