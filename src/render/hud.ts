// Text drawn on top of the map itself (so it also appears in recorded videos).
import {
  HEADLINE_BOTTOM,
  HEADLINE_FONT_FAMILY,
  HEADLINE_FONT_SIZE,
  HEADLINE_HEIGHT,
  HEADLINE_INK,
  HEADLINE_MAX_WIDTH,
  HEADLINE_PAPER,
  HEADLINE_SEAL,
  HEAT_LABEL_FONT,
  YEAR_COLOR,
  YEAR_FONT,
  YEAR_SHADOW,
} from "./palette";

/**
 * The headline banner (SPEC §5.4o): a strip of parchment at the bottom of the map with one line
 * of news and a seal in the color of the realm it is about. `alpha` (0..1) fades it out.
 */
export function drawHeadline(ctx: CanvasRenderingContext2D, text: string, sealColor: string, alpha: number, mapWidth: number, mapHeight: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${HEADLINE_FONT_SIZE}px ${HEADLINE_FONT_FAMILY}`;
  const pad = HEADLINE_HEIGHT / 2;
  const sealSpace = HEADLINE_SEAL * 2 + 10;
  const room = mapWidth * HEADLINE_MAX_WIDTH - pad * 2 - sealSpace;
  // A long line is set in smaller type, so it always fits on one line.
  const fit = Math.min(1, room / ctx.measureText(text).width);
  ctx.font = `${HEADLINE_FONT_SIZE * fit}px ${HEADLINE_FONT_FAMILY}`;
  const textWidth = ctx.measureText(text).width;
  const width = textWidth + sealSpace + pad * 2;
  const x = (mapWidth - width) / 2;
  const y = mapHeight - HEADLINE_BOTTOM - HEADLINE_HEIGHT;

  ctx.fillStyle = HEADLINE_PAPER;
  ctx.strokeStyle = HEADLINE_INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, width, HEADLINE_HEIGHT, 4);
  ctx.fill();
  ctx.stroke();

  const middle = y + HEADLINE_HEIGHT / 2;
  ctx.fillStyle = sealColor;
  ctx.beginPath();
  ctx.arc(x + pad + HEADLINE_SEAL, middle, HEADLINE_SEAL, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = HEADLINE_INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + pad + sealSpace, middle + 1);
  ctx.restore();
}

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
