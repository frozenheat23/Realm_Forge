// Parchment map: the parts of a printed chart around the land. Sailing lines, grid,
// compass rose, checkered frame and the title panel with the year.
import type { GeneratedWorld } from "../gen";
import {
  ATLAS_FRAME_CHECK,
  ATLAS_FRAME_WIDTH,
  ATLAS_GRID_COLOR,
  ATLAS_GRID_X,
  ATLAS_GRID_Y,
  ATLAS_INK,
  ATLAS_NOTE_FONT,
  ATLAS_PANEL_FILL,
  ATLAS_PANEL_HEIGHT,
  ATLAS_PANEL_MARGIN,
  ATLAS_PANEL_WIDTH,
  ATLAS_ROSE_RADIUS,
  ATLAS_SAILING_INK,
  ATLAS_SAILING_RAYS,
  ATLAS_SAILING_RED,
  ATLAS_TITLE_FONT,
  CASTLE_WALL,
} from "./palette";
import { distanceToCoast } from "./terrainCel";

// How far a search for open sea stays from the edge of the map, and from what's already placed.
const OPEN_SEA_MARGIN = 110;
const OPEN_SEA_STEP = 12;
const PANEL_CLEARANCE = 200;
const ROSE_CLEARANCE = 130;
/** Long enough to cross the map from anywhere. */
const SAILING_RAY_LENGTH = 2200;

export interface AtlasChart {
  /** Every pixel's distance from the coast. */
  coastDist: Float32Array;
  panelX: number;
  panelY: number;
  rose: [number, number];
  /** A second point at sea that sailing lines radiate from. */
  sailingHub: [number, number];
}

/** A point at sea far from land and from each [x, y, radius] in `avoid`. */
function openSea(world: GeneratedWorld, coastDist: Float32Array, avoid: [number, number, number][]): [number, number] {
  const { width, height, heightmap } = world;
  let best: [number, number] = [width / 2, height / 2];
  let bestScore = -1;
  for (let y = OPEN_SEA_MARGIN; y < height - OPEN_SEA_MARGIN; y += OPEN_SEA_STEP) {
    for (let x = OPEN_SEA_MARGIN; x < width - OPEN_SEA_MARGIN; x += OPEN_SEA_STEP) {
      const i = y * width + x;
      if (heightmap.data[i]! > heightmap.seaLevel) continue;
      let score = coastDist[i]!;
      for (const [ax, ay, r] of avoid) score = Math.min(score, Math.hypot(x - ax, y - ay) - r);
      if (score > bestScore) [best, bestScore] = [[x, y], score];
    }
  }
  return best;
}

/** Works out where everything goes. The title panel takes the corner with the least land. */
export function planChart(world: GeneratedWorld): AtlasChart {
  const { width, height, heightmap } = world;
  const coastDist = distanceToCoast(heightmap);
  const right = width - ATLAS_PANEL_WIDTH - ATLAS_PANEL_MARGIN;
  const bottom = height - ATLAS_PANEL_HEIGHT - ATLAS_PANEL_MARGIN;
  const corners: [number, number][] = [
    [ATLAS_PANEL_MARGIN, ATLAS_PANEL_MARGIN],
    [right, ATLAS_PANEL_MARGIN],
    [ATLAS_PANEL_MARGIN, bottom],
    [right, bottom],
  ];
  const landUnder = ([cornerX, cornerY]: [number, number]): number => {
    let land = 0;
    for (let y = cornerY; y < cornerY + ATLAS_PANEL_HEIGHT; y += OPEN_SEA_STEP / 2) {
      for (let x = cornerX; x < cornerX + ATLAS_PANEL_WIDTH; x += OPEN_SEA_STEP / 2) {
        if (heightmap.data[y * width + x]! > heightmap.seaLevel) land++;
      }
    }
    return land;
  };
  const [panelX, panelY] = corners.reduce((a, b) => (landUnder(a) <= landUnder(b) ? a : b));

  const avoid: [number, number, number][] = [[panelX + ATLAS_PANEL_WIDTH / 2, panelY + ATLAS_PANEL_HEIGHT / 2, PANEL_CLEARANCE]];
  const rose = openSea(world, coastDist, avoid);
  avoid.push([rose[0], rose[1], ROSE_CLEARANCE]);
  return { coastDist, panelX, panelY, rose, sailingHub: openSea(world, coastDist, avoid) };
}

