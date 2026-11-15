// Tidy borders (SPEC §4.17): pockets and straightened lines.
import { afterEach, describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import type { CellId, WorldState } from "../src/core/types";
import { absorbPockets, landPieces, pockets, settleBorder } from "../src/sim/borders";
import { setOwner } from "../src/sim/helpers";
import { SIM, SIM_DEFAULTS } from "../src/sim/params";
import { createWorld } from "../src/sim/start";
import { tick } from "../src/sim/tick";
import { runYears } from "./longRun";

afterEach(() => Object.assign(SIM, SIM_DEFAULTS));

/** A small settled world and two of its realms that share a border. */
function twoNeighbors(): { state: WorldState; a: number; b: number } {
  const { state } = createWorld("borders", undefined, 800, 450);
  const owner = state.state.owner;
  for (const cell of state.cells) {
    const a = owner[cell.id]!;
    if (a === 0) continue;
    const other = cell.neighbors.map((n) => owner[n]!).find((o) => o !== 0 && o !== a);
    if (other) return { state, a, b: other };
  }
  throw new Error("no two realms touch");
}

/** A cell deep inside `id`'s land: every neighbor is also `id`'s, and it isn't the capital. */
function innerCell(state: WorldState, id: number): CellId {
  const owner = state.state.owner;
  const capital = state.nations.get(id)!.capital;
  const cell = state.cells.find((c) => owner[c.id] === id && c.id !== capital && !c.neighbors.includes(capital) && c.neighbors.every((n) => owner[n] === id));
  if (!cell) throw new Error("no inner cell");
  return cell.id;
}

describe("tidy borders", () => {
  it("starts with every realm in one piece", () => {
    const { state } = twoNeighbors();
    expect(pockets(state, landPieces(state))).toEqual([]);
  });

  it("gives a long-held pocket to the realm around it", () => {
    const { state, a, b } = twoNeighbors();
    const cell = innerCell(state, a);
    setOwner(state, cell, b);
    expect(pockets(state, landPieces(state))).toHaveLength(1);

    // Too fresh: nothing happens yet.
    expect(absorbPockets(state)).toBe(0);
    state.year += SIM.POCKET_YEARS;
    expect(absorbPockets(state)).toBe(1);
    expect(state.state.owner[cell]).toBe(a);
  });

  it("leaves pockets alone while the two realms are at war", () => {
    const { state, a, b } = twoNeighbors();
    const cell = innerCell(state, a);
    setOwner(state, cell, b);
    state.year += SIM.POCKET_YEARS;
    state.wars.push({ ...state.wars[0]!, attacker: a, defender: b });
    expect(absorbPockets(state)).toBe(0);
    expect(state.state.owner[cell]).toBe(b);
  });

  it("leaves big pockets alone", () => {
    const { state, a, b } = twoNeighbors();
    const cell = innerCell(state, a);
    setOwner(state, cell, b);
    state.year += SIM.POCKET_YEARS;
    SIM.POCKET_MAX_CELLS = 0;
    expect(absorbPockets(state)).toBe(0);
  });

  it("straightens the line at peace and never moves a capital", () => {
    const { state, a, b } = twoNeighbors();
    const cell = innerCell(state, a);
    setOwner(state, cell, b);
    const nationA = state.nations.get(a)!;
    const nationB = state.nations.get(b)!;
    expect(settleBorder(state, nationA, nationB)).toBeGreaterThan(0);
    expect(state.state.owner[cell]).toBe(a);
    expect(state.state.owner[nationA.capital]).toBe(a);
    expect(state.state.owner[nationB.capital]).toBe(b);
  });

  it("keeps a long history nearly free of small pockets", async () => {
    const { state } = createWorld("borders-long", undefined, 800, 450);
    const rng = createRng("borders-long").fork("sim");
    await runYears(300, () => tick(state, rng));
    const small = pockets(state, landPieces(state)).filter((p) => p.cells.length <= 3);
    expect(small.length).toBeLessThan(10);
  });
});
