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

export function drawLabels(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState, look: MapLook = LOOK_STANDARD): void {
  // Group cells by owner.
  const owned = new Map<NationId, CellId[]>();
  state.state.owner.forEach((nationId, cell) => {
    if (nationId === 0) return;
    const list = owned.get(nationId) ?? [];
    list.push(cell);
    owned.set(nationId, list);
  });

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  // Biggest nations first, so when labels would overlap the bigger name wins.
  const nations = [...state.nations.values()]
    .filter((n) => n.alive)
    .sort((a, b) => (owned.get(b.id)?.length ?? 0) - (owned.get(a.id)?.length ?? 0) || a.id - b.id);
  const placed: Box[] = [];
  const k = markScale(zoomOf(ctx));

  for (const nation of nations) {
    const cells = owned.get(nation.id) ?? [];

    const [capX, capY] = world.cells[nation.capital]!.site;
    atMark(ctx, capX, capY, () => {
      if (look.capital === "castle") drawCastle(ctx, capX, capY, cssColor(lookTint(nation.color, look)));
      else drawCapitalDot(ctx, capX, capY, look.labelColor);
      if (nation.ruler.great !== undefined) drawCrown(ctx, capX, capY, look);
    });

    if (cells.length < LABEL_MIN_AREA) continue;
    // Zoomed in, names grow more slowly than the map (in map units they shrink by `k`).
    const size = clamp(Math.sqrt(cells.length) * LABEL_SIZE_PER_SQRT_AREA, LABEL_MIN_SIZE, LABEL_MAX_SIZE) * k;
    const [x, y] = labelAnchor(world, cells, (c) => state.state.owner[c]!);
    ctx.font = `${look.labelWeight} ${size.toFixed(1)}px ${look.labelFont}`;
    ctx.letterSpacing = `${(size * look.labelSpacing).toFixed(1)}px`;
    const text = look.labelUpper ? nation.name.toUpperCase() : nation.name;
    const halfW = ctx.measureText(text).width / 2;
    const box: Box = { left: x - halfW, right: x + halfW, top: y - size / 2, bottom: y + size / 2 };
    if (placed.some((other) => overlaps(box, other))) continue;
    placed.push(box);

    // Halo first (a thick light outline), then the dark letters on top.
    ctx.lineWidth = Math.max(2.5 * k, size * 0.18);
    ctx.strokeStyle = look.labelHalo;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = look.labelColor;
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}
