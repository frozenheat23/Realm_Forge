// Nation names and capital markers (SPEC §5.4).
import type { GeneratedWorld } from "../gen";
import type { CellId, NationId, WorldState } from "../core/types";
import { clamp } from "../core/math";
import { drawCastle } from "./atlasMarkers";
import { atMark, markScale, zoomOf } from "./marks";
import { cssColor, lookTint } from "./color";
import {
  CAPITAL_FILL,
  CAPITAL_RADIUS,
  CROWN_GAP,
  CROWN_HEIGHT,
  CROWN_WIDTH,
  LABEL_MAX_SIZE,
  LABEL_MIN_AREA,
  LABEL_MIN_SIZE,
  LABEL_SIZE_PER_SQRT_AREA,
  LOOK_STANDARD,
  NAME_HALO_SHARE,
  type MapLook,
} from "./palette";

/**
 * Where to put a nation's label: the average position of its cells. If that
 * point lands outside the nation (e.g. a crescent shape), use the nation's
 * cell closest to it instead.
 */
export function labelAnchor(
  world: GeneratedWorld,
  owned: CellId[],
  ownerOf: (cell: CellId) => NationId,
): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const id of owned) {
    sx += world.cells[id]!.site[0];
    sy += world.cells[id]!.site[1];
  }
  const cx = sx / owned.length;
  const cy = sy / owned.length;

  let best = owned[0]!;
  let bestDist = Infinity;
  for (const id of owned) {
    const [x, y] = world.cells[id]!.site;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestDist) [best, bestDist] = [id, d];
  }
  const cellAtCenter = world.pixelToCell[Math.floor(cy) * world.width + Math.floor(cx)]!;
  return ownerOf(cellAtCenter) === ownerOf(owned[0]!) ? [cx, cy] : world.cells[best]!.site;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Capital marker: a small light dot with a dark ring. */
function drawCapitalDot(ctx: CanvasRenderingContext2D, x: number, y: number, ink: string): void {
  ctx.beginPath();
  ctx.arc(x, y, CAPITAL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = CAPITAL_FILL;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = ink;
  ctx.stroke();
}

/** A small three-pointed crown above a capital marker `height` pixels tall. */
function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, look: MapLook): void {
  const half = CROWN_WIDTH / 2;
  const base = y - look.capitalHeight - CROWN_GAP;
  const top = base - CROWN_HEIGHT;
  const dip = base - CROWN_HEIGHT * 0.45; // how far down the crown dips between its points
  ctx.beginPath();
  ctx.moveTo(x - half, base);
  ctx.lineTo(x - half, top);
  ctx.lineTo(x - half / 2, dip);
  ctx.lineTo(x, top);
  ctx.lineTo(x + half / 2, dip);
  ctx.lineTo(x + half, top);
  ctx.lineTo(x + half, base);
  ctx.closePath();
  ctx.fillStyle = look.crownFill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = look.labelColor;
  ctx.stroke();
}

/** A realm's cells, for every realm that owns any. */
function cellsByOwner(state: WorldState): Map<NationId, CellId[]> {
  const owned = new Map<NationId, CellId[]>();
  state.state.owner.forEach((nationId, cell) => {
    if (nationId === 0) return;
    const list = owned.get(nationId) ?? [];
    list.push(cell);
    owned.set(nationId, list);
  });
  return owned;
}

/** One realm's name on the map: what it says, where its middle is, and how tall its letters are (map pixels). */
export interface NameLabel {
  text: string;
  x: number;
  y: number;
  size: number;
}

/** The canvas text settings for a name `size` pixels tall. Shared by the flat map and the 3D signs. */
export function setNameFont(ctx: CanvasRenderingContext2D, size: number, look: MapLook): void {
  ctx.font = `${look.labelWeight} ${size.toFixed(1)}px ${look.labelFont}`;
  ctx.letterSpacing = `${(size * look.labelSpacing).toFixed(1)}px`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
}

/**
 * Works out which realm names to show and where, without drawing them. `ctx` is only
 * used to measure how wide each name is. `k` shrinks names when zoomed in (see marks.ts).
 */
export function planNameLabels(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState, look: MapLook, k: number): NameLabel[] {
  const owned = cellsByOwner(state);
  // Biggest nations first, so when labels would overlap the bigger name wins.
  const nations = [...state.nations.values()]
    .filter((n) => n.alive)
    .sort((a, b) => (owned.get(b.id)?.length ?? 0) - (owned.get(a.id)?.length ?? 0) || a.id - b.id);
  const placed: Box[] = [];
  const labels: NameLabel[] = [];
  ctx.save();
  for (const nation of nations) {
    const cells = owned.get(nation.id) ?? [];
    if (cells.length < LABEL_MIN_AREA) continue;
    // Zoomed in, names grow more slowly than the map (in map units they shrink by `k`).
    const size = clamp(Math.sqrt(cells.length) * LABEL_SIZE_PER_SQRT_AREA, LABEL_MIN_SIZE, LABEL_MAX_SIZE) * k;
    const [x, y] = labelAnchor(world, cells, (c) => state.state.owner[c]!);
    setNameFont(ctx, size, look);
    const text = look.labelUpper ? nation.name.toUpperCase() : nation.name;
    const halfW = ctx.measureText(text).width / 2;
    const box: Box = { left: x - halfW, right: x + halfW, top: y - size / 2, bottom: y + size / 2 };
    if (placed.some((other) => overlaps(box, other))) continue;
    placed.push(box);
    labels.push({ text, x, y, size });
  }
  ctx.restore();
  return labels;
}

/** Draws every capital's marker, and the realm names too unless `names` is false (the 3D view shows names as standing signs). */
export function drawLabels(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState, look: MapLook = LOOK_STANDARD, names = true): void {
  ctx.save();
  for (const nation of state.nations.values()) {
    if (!nation.alive) continue;
    const [capX, capY] = world.cells[nation.capital]!.site;
    atMark(ctx, capX, capY, () => {
      if (look.capital === "castle") drawCastle(ctx, capX, capY, cssColor(lookTint(nation.color, look)));
      else drawCapitalDot(ctx, capX, capY, look.labelColor);
      if (nation.ruler.great !== undefined) drawCrown(ctx, capX, capY, look);
    });
  }
  if (names) {
    const k = markScale(zoomOf(ctx));
    for (const { text, x, y, size } of planNameLabels(ctx, world, state, look, k)) {
      setNameFont(ctx, size, look);
      // Halo first (a thick light outline), then the dark letters on top.
      ctx.lineWidth = Math.max(2.5 * k, size * NAME_HALO_SHARE);
      ctx.strokeStyle = look.labelHalo;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = look.labelColor;
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}
