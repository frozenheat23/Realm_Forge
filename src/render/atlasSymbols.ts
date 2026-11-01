// Parchment map: rivers and small inked terrain symbols, drawn once onto their own layer.
import { createRng, type Rng } from "../core/rng";
import { Biome } from "../core/types";
import type { GeneratedWorld } from "../gen";
import { MOUNTAIN_H, HILL_H } from "../gen/params";
import type { AtlasChart } from "./atlasChart";
import {
  ATLAS_FOREST_CHANCE,
  ATLAS_HILL_CHANCE,
  ATLAS_INK,
  ATLAS_PEAK_FILL,
  ATLAS_PEAK_GROWTH,
  ATLAS_PEAK_SIZE,
  ATLAS_RIVER_COLOR,
  ATLAS_RIVER_MIN_WIDTH,
  ATLAS_RIVER_WIDTH_PER_FLOW,
  ATLAS_SYMBOL_COAST_GAP,
  ATLAS_TREE_FILL,
  ATLAS_TREE_SIZE,
} from "./palette";
import { drawRivers } from "./rivers";

/** A peak with its east side shaded by fine strokes. (x, y) is the middle of its foot. */
function drawPeak(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, size: number): void {
  const halfWidth = size * (0.6 + rng.next() * 0.15);
  const topX = x + (rng.next() - 0.5) * size * 0.2;
  const topY = y - size;

  // The paper-colored body hides what's behind it, so ranges stack like a drawing.
  ctx.fillStyle = ATLAS_PEAK_FILL;
  ctx.beginPath();
  ctx.moveTo(x - halfWidth, y);
  ctx.lineTo(topX, topY);
  ctx.lineTo(x + halfWidth, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = 0.7;
  const strokes = Math.max(3, Math.round(size / 2.6));
  for (let k = 1; k <= strokes; k++) {
    const t = k / (strokes + 1);
    const startX = topX + (x + halfWidth - topX) * t;
    const startY = topY + (y - topY) * t;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX - size * 0.12, startY + (y - startY) * 0.8);
    ctx.stroke();
  }

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - halfWidth, y);
  ctx.lineTo(topX, topY);
  ctx.lineTo(x + halfWidth, y);
  ctx.stroke();
}

function drawHill(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(x, y, size, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pine: boolean): void {
  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = 0.85;
  ctx.fillStyle = ATLAS_TREE_FILL;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - size * 0.5);
  ctx.stroke();
  ctx.beginPath();
  if (pine) {
    ctx.moveTo(x - size * 0.45, y - size * 0.25);
    ctx.lineTo(x, y - size * 1.3);
    ctx.lineTo(x + size * 0.45, y - size * 0.25);
    ctx.closePath();
  } else {
    ctx.arc(x, y - size * 0.75, size * 0.5, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
}

/** A few dots for sand. */
function drawStipple(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number): void {
  ctx.fillStyle = ATLAS_INK;
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.arc(x + (rng.next() - 0.5) * 11, y + (rng.next() - 0.5) * 9, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A small clump of one to three trees. */
function drawForestClump(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, pine: boolean): void {
  const count = 1 + Math.floor(rng.next() * 3);
  const spots = Array.from({ length: count }, () => [x + (rng.next() - 0.5) * 13, y + (rng.next() - 0.5) * 10] as const);
  spots.sort((a, b) => a[1] - b[1]);
  for (const [treeX, treeY] of spots) drawTree(ctx, treeX, treeY, ATLAS_TREE_SIZE + rng.next() * 1.5, pine);
}

export function drawAtlasLand(ctx: CanvasRenderingContext2D, world: GeneratedWorld, chart: AtlasChart): void {
  drawRivers(ctx, world, ATLAS_RIVER_COLOR, ATLAS_RIVER_MIN_WIDTH, ATLAS_RIVER_WIDTH_PER_FLOW);

  const rng = createRng(world.seed).fork("atlas-symbols");
  const inland = world.cells.filter((c) => {
    const pixel = Math.floor(c.site[1]) * world.width + Math.floor(c.site[0]);
    return c.isLand && chart.coastDist[pixel]! > ATLAS_SYMBOL_COAST_GAP;
  });

  // North to south, so nearer symbols overlap farther ones.
  inland.sort((a, b) => a.site[1] - b.site[1]);
  for (const cell of inland) {
    const x = cell.site[0] + (rng.next() - 0.5) * 5;
    const y = cell.site[1] + (rng.next() - 0.5) * 5;
    const roll = rng.next();
    const forest = cell.biome === Biome.TemperateForest || cell.biome === Biome.TropicalForest || cell.biome === Biome.Taiga;
    if (cell.mountain) {
      drawPeak(ctx, rng, x, y + 6, ATLAS_PEAK_SIZE + (cell.elevation - MOUNTAIN_H) * ATLAS_PEAK_GROWTH + rng.next() * 4);
    } else if (cell.elevation > HILL_H) {
      if (roll < ATLAS_HILL_CHANCE) drawHill(ctx, x, y, 6 + rng.next() * 2);
    } else if (forest) {
      if (roll < ATLAS_FOREST_CHANCE) drawForestClump(ctx, rng, x, y, cell.biome === Biome.Taiga);
    } else if (cell.biome === Biome.Desert) {
      drawStipple(ctx, rng, x, y);
    }
  }
}
