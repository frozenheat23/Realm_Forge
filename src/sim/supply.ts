// Small campaign logistics model: a short controlled route, or limited local foraging.
import { Biome, type Army, type CellId, type WorldState } from "../core/types";
import { allied } from "./diplomacy";
import { pairKey, warPairs } from "./helpers";
import { loseSoldiers } from "./manpower";
import { SIM } from "./params";

export interface SupplyStatus {
  connected: boolean;
  /** 0 = fed by a route; up to 1 = no route and no usable local provisions. */
  shortage: number;
  /** Reinforcements need controlled ground as well as a route. */
  reinforce: boolean;
}

/** Occupation overrides legal ownership: enemy-held home ground is not friendly. */
export function friendlyGround(state: WorldState, army: Army, cell: CellId): boolean {
  const holder = state.state.occupier[cell] || state.state.owner[cell]!;
  return holder === army.owner || (holder !== 0 && allied(state, holder, army.owner));
}

/** Search at most SUPPLY_RANGE links back to unoccupied home/allied land. */
export function supplyStatus(state: WorldState, army: Army): SupplyStatus {
  const hostile = warPairs(state);
  const blocked = new Set(state.armies.filter((a) => a.size > 0 && hostile.has(pairKey(army.owner, a.owner))).map((a) => a.cell));
  const source = (cell: CellId) => state.state.occupier[cell] === 0 && friendlyGround(state, army, cell);
  const seen = new Set([army.cell]);
  let ring = blocked.has(army.cell) ? [] : [army.cell];
  let connected = false;
  for (let distance = 0; distance <= SIM.SUPPLY_RANGE && ring.length > 0; distance++) {
    const next: CellId[] = [];
    for (const cell of ring) {
      if (source(cell)) { connected = true; break; }
      for (const n of state.cells[cell]!.neighbors) {
        if (seen.has(n) || blocked.has(n) || !state.cells[n]!.isLand || !friendlyGround(state, army, n)) continue;
        seen.add(n);
        next.push(n);
      }
    }
    if (connected) break;
    ring = next;
  }
  // A larger host exhausts a small or devastated province sooner; foraging never fully feeds it.
  const provisions = state.state.pop[army.cell]! * (1 - state.state.devastation[army.cell]!);
  const forage = SIM.FORAGE_SHARE * Math.min(1, provisions / Math.max(army.size, SIM.MIN_ARMY_SIZE));
  return { connected, shortage: connected ? 0 : 1 - forage, reinforce: connected && friendlyGround(state, army, army.cell) };
}

/** Hunger costs soldiers and morale; rest in unoccupied friendly territory restores morale. */
export function wearDown(state: WorldState, army: Army): void {
  const cell = state.cells[army.cell]!;
  const supply = supplyStatus(state, army);
  if (supply.shortage > 0) {
    const harsh = cell.mountain || cell.biome === Biome.Desert || cell.biome === Biome.Tundra || cell.biome === Biome.Ice;
    const lost = army.size * SIM.ARMY_ATTRITION * supply.shortage * (harsh ? 2 : 1);
    loseSoldiers(state, state.nations.get(army.owner)!, lost, army.war);
    army.morale = Math.max(0, army.morale - SIM.SUPPLY_MORALE_LOSS * supply.shortage);
  } else if (state.state.occupier[army.cell] === 0 && friendlyGround(state, army, army.cell)) {
    army.morale = Math.min(1, army.morale + SIM.MORALE_RECOVERY);
  }
}
