// Parchment map: small inked pictures for capitals, cities, armies and resources.
// Each is drawn around (0, 0) on its own scale, so the numbers inside are its shape, not settings.
import { Resource, type ResourceId } from "../core/types";
import { ATLAS_CASTLE_SCALE, ATLAS_CITY_SCALE, ATLAS_INK, CASTLE_WALL, MARKER_ROOF, MARKER_SHADE, MARKER_SHADOW_ALPHA } from "./palette";

/** Runs `draw` with (0, 0) moved to (x, y) and everything scaled, in ink on paper. */
function atPlace(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, draw: () => void): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = ATLAS_INK;
  ctx.fillStyle = CASTLE_WALL;
  ctx.lineWidth = 1.1;
  ctx.lineJoin = "round";
  draw();
  ctx.restore();
}

/** A wall with battlements along its top, standing on the ground at `bottom`. `teeth` is how many battlements. */
function wall(ctx: CanvasRenderingContext2D, left: number, width: number, top: number, bottom: number, teeth: number): void {
  const step = width / (teeth * 2 - 1);
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top);
  for (let k = 0; k < teeth; k++) {
    const x = left + step * k * 2;
    ctx.lineTo(x + step, top);
    if (k < teeth - 1) {
      ctx.lineTo(x + step, top + MARKER_TOOTH);
      ctx.lineTo(x + step * 2, top + MARKER_TOOTH);
      ctx.lineTo(x + step * 2, top);
    }
  }
  ctx.lineTo(left + width, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** How deep the gaps between battlements are cut, in the marker's own units. */
const MARKER_TOOTH = 1.8;

/**
 * A building's walls with a pointed roof: light on the west face, shaded on the east
 * (the chart's light comes from the north-west, like its mountains).
 */
function roofed(ctx: CanvasRenderingContext2D, left: number, width: number, top: number, bottom: number, roofHeight: number): void {
  const right = left + width;
  ctx.fillStyle = CASTLE_WALL;
  ctx.fillRect(left, top, width, bottom - top);
  ctx.fillStyle = MARKER_SHADE;
  ctx.fillRect(left + width * 0.55, top, width * 0.45, bottom - top);
  ctx.strokeRect(left, top, width, bottom - top);
  // The roof overhangs the walls a little.
  ctx.fillStyle = MARKER_ROOF;
  ctx.beginPath();
  ctx.moveTo(left - 0.8, top);
  ctx.lineTo(left + width / 2, top - roofHeight);
  ctx.lineTo(right + 0.8, top);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CASTLE_WALL;
}

/** The soft shadow a marker casts on the paper, so it stands on the map instead of floating. */
function groundShadow(ctx: CanvasRenderingContext2D, halfWidth: number, y: number): void {
  ctx.save();
  ctx.globalAlpha = MARKER_SHADOW_ALPHA;
  ctx.fillStyle = ATLAS_INK;
  ctx.beginPath();
  ctx.ellipse(halfWidth * 0.15, y, halfWidth, halfWidth * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A capital: a keep and two roofed towers behind a gated wall, flying a pennant in the realm's color. Stands on (x, y). */
export function drawCastle(ctx: CanvasRenderingContext2D, x: number, y: number, flag: string): void {
  atPlace(ctx, x, y, ATLAS_CASTLE_SCALE, () => {
    groundShadow(ctx, 13, 3);
    roofed(ctx, -3.5, 7, -12, 3, 6); // the keep, tallest, in the middle
    roofed(ctx, -11, 5, -7, 3, 5); // a tower at each end of the wall
    roofed(ctx, 6, 5, -7, 3, 5);
    wall(ctx, -7.5, 15, -4, 3, 4);

    // Gate: a dark arch in the wall, and a window slit in the keep.
    ctx.fillStyle = ATLAS_INK;
    ctx.beginPath();
    ctx.moveTo(-2, 3);
    ctx.lineTo(-2, 0);
    ctx.arc(0, 0, 2, Math.PI, 0);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-0.5, -10, 1, 3);

    // Flagpole and a swallow-tailed pennant.
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -24);
    ctx.stroke();
    ctx.fillStyle = flag;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(8, -23.3);
    ctx.lineTo(5.8, -22.2);
    ctx.lineTo(8, -21.1);
    ctx.lineTo(0, -20.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

/** A city: a church with a spire among two houses. Stands on (x, y). */
export function drawCitySpire(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  atPlace(ctx, x, y, ATLAS_CITY_SCALE, () => {
    groundShadow(ctx, 8, 3);
    roofed(ctx, 0.5, 5, -1.5, 3, 3.5); // a house
    roofed(ctx, -5.5, 3.2, -5, 3, 6.5); // the spire
    roofed(ctx, -2.8, 4.2, -0.5, 3, 3); // a lower house in front
  });
}

/**
 * An army on the parchment map: a war banner on a spear, in the realm's color.
 * (x, y) is its middle and `r` its half-height. Returns nothing; the size label is drawn by armies.ts.
 */
export function drawWarBanner(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  // Drawn on a scale where the banner is 2 units tall, so the numbers below are its shape.
  atPlace(ctx, x, y, r, () => {
    ctx.lineWidth = 1.3 / r; // keeps the ink line the same thickness whatever the banner's size
    ctx.save();
    ctx.globalAlpha = MARKER_SHADOW_ALPHA;
    ctx.fillStyle = ATLAS_INK;
    ctx.beginPath();
    ctx.ellipse(-0.35, 1, 0.5, 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // The spear: a shaft with a small head.
    ctx.beginPath();
    ctx.moveTo(-0.55, 1);
    ctx.lineTo(-0.55, -0.95);
    ctx.stroke();
    ctx.fillStyle = ATLAS_INK;
    ctx.beginPath();
    ctx.moveTo(-0.67, -0.92);
    ctx.lineTo(-0.55, -1.25);
    ctx.lineTo(-0.43, -0.92);
    ctx.closePath();
    ctx.fill();

    // The cloth: swallow-tailed, its edges curved as if stirred by wind.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-0.55, -0.85);
    ctx.quadraticCurveTo(0.1, -1.0, 0.95, -0.78);
    ctx.lineTo(0.55, -0.32);
    ctx.lineTo(0.95, 0.12);
    ctx.quadraticCurveTo(0.1, -0.02, -0.55, 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // A fold in the cloth.
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(-0.05, -0.9);
    ctx.quadraticCurveTo(0.08, -0.4, -0.05, 0.02);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function drawGrain(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, 4.5);
  ctx.lineTo(0, -4.5);
  for (const y of [-3, -0.8, 1.4]) {
    ctx.moveTo(0, y + 1.5);
    ctx.lineTo(-2.2, y);
    ctx.moveTo(0, y + 1.5);
    ctx.lineTo(2.2, y);
  }
  ctx.stroke();
}

function drawTimber(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, 4.5);
  ctx.lineTo(0, 2);
  ctx.moveTo(-3.5, 2);
  ctx.lineTo(0, -4.5);
  ctx.lineTo(3.5, 2);
  ctx.closePath();
  ctx.stroke();
}

/** A miner's pick. */
function drawIron(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-3.5, 4);
  ctx.lineTo(2, -2);
  ctx.moveTo(-1.5, -4);
  ctx.quadraticCurveTo(3, -3.5, 4, 1);
  ctx.stroke();
}

/** An ingot. */
function drawGold(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-4.5, 2.5);
  ctx.lineTo(-2.5, -2.5);
  ctx.lineTo(2.5, -2.5);
  ctx.lineTo(4.5, 2.5);
  ctx.closePath();
  ctx.stroke();
}

function drawHorseshoe(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-3, 3.5);
  ctx.lineTo(-3, -1);
  ctx.arc(0, -1, 3, Math.PI, 0);
  ctx.lineTo(3, 3.5);
  ctx.stroke();
  ctx.lineWidth = 1.1;
}

/** A cut gem. */
function drawMithril(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(-2, -3.5);
  ctx.lineTo(2, -3.5);
  ctx.lineTo(4, -1);
  ctx.lineTo(0, 4.5);
  ctx.closePath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(4, -1);
  ctx.stroke();
}

const RESOURCE_ICONS: Record<Exclude<ResourceId, typeof Resource.None>, (ctx: CanvasRenderingContext2D) => void> = {
  [Resource.Grain]: drawGrain,
  [Resource.Timber]: drawTimber,
  [Resource.Iron]: drawIron,
  [Resource.Gold]: drawGold,
  [Resource.Horses]: drawHorseshoe,
  [Resource.Mithril]: drawMithril,
};

/** A resource: a small tinted disc with the deposit's picture on it. */
export function drawResourceIcon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, kind: ResourceId, fill: string): void {
  if (kind === Resource.None) return;
  atPlace(ctx, x, y, radius / 6, () => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    RESOURCE_ICONS[kind](ctx);
  });
}
