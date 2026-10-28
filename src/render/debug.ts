// Debug overlay: outlines every cell so you can see how the map is split up.
import type { GeneratedWorld } from "../gen";
import { DEBUG_CELL_LINE } from "./palette";

export function drawCellOutlines(ctx: CanvasRenderingContext2D, world: GeneratedWorld): void {
  const voronoi = world.delaunay.voronoi([0, 0, world.width, world.height]);
  ctx.save();
  ctx.strokeStyle = DEBUG_CELL_LINE;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  voronoi.render(ctx);
  ctx.stroke();
  ctx.restore();
}
