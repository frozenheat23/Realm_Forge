// Resources layer (SPEC §5.4e): a small lettered marker on every deposit, bigger when richer.
import type { GeneratedWorld } from "../gen";
import {
  RESOURCE_COLORS,
  RESOURCE_FONT,
  RESOURCE_LETTERS,
  RESOURCE_OUTLINE,
  RESOURCE_RADIUS,
  RESOURCE_RICH_GROWTH,
} from "./palette";

export function drawResources(ctx: CanvasRenderingContext2D, world: GeneratedWorld): void {
  ctx.save();
  ctx.font = RESOURCE_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const cell of world.cells) {
    if (cell.resource === 0) continue;
    const [x, y] = cell.site;
    ctx.beginPath();
    ctx.arc(x, y, RESOURCE_RADIUS + cell.richness * RESOURCE_RICH_GROWTH, 0, Math.PI * 2);
    ctx.fillStyle = RESOURCE_COLORS[cell.resource]!;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = RESOURCE_OUTLINE;
    ctx.stroke();
    ctx.fillStyle = RESOURCE_OUTLINE;
    ctx.fillText(RESOURCE_LETTERS[cell.resource]!, x, y + 0.5);
  }
  ctx.restore();
}
