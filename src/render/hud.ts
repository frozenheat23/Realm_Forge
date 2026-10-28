// Text drawn on top of the map itself (so it also appears in recorded videos).
import { YEAR_COLOR, YEAR_FONT, YEAR_SHADOW } from "./palette";

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
