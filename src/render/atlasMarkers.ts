// Parchment map: small inked pictures for capitals, cities and resources.
// Each is drawn around (0, 0) on its own scale, so the numbers inside are its shape, not settings.
import { Resource, type ResourceId } from "../core/types";
import { ATLAS_CASTLE_SCALE, ATLAS_CITY_SCALE, ATLAS_INK, CASTLE_WALL } from "./palette";

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

/** A tower with battlements, standing on the ground at `bottom`. */
function tower(ctx: CanvasRenderingContext2D, left: number, width: number, top: number, bottom: number): void {
  const merlon = width / 3;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top);
  ctx.lineTo(left + merlon, top);
  ctx.lineTo(left + merlon, top + 2);
  ctx.lineTo(left + merlon * 2, top + 2);
  ctx.lineTo(left + merlon * 2, top);
  ctx.lineTo(left + width, top);
  ctx.lineTo(left + width, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A capital: a walled keep with a gate, flying a flag in the realm's color. Stands on (x, y). */
export function drawCastle(ctx: CanvasRenderingContext2D, x: number, y: number, flag: string): void {
  atPlace(ctx, x, y, ATLAS_CASTLE_SCALE, () => {
    tower(ctx, -3.5, 7, -13, 3); // the keep behind the walls
    tower(ctx, -9, 18, -5, 3); // the wall
    tower(ctx, -10, 5, -9, 3);
    tower(ctx, 5, 5, -9, 3);

    // Gate: an arch cut into the wall.
    ctx.fillStyle = ATLAS_INK;
    ctx.beginPath();
    ctx.moveTo(-2, 3);
    ctx.lineTo(-2, -0.5);
    ctx.arc(0, -0.5, 2, Math.PI, 0);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();

    // Flagpole and flag.
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, -21);
    ctx.stroke();
    ctx.fillStyle = flag;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(7, -19);
    ctx.lineTo(0, -16.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

/** A city: a small town hall with a spire. Stands on (x, y). */
export function drawCitySpire(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  atPlace(ctx, x, y, ATLAS_CITY_SCALE, () => {
    // The body, with its roof.
    ctx.beginPath();
    ctx.moveTo(-1, 3);
    ctx.lineTo(-1, -2);
    ctx.lineTo(2, -5);
    ctx.lineTo(5, -2);
    ctx.lineTo(5, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // The tower, ending in a point.
    ctx.beginPath();
    ctx.moveTo(-5, 3);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-3, -10);
    ctx.lineTo(-1, -4);
    ctx.lineTo(-1, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
