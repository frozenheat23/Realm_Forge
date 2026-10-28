// Entry point: generates a world from a seed, draws it, and plays its history.
// Page address options: ?seed=anything picks the world, ?style=painted switches the look.
// Keys: Space play/pause, → step, C cell outlines, N nations. Hover the map to inspect a cell.
import { createRng } from "./core/rng";
import { generateWorld } from "./gen";
import { drawCellOutlines } from "./render/debug";
import { buildDisplayCells } from "./render/displayCells";
import { drawLabels } from "./render/labels";
import { renderNationOverlay } from "./render/overlay";
import { drawRivers } from "./render/rivers";
import { renderCelTerrain } from "./render/terrainCel";
import { renderPaintedTerrain } from "./render/terrainPainted";
import { tick } from "./sim/tick";
import { SIM_YEARS } from "./ui/config";
import { createControls } from "./ui/controls";
import { onKey, showCellOnHover } from "./ui/debugInfo";
import { createEventLog } from "./ui/eventLog";

const canvas = document.querySelector<HTMLCanvasElement>("#map");
const infoPanel = document.querySelector<HTMLElement>("#info");
const bar = document.querySelector<HTMLElement>("#bar");
const yearLabel = document.querySelector<HTMLElement>("#year");
const logPanel = document.querySelector<HTMLElement>("#log");
if (!canvas || !infoPanel || !bar || !yearLabel || !logPanel) throw new Error("index.html is missing an element");

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

// Nation colors are redrawn only when borders may have changed.
const [nationLayer, nationCtx] = offscreen();
function redrawNations(): void {
  nationCtx.putImageData(renderNationOverlay(world, displayCells, state), 0, 0);
}
redrawNations();
const t2 = performance.now();

let showCells = query.get("debug") === "cells";
let showNations = true;

function draw(): void {
  ctx.drawImage(terrain, 0, 0);
  if (showNations) ctx.drawImage(nationLayer, 0, 0);
  if (showCells) drawCellOutlines(ctx, world);
  if (showNations) drawLabels(ctx, world, state);
}

// --- History playback ---
const simRng = createRng(seed).fork("sim");
const eventLog = createEventLog(logPanel);
eventLog.add(state.events, state); // the year-0 foundings

function advanceYear(): void {
  const events = tick(state, simRng);
  eventLog.add(events, state);
  controls.showYear(state.year);
}

const controls = createControls(bar, yearLabel, () => {
  advanceYear();
  redrawNations();
  draw();
});

// Runs every screen frame (~60 times a second). Works out how many years are
// due at the current speed, runs them, then redraws once.
let lastTime = performance.now();
let yearsDue = 0;
function frame(now: number): void {
  const seconds = Math.min(0.25, (now - lastTime) / 1000); // cap, in case the tab was hidden
  lastTime = now;
  if (controls.playing) {
    yearsDue += seconds * controls.speed;
    let ran = 0;
    while (yearsDue >= 1 && state.year < SIM_YEARS) {
      advanceYear();
      yearsDue -= 1;
      ran++;
    }
    if (state.year >= SIM_YEARS) controls.pause();
    if (ran > 0) {
      redrawNations();
      draw();
    }
  } else {
    yearsDue = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

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
