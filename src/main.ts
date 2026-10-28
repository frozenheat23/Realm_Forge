// Entry point: generates a world from a seed, draws it, and plays its history.
// Page address options: ?seed=anything picks the world, ?style=painted switches the look.
// Keys: Space play/pause, → step, C cell outlines, N nations. Hover the map to inspect a cell.
import { createRng } from "./core/rng";
import type { NationId, WorldState } from "./core/types";
import { generateWorld } from "./gen";
import { drawCellOutlines } from "./render/debug";
import { buildDisplayCells } from "./render/displayCells";
import { drawYear } from "./render/hud";
import { drawLabels } from "./render/labels";
import { renderNationOverlay } from "./render/overlay";
import { drawRivers } from "./render/rivers";
import { renderCelTerrain } from "./render/terrainCel";
import { renderPaintedTerrain } from "./render/terrainPainted";
import { fromSnapshot, type Snapshot } from "./sim/snapshot";
import { tick } from "./sim/tick";
import { HIGHLIGHT_SECONDS, SIM_YEARS } from "./ui/config";
import { createControls, makeButton } from "./ui/controls";
import { onKey, showCellOnHover } from "./ui/debugInfo";
import { createEventLog } from "./ui/eventLog";
import { createRecorder, pickSnapshot, saveSnapshot } from "./ui/files";
import { applyParams, createSettings, type Layers } from "./ui/settings";

// --- Page elements ---
function element<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`index.html is missing ${selector}`);
  return el;
}
const canvas = element<HTMLCanvasElement>("#map");
const bar = element("#bar");
const infoPanel = element("#info");
const settingsPanel = element("#settings");
const logFilters = element("#log-filters");
const logList = element("#log");

// --- Generate the world (or restore a loaded save) ---
const query = new URLSearchParams(location.search);
const seed = query.get("seed") ?? "realm-forge";
const style = query.get("style") === "painted" ? "painted" : "cel";

// A save file picked with "Load" waits in sessionStorage while the page reloads with its seed.
const LOAD_KEY = "realm-forge-load";
function takePendingLoad(): Snapshot | null {
  try {
    const text = sessionStorage.getItem(LOAD_KEY);
    sessionStorage.removeItem(LOAD_KEY);
    return text ? (JSON.parse(text) as Snapshot) : null;
  } catch {
    return null;
  }
}

const generated = generateWorld(seed);
const world = generated.world;
let state: WorldState = generated.state;
const pending = takePendingLoad();
if (pending && pending.seed === seed) {
  try {
    state = fromSnapshot(pending, world);
    applyParams(pending.params);
  } catch (error) {
    alert(`Couldn't load that save: ${(error as Error).message}`);
  }
}

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

// --- Drawing ---
const layers: Layers = { nations: true, labels: true, cells: query.get("debug") === "cells" };
let highlight = new Set<NationId>();
let highlightTimer = 0;

// Nation colors are redrawn only when borders may have changed.
const [nationLayer, nationCtx] = offscreen();
function redrawNations(): void {
  nationCtx.putImageData(renderNationOverlay(world, displayCells, state, highlight), 0, 0);
}

function draw(): void {
  ctx.drawImage(terrain, 0, 0);
  if (layers.nations) ctx.drawImage(nationLayer, 0, 0);
  if (layers.cells) drawCellOutlines(ctx, world);
  if (layers.nations && layers.labels) drawLabels(ctx, world, state);
  drawYear(ctx, state.year, world.width);
}

// --- Event log (click an event → its nations light up for a few seconds) ---
const eventLog = createEventLog(logFilters, logList, (nations) => {
  highlight = new Set(nations);
  redrawNations();
  draw();
  clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(() => {
    highlight = new Set();
    redrawNations();
    draw();
  }, HIGHLIGHT_SECONDS * 1000);
});
eventLog.add(state.events, state);

// --- History playback ---
const simRng = createRng(seed).fork("sim");

function advanceYear(): void {
  const events = tick(state, simRng);
  eventLog.add(events, state);
}

const controls = createControls(bar, () => {
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

// --- Toolbar: world, save/load, video ---
function goTo(newSeed: string): void {
  const params = new URLSearchParams({ seed: newSeed });
  if (style === "painted") params.set("style", "painted");
  location.search = params.toString();
}

const spacer = document.createElement("span");
spacer.className = "spacer";
const seedBox = document.createElement("input");
seedBox.type = "text";
seedBox.value = seed;
seedBox.title = "World seed: same seed = same world and history";
seedBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter") goTo(seedBox.value.trim() || seed);
});

const recorder = createRecorder(canvas, () => `realm-forge-${seed}.webm`);
const recordButton = makeButton("Record", "Record the map as a WebM video", () => {
  if (recorder.recording) recorder.stop();
  else recorder.start();
  recordButton.textContent = recorder.recording ? "Stop recording" : "Record";
  recordButton.classList.toggle("recording", recorder.recording);
});

bar.append(
  spacer,
  seedBox,
  makeButton("New world", "Generate the world for the seed in the box", () => goTo(seedBox.value.trim() || seed)),
  makeButton("Random", "Generate a world from a new random seed", () => goTo(`world-${Date.now().toString(36)}`)),
  makeButton("Save", "Download this moment in history as a file", () => saveSnapshot(state)),
  makeButton("Load", "Continue from a saved file", async () => {
    try {
      const snapshot = await pickSnapshot();
      sessionStorage.setItem(LOAD_KEY, JSON.stringify(snapshot));
      goTo(snapshot.seed);
    } catch (error) {
      alert(`Couldn't read that file: ${(error as Error).message}`);
    }
  }),
  recordButton,
);

// --- Settings, keys, hover ---
createSettings(settingsPanel, layers, () => draw());
onKey("c", () => {
  layers.cells = !layers.cells;
  draw();
});
onKey("n", () => {
  layers.nations = !layers.nations;
  draw();
});
showCellOnHover(canvas, infoPanel, world, () => state);

redrawNations();
draw();
requestAnimationFrame(frame);
