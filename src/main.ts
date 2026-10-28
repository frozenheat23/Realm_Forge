// Entry point: generates a world from a seed and draws it.
// Page address options: ?seed=anything picks the world, ?style=painted switches the look.
// Keys: C toggles cell outlines, N toggles nations. Hover the map to inspect a cell.
import { generateWorld } from "./gen";
import { drawCellOutlines } from "./render/debug";
import { buildDisplayCells } from "./render/displayCells";
import { drawLabels } from "./render/labels";
import { renderNationOverlay } from "./render/overlay";
import { drawRivers } from "./render/rivers";
import { renderCelTerrain } from "./render/terrainCel";
import { renderPaintedTerrain } from "./render/terrainPainted";
import { onKey, showCellOnHover } from "./ui/debugInfo";

const canvas = document.querySelector<HTMLCanvasElement>("#map");
const infoPanel = document.querySelector<HTMLElement>("#info");
if (!canvas || !infoPanel) throw new Error("index.html is missing #map or #info");

const query = new URLSearchParams(location.search);
const seed = query.get("seed") ?? "realm-forge";
const style = query.get("style") === "painted" ? "painted" : "cel";

const t0 = performance.now();
const { world, state } = generateWorld(seed);
const t1 = performance.now();

canvas.width = world.width;
canvas.height = world.height;
const ctx = canvas.getContext("2d")!;

// Makes an off-screen canvas the same size as the map.
function offscreen(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = world.width;
  c.height = world.height;
  return [c, c.getContext("2d")!];
}

// The terrain never changes, so draw it once and copy it every frame.
const displayCells = buildDisplayCells(world);
const [terrain, terrainCtx] = offscreen();
const terrainImage =
  style === "painted" ? renderPaintedTerrain(world.heightmap) : renderCelTerrain(world, displayCells);
terrainCtx.putImageData(terrainImage, 0, 0);
drawRivers(terrainCtx, world);

// Nation colors change only when borders change (every year, from M4a).
const [nationLayer, nationCtx] = offscreen();
nationCtx.putImageData(renderNationOverlay(world, displayCells, state), 0, 0);
const t2 = performance.now();

let showCells = query.get("debug") === "cells";
let showNations = true;

function draw(): void {
  ctx.drawImage(terrain, 0, 0);
  if (showNations) ctx.drawImage(nationLayer, 0, 0);
  if (showCells) drawCellOutlines(ctx, world);
  if (showNations) drawLabels(ctx, world, state);
}

draw();
onKey("c", () => {
  showCells = !showCells;
  draw();
});
onKey("n", () => {
  showNations = !showNations;
  draw();
});
showCellOnHover(canvas, infoPanel, world, state);

console.log(
  `Seed "${seed}", style ${style}: world ${(t1 - t0).toFixed(0)} ms, draw ${(t2 - t1).toFixed(0)} ms, ` +
    `${world.cells.length} cells, ${state.nations.size} nations`,
);
