// Entry point: generates a world from a seed and draws it.
// Page address options: ?seed=anything picks the world, ?style=painted switches the look.
// Keys: C toggles cell outlines. Hover the map to inspect a cell.
import { generateWorld } from "./gen";
import { drawCellOutlines } from "./render/debug";
import { drawRivers } from "./render/rivers";
import { renderCelTerrain } from "./render/terrainCel";
import { renderPaintedTerrain } from "./render/terrainPainted";
import { onCellToggleKey, showCellOnHover } from "./ui/debugInfo";

const canvas = document.querySelector<HTMLCanvasElement>("#map");
const infoPanel = document.querySelector<HTMLElement>("#info");
if (!canvas || !infoPanel) throw new Error("index.html is missing #map or #info");

const query = new URLSearchParams(location.search);
const seed = query.get("seed") ?? "realm-forge";
const style = query.get("style") === "painted" ? "painted" : "cel";

const t0 = performance.now();
const world = generateWorld(seed);
const t1 = performance.now();

canvas.width = world.width;
canvas.height = world.height;
const ctx = canvas.getContext("2d")!;

// The terrain never changes, so draw it once into an off-screen canvas and copy it each frame.
const terrain = document.createElement("canvas");
terrain.width = world.width;
terrain.height = world.height;
const terrainCtx = terrain.getContext("2d")!;
const image = style === "painted" ? renderPaintedTerrain(world.heightmap) : renderCelTerrain(world);
terrainCtx.putImageData(image, 0, 0);
drawRivers(terrainCtx, world);
const t2 = performance.now();

let showCells = query.get("debug") === "cells";

function draw(): void {
  ctx.drawImage(terrain, 0, 0);
  if (showCells) drawCellOutlines(ctx, world);
}

draw();
onCellToggleKey(() => {
  showCells = !showCells;
  draw();
});
showCellOnHover(canvas, infoPanel, world);

console.log(
  `Seed "${seed}", style ${style}: world ${(t1 - t0).toFixed(0)} ms, ` +
    `terrain ${(t2 - t1).toFixed(0)} ms, ${world.cells.length} cells`,
);
