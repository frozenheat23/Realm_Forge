// Text drawn on top of the map itself (so it also appears in recorded videos).
import { HEAT_LABEL_FONT, YEAR_COLOR, YEAR_FONT, YEAR_SHADOW } from "./palette";

/** Names the heatmap being shown, under the year. */
export function drawHeatmapName(ctx: CanvasRenderingContext2D, name: string, mapWidth: number): void {
  ctx.save();
  ctx.font = HEAT_LABEL_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.shadowColor = YEAR_SHADOW;
  ctx.shadowBlur = 4;
  ctx.fillStyle = YEAR_COLOR;
  ctx.fillText(`Heatmap: ${name} (low → high)`, mapWidth - 24, 58);
  ctx.restore();
}

export function drawYear(ctx: CanvasRenderingContext2D, year: number, mapWidth: number): void {
  ctx.save();
  ctx.font = YEAR_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.letterSpacing = "2px";
  ctx.shadowColor = YEAR_SHADOW;
  ctx.shadowBlur = 4;
  ctx.fillStyle = YEAR_COLOR;
  ctx.fillText(`Year ${year}`, mapWidth - 24, 16);
  ctx.restore();
}