function drawRose(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  // Each point is two halves, one dark and one pale. The four long ones go on top.
  const tiers: [number, number, number, number][] = [
    [8, Math.PI / 8, 0.72, 0.1],
    [4, 0, 1, 0.15],
  ];
  for (const [count, turn, length, wide] of tiers) {
    for (let k = 0; k < count; k++) {
      ctx.save();
      ctx.rotate((k / count) * Math.PI * 2 + turn);
      for (const [side, color] of [[1, CASTLE_WALL], [-1, ATLAS_INK]] as const) {
        ctx.beginPath();
        ctx.moveTo(0, -r * length);
        ctx.lineTo(side * r * wide, -r * wide);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.font = ATLAS_TITLE_FONT.replace(/^\d+px/, `${Math.round(r * 0.3)}px`);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ATLAS_INK;
  ctx.fillText("N", 0, -r * 1.16);
  ctx.restore();
}

/** Faint grid, sailing lines over the sea only, and the compass rose. */
export function drawSailingLines(ctx: CanvasRenderingContext2D, world: GeneratedWorld, chart: AtlasChart): void {
  const { width, height, heightmap } = world;

  const lines = document.createElement("canvas");
  lines.width = width;
  lines.height = height;
  const linesCtx = lines.getContext("2d")!;
  linesCtx.lineWidth = 0.8;
  for (const [hubX, hubY] of [chart.rose, chart.sailingHub]) {
    for (let k = 0; k < ATLAS_SAILING_RAYS; k++) {
      const angle = (k / ATLAS_SAILING_RAYS) * Math.PI * 2;
      linesCtx.strokeStyle = k % 2 === 0 ? ATLAS_SAILING_INK : ATLAS_SAILING_RED;
      linesCtx.beginPath();
      linesCtx.moveTo(hubX, hubY);
      linesCtx.lineTo(hubX + Math.cos(angle) * SAILING_RAY_LENGTH, hubY + Math.sin(angle) * SAILING_RAY_LENGTH);
      linesCtx.stroke();
    }
  }
  // Rub the lines out wherever there's land.
  const land = new ImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    if (heightmap.data[i]! > heightmap.seaLevel || chart.coastDist[i]! < 2) land.data[i * 4 + 3] = 255;
  }
  const landCanvas = document.createElement("canvas");
  landCanvas.width = width;
  landCanvas.height = height;
  landCanvas.getContext("2d")!.putImageData(land, 0, 0);
  linesCtx.globalCompositeOperation = "destination-out";
  linesCtx.drawImage(landCanvas, 0, 0);
  ctx.drawImage(lines, 0, 0);

  ctx.strokeStyle = ATLAS_GRID_COLOR;
  ctx.lineWidth = 0.8;
  for (let x = ATLAS_GRID_X; x < width; x += ATLAS_GRID_X) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = ATLAS_GRID_Y; y < height; y += ATLAS_GRID_Y) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  drawRose(ctx, chart.rose[0], chart.rose[1], ATLAS_ROSE_RADIUS);
}

/** A checkered band around the sheet with a line inside it. */
export function drawChartFrame(ctx: CanvasRenderingContext2D, world: GeneratedWorld): void {
  const { width, height } = world;
  const band = ATLAS_FRAME_WIDTH;
  ctx.fillStyle = ATLAS_PANEL_FILL;
  ctx.fillRect(0, 0, width, band);
  ctx.fillRect(0, height - band, width, band);
  ctx.fillRect(0, 0, band, height);
  ctx.fillRect(width - band, 0, band, height);

  ctx.fillStyle = ATLAS_INK;
  const check = ATLAS_FRAME_CHECK;
  for (let x = 0; x < width; x += check * 2) {
    ctx.fillRect(x, 0, check, band - 2);
    ctx.fillRect(x, height - band + 2, check, band - 2);
  }
  for (let y = 0; y < height; y += check * 2) {
    ctx.fillRect(0, y, band - 2, check);
    ctx.fillRect(width - band + 2, y, band - 2, check);
  }
  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(band, band, width - band * 2, height - band * 2);
}

/** The title panel, which also carries the year (and the heatmap's name) so videos show them. */
export function drawTitlePanel(ctx: CanvasRenderingContext2D, chart: AtlasChart, year: number, heatmap: string | null): void {
  const { panelX: x, panelY: y } = chart;
  ctx.save();
  ctx.fillStyle = ATLAS_PANEL_FILL;
  ctx.fillRect(x, y, ATLAS_PANEL_WIDTH, ATLAS_PANEL_HEIGHT);
  ctx.strokeStyle = ATLAS_INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + 6, y + 6, ATLAS_PANEL_WIDTH - 12, ATLAS_PANEL_HEIGHT - 12);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 11, y + 11, ATLAS_PANEL_WIDTH - 22, ATLAS_PANEL_HEIGHT - 22);

  const middle = x + ATLAS_PANEL_WIDTH / 2;
  ctx.fillStyle = ATLAS_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = ATLAS_NOTE_FONT;
  ctx.fillText("A Chart of", middle, y + 38);
  ctx.font = ATLAS_TITLE_FONT;
  ctx.letterSpacing = "1px";
  ctx.fillText("The Known World", middle, y + 73);
  ctx.letterSpacing = "0px";
  ctx.font = ATLAS_NOTE_FONT;
  ctx.fillText(`in the Year ${year}`, middle, y + 108);
  if (heatmap) ctx.fillText(`Heatmap: ${heatmap} (low → high)`, middle, y + 127);
  ctx.restore();
}
