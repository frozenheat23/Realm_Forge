// Tidy borders (SPEC §4.17): peace straightens the line between two realms, and small
// pockets of land cut off from their realm join the realm around them.
// These are rules, not choices, so no controller is asked.
import type { CellId, Nation, NationId, WorldState } from "../core/types";
import { pairKey, setOwner, warPairs } from "./helpers";
import { SIM } from "./params";

/** One connected piece of a realm's land. */
export interface Piece {
  owner: NationId;
  cells: CellId[];
}

/** Every connected piece of owned land. `only` limits the search to these realms. */
export function landPieces(state: WorldState, only?: Set<NationId>): Piece[] {
  const { cells } = state;
  const owner = state.state.owner;
  const seen = new Uint8Array(cells.length);
  const pieces: Piece[] = [];
  for (let start = 0; start < cells.length; start++) {
    const id = owner[start]!;
    if (id === 0 || seen[start] || (only && !only.has(id))) continue;
    // Flood fill: keep stepping to neighbors with the same owner until none are left.
    const piece: CellId[] = [];
    const todo = [start];
    seen[start] = 1;
    while (todo.length > 0) {
      const c = todo.pop()!;
      piece.push(c);
      for (const n of cells[c]!.neighbors) {
        if (seen[n] || owner[n] !== id) continue;
        seen[n] = 1;
        todo.push(n);
      }
    }
    pieces.push({ owner: id, cells: piece });
  }
  return pieces;
}

/**
 * The pieces that are not their realm's main body. The main body is the piece
 * with the capital, or the biggest piece if the capital is in someone else's hands.
 */
export function pockets(state: WorldState, pieces: Piece[]): Piece[] {
  const main = new Map<NationId, Piece>();
  for (const piece of pieces) {
    const nation = state.nations.get(piece.owner);
    if (!nation) continue;
    const best = main.get(piece.owner);
    const hasCapital = piece.cells.includes(nation.capital);
    const bestHasCapital = best !== undefined && best.cells.includes(nation.capital);
    if (!best || hasCapital || (!bestHasCapital && piece.cells.length > best.cells.length)) main.set(piece.owner, piece);
  }
  return pieces.filter((piece) => main.get(piece.owner) !== piece);
}

/** The living realm with the most cells touching this piece from outside, or 0 if none does. */
export function realmAround(state: WorldState, piece: Piece): NationId {
  const owner = state.state.owner;
  const inside = new Set(piece.cells);
  const touching = new Map<NationId, Set<CellId>>();
  for (const c of piece.cells) {
    for (const n of state.cells[c]!.neighbors) {
      const other = owner[n]!;
      if (other === 0 || other === piece.owner || inside.has(n)) continue;
      if (!touching.has(other)) touching.set(other, new Set());
      touching.get(other)!.add(n);
    }
  }
  let best = 0;
  let most = 0;
  for (const [id, cells] of touching) {
    if (!state.nations.get(id)?.alive) continue;
    if (cells.size > most || (cells.size === most && id < best)) {
      best = id;
      most = cells.size;
    }
  }
  return best;
}

function give(state: WorldState, piece: Piece, to: NationId): void {
  for (const c of piece.cells) setOwner(state, c, to);
}

/**
 * Year's end: a pocket of at most SIM.POCKET_MAX_CELLS cells, cut off from its realm for
 * SIM.POCKET_YEARS, joins the realm around it. Realms at war wait for the peace to settle it.
 * Returns how many cells changed hands.
 */
export function absorbPockets(state: WorldState): number {
  if (SIM.POCKET_MAX_CELLS <= 0) return 0;
  const atWar = warPairs(state);
  const since = state.state.ownedSince;
  let moved = 0;
  for (const piece of pockets(state, landPieces(state))) {
    if (piece.cells.length > SIM.POCKET_MAX_CELLS) continue;
    const settled = piece.cells.every((c) => state.year - since[c]! >= SIM.POCKET_YEARS);
    if (!settled) continue;
    const around = realmAround(state, piece);
    if (around === 0 || atWar.has(pairKey(piece.owner, around))) continue;
    give(state, piece, around);
    moved += piece.cells.length;
  }
  return moved;
}

/** Cells of `a` or `b` with more neighbors in the other realm than in their own. Capitals never move. */
function outnumbered(state: WorldState, a: Nation, b: Nation): CellId[] {
  const owner = state.state.owner;
  const found: CellId[] = [];
  for (let c = 0; c < owner.length; c++) {
    const mine = owner[c]!;
    if ((mine !== a.id && mine !== b.id) || c === a.capital || c === b.capital) continue;
    const other = mine === a.id ? b.id : a.id;
    let own = 0;
    let foreign = 0;
    for (const n of state.cells[c]!.neighbors) {
      if (owner[n] === mine) own++;
      else if (owner[n] === other) foreign++;
    }
    if (foreign > own) found.push(c);
  }
  return found;
}

/**
 * At peace: the two realms straighten the line between them. A cell with more neighbors
 * on the other side goes over (up to SIM.BORDER_ROUNDS passes), then small pockets one
 * realm holds inside the other are handed over. Returns how many cells changed hands.
 */
export function settleBorder(state: WorldState, a: Nation, b: Nation): number {
  if (!a.alive || !b.alive) return 0;
  const owner = state.state.owner;
  let moved = 0;
  for (let round = 0; round < SIM.BORDER_ROUNDS; round++) {
    // Decide every cell from the same picture, then move them, so the order of cells can't matter.
    const swaps = outnumbered(state, a, b);
    if (swaps.length === 0) break;
    for (const c of swaps) setOwner(state, c, owner[c] === a.id ? b.id : a.id);
    moved += swaps.length;
  }
  if (SIM.POCKET_MAX_CELLS <= 0) return moved;
  const both = new Set([a.id, b.id]);
  for (const piece of pockets(state, landPieces(state, both))) {
    if (piece.cells.length > SIM.POCKET_MAX_CELLS) continue;
    const around = realmAround(state, piece);
    if (!both.has(around)) continue;
    give(state, piece, around);
    moved += piece.cells.length;
  }
  return moved;
}
