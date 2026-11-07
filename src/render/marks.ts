// Markers when zoomed in (M19): castles, names, armies and inked lines grow more
// slowly than the map, so close up they stay readable without taking over.
import { MARK_ZOOM_GROWTH } from "./palette";

/**
 * How big to draw a marker at `zoom`, in map units, compared with zoom 1. On screen
 * it then grows only zoom ^ MARK_ZOOM_GROWTH (×2 at zoom 4). 1 at zoom 1.
 */
export function markScale(zoom: number): number {
  return zoom ** (MARK_ZOOM_GROWTH - 1);
}

/** The zoom `ctx` draws at, read from its transform (map canvases have no other scaling). */
export function zoomOf(ctx: CanvasRenderingContext2D): number {
  return ctx.getTransform().a;
}

/** Runs `draw`, which draws a marker around (x, y), shrunk around that point to marker size. */
export function atMark(ctx: CanvasRenderingContext2D, x: number, y: number, draw: () => void): void {
  const k = markScale(zoomOf(ctx));
  if (k === 1) {
    draw();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-x, -y);
  draw();
  ctx.restore();
}
