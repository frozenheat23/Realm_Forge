// Draws rivers as smooth blue lines from cell center to cell center.
import type { GeneratedWorld } from "../gen";
import { RIVER_COLOR, RIVER_MIN_WIDTH, RIVER_WIDTH_PER_FLOW } from "./palette";

type Point = [number, number];

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function drawRivers(ctx: CanvasRenderingContext2D, world: GeneratedWorld): void {
  const { cells } = world;
  ctx.save();
  ctx.strokeStyle = RIVER_COLOR;
  ctx.lineCap = "round";

  for (const cell of cells) {
    if (!cell.river) continue;
    const next = cells[cell.downstream];
    if (!next) continue;

    // Each piece runs from halfway to the next cell, curves through the next
    // cell's center, and ends halfway to the cell after that. Pieces join at
    // those halfway points, so the whole river is one smooth curve.
    const afterNext = cells[next.downstream];
    const start = midpoint(cell.site, next.site);
    const end = afterNext ? midpoint(next.site, afterNext.site) : next.site;

    ctx.lineWidth = RIVER_MIN_WIDTH + Math.sqrt(cell.riverFlow) * RIVER_WIDTH_PER_FLOW;
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.quadraticCurveTo(next.site[0], next.site[1], end[0], end[1]);
    ctx.stroke();
  }
  ctx.restore();
}
