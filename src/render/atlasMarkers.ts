// Parchment map: small ink engravings for capitals, cities, armies and resources.
// Each is drawn around (0, 0) on its own scale, so the numbers inside are its shape, not settings.
import { Resource, type ResourceId } from "../core/types";
import { ATLAS_CASTLE_SCALE, ATLAS_CITY_SCALE, ATLAS_INK, CASTLE_WALL, MARKER_SHADE } from "./palette";

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
const MARKER_TOOTH = 1.5;

/**
 * Shading the engraver's way: `count` short slanted strokes running down from (x, y),
 * `gap` apart. Used on east faces, since the chart's light comes from the north-west.
 */
function hatch(ctx: CanvasRenderingContext2D, x: number, y: number, count: number, gap: number, length: number): void {
  ctx.save();
  ctx.lineWidth *= 0.5;
  ctx.beginPath();
  for (let k = 0; k < count; k++) {
    ctx.moveTo(x, y + gap * k);
    ctx.lineTo(x + length, y + gap * k + length);
  }
  ctx.stroke();
  ctx.restore();
}

/** The line of ground a marker stands on. */
function groundLine(ctx: CanvasRenderingContext2D, left: number, right: number, y: number): void {
  ctx.save();
  ctx.lineWidth *= 0.7;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.restore();
}

/** A building seen from the front: walls up to `eaves`, then a pointed roof up to `peak`. */
function gabled(ctx: CanvasRenderingContext2D, left: number, right: number, eaves: number, peak: number, bottom: number): void {
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, eaves);
  ctx.lineTo((left + right) / 2, peak);
  ctx.lineTo(right, eaves);
  ctx.lineTo(right, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A triangular pennant flying east from the top of a pole that rises from (0, `foot`) to (0, `top`). */
function pennant(ctx: CanvasRenderingContext2D, foot: number, top: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(0, foot);
  ctx.lineTo(0, top);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(7, top + 1.6);
  ctx.lineTo(0, top + 3.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * A capital, as an ink engraving: a battlemented keep and two towers behind a gated wall,
 * hatched on their east faces. Only the pennant takes the realm's color. Stands on (x, y).
 */
export function drawCastle(ctx: CanvasRenderingContext2D, x: number, y: number, flag: string): void {
  atPlace(ctx, x, y, ATLAS_CASTLE_SCALE, () => {
    groundLine(ctx, -14, 14, 3);
    wall(ctx, -4, 8, -15, 3, 3); // the keep, tallest, in the middle
    wall(ctx, -11, 4.5, -9, 3, 2); // a tower at each end of the wall
    wall(ctx, 6.5, 4.5, -9, 3, 2);
    ctx.fillRect(-6.5, -4, 13, 7); // the wall between them
    ctx.strokeRect(-6.5, -4, 13, 7);

    hatch(ctx, 1.3, -12, 3, 2.5, 2);
    hatch(ctx, -8.4, -6.5, 3, 2.5, 1.5);
    hatch(ctx, 9, -6.5, 3, 2.5, 1.5);
    hatch(ctx, 3.5, -3, 2, 2.5, 2);

    // Gate: a dark arch in the wall.
    ctx.fillStyle = ATLAS_INK;
    ctx.beginPath();
    ctx.moveTo(-2, 3);
    ctx.lineTo(-2, 0);
    ctx.arc(0, 0, 2, Math.PI, 0);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();

    pennant(ctx, -15, -22, flag);
  });
}

/** A city, as an ink engraving: a spire between two gabled houses. Stands on (x, y). */
export function drawCitySpire(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  atPlace(ctx, x, y, ATLAS_CITY_SCALE, () => {
    groundLine(ctx, -9, 9, 3);
    gabled(ctx, 0.5, 5.5, -1.5, -5, 3); // a house
    gabled(ctx, -5.5, -2.3, -5, -11.5, 3); // the spire
    gabled(ctx, -2.8, 1.4, -0.5, -3.5, 3); // a lower house in front
    hatch(ctx, 3.6, -1, 2, 1.8, 1.4);
    hatch(ctx, -3.7, -4, 3, 2.2, 1);
  });
}

/**
 * An army on the parchment map: a camp of two tents under a pennant in the realm's color.
 * (x, y) is its middle and `r` its half-height. The size label is drawn by armies.ts.
 */
export function drawWarCamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  // The camp is drawn 20 units tall (pennant tip at −17, ground at 3), so r / 10 fits it to the banner size.
  const scale = r / 10;
  atPlace(ctx, x, y, scale, () => {
    ctx.lineWidth = 1.1 / scale; // keeps the ink line the same thickness whatever the army's size
    ctx.translate(-3, 7); // the camp's middle goes on (x, y)
    groundLine(ctx, -11, 17, 3);

    // A smaller tent behind.
    ctx.beginPath();
    ctx.moveTo(6, 3);
    ctx.lineTo(11, -4);
    ctx.lineTo(16, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // The main tent: its east side shaded, its door dark.
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(0, -9);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MARKER_SHADE;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8, 3);
    ctx.lineTo(3.5, 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(0, -9);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = ATLAS_INK;
    ctx.beginPath();
    ctx.moveTo(-2, 3);
    ctx.lineTo(0, -3);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();

    pennant(ctx, -9, -17, color);
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
