// Entry point: generates a world from a seed, draws it, and plays its history.
// Page address options: ?seed=anything picks the world, ?style=cel or ?style=painted switches to an older look.
// Keys: Space play/pause, → step, C cell outlines, N nations, R races, K cultures, F faiths, A alliances, M resources, T towns, H heatmaps, E effects, W armies. Hover the map to inspect a cell.
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
import "@fontsource/im-fell-english-sc/400.css";
import { createRng } from "./core/rng";
import type { NationId, WorldState } from "./core/types";
import { generateWorld } from "./gen";
import { drawAlliances } from "./render/alliances";
import { drawArmies } from "./render/armies";
import { drawChartFrame, drawSailingLines, drawTitlePanel, planChart } from "./render/atlasChart";
import { drawAtlasLand } from "./render/atlasSymbols";
import { drawCellOutlines } from "./render/debug";
import { buildDisplayCells, groupPixelsByCell } from "./render/displayCells";
import { createEffects } from "./render/effects";
import { HEAT_KINDS, renderHeatmap, type HeatKind } from "./render/heatmap";
import { drawHeatmapName, drawYear } from "./render/hud";
import { drawLabels } from "./render/labels";
import { ATLAS_FONTS, LOOK_ATLAS, LOOK_STANDARD } from "./render/palette";
import { createNationOverlay, type OverlayTint } from "./render/overlay";
import { drawResources } from "./render/resources";
import { drawSettlements } from "./render/settlements";
import { drawRivers } from "./render/rivers";
import { renderAtlasTerrain } from "./render/terrainAtlas";
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
const styleParam = query.get("style");
const style = styleParam === "painted" || styleParam === "cel" ? styleParam : "atlas";
const look = style === "atlas" ? LOOK_ATLAS : LOOK_STANDARD;

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
// The parchment map also keeps its rivers and terrain symbols on a layer above the nation
// colors, and works out where its title panel and compass go.
const chart = style === "atlas" ? planChart(world) : null;
const [symbols, symbolsCtx] = offscreen();
if (chart) {
  terrainCtx.putImageData(renderAtlasTerrain(world, chart), 0, 0);
  drawSailingLines(terrainCtx, world, chart);
  drawAtlasLand(symbolsCtx, world, chart);
} else {
  terrainCtx.putImageData(style === "painted" ? renderPaintedTerrain(world.heightmap) : renderCelTerrain(world, displayCells), 0, 0);
  drawRivers(terrainCtx, world);
}

// --- Drawing ---
const layers: Layers = { nations: true, races: false, cultures: false, faiths: false, alliances: true, resources: false, settlements: true, labels: true, effects: true, armies: true, cells: query.get("debug") === "cells" };
/** The Races, Cultures and Faiths layers replace nation colors. Only one shows at a time. */
function overlayTint(): OverlayTint {
  if (layers.faiths) return "faith";
  if (layers.cultures) return "culture";
  return layers.races ? "race" : "nation";
}
let highlight = new Set<NationId>();
let highlightTimer = 0;
/** Which heatmap is showing (H cycles through them), or null for none. */
let heat: HeatKind | null = null;

// Nation colors (and the heatmap) are redrawn only when the world may have changed.
const [nationLayer, nationCtx] = offscreen();
const [heatLayer, heatCtx] = offscreen();
// Animated war and unrest effects (SPEC §5.4g) remember last year themselves.
const cellPixels = groupPixelsByCell(displayCells, world.cells.length);
const effects = createEffects(world, cellPixels, look);
const overlay = createNationOverlay(world, displayCells, cellPixels, look);
// Shares the overlay's memory, so it never needs rebuilding.
const nationImage = new ImageData(new Uint8ClampedArray(overlay.pixels.buffer), world.width, world.height);
function redrawNations(): void {
  overlay.update(state, highlight, overlayTint());
  nationCtx.putImageData(nationImage, 0, 0);
  if (heat) heatCtx.putImageData(renderHeatmap(world, displayCells, state, heat), 0, 0);
  if (layers.effects) effects.refresh(state);
}

// The whole still map is drawn to `base` only when something changes. Every screen
// frame copies it to the page and animates the effects on top (see `present`).
const [base, baseCtx] = offscreen();
function draw(): void {
  baseCtx.drawImage(terrain, 0, 0);
  if (layers.nations) baseCtx.drawImage(nationLayer, 0, 0);
  if (heat) baseCtx.drawImage(heatLayer, 0, 0);
  if (chart) baseCtx.drawImage(symbols, 0, 0);
  if (layers.cells) drawCellOutlines(baseCtx, world);
  if (layers.settlements) drawSettlements(baseCtx, world, state, look);
  if (layers.resources) drawResources(baseCtx, world, look);
  if (layers.alliances) drawAlliances(baseCtx, world, state, look);
  if (layers.nations && layers.labels) drawLabels(baseCtx, world, state, look);
  if (chart) {
    drawChartFrame(baseCtx, world);
    drawTitlePanel(baseCtx, chart, state.year, heat);
  } else {
    drawYear(baseCtx, state.year, world.width);
    if (heat) drawHeatmapName(baseCtx, heat, world.width);
  }
  present(performance.now()); // show it right away, without waiting for the next frame
}

function present(now: number): void {
  ctx.drawImage(base, 0, 0);
  if (layers.effects) effects.draw(ctx, now);
  if (layers.armies) drawArmies(ctx, world, state, (now - yearStart) * controls.speed / 1000, look);
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

/** When the latest year began playing (milliseconds): armies slide along its march. */
let yearStart = 0;

function advanceYear(): void {
  const events = tick(state, simRng);
  yearStart = performance.now();
  eventLog.add(events, state);
  effects.noteYear(state, events, performance.now());
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
  present(now); // every frame, so effects keep moving even while paused
  requestAnimationFrame(frame);
}

// --- Toolbar: world, save/load, video ---
function goTo(newSeed: string, newStyle: string = style): void {
  const params = new URLSearchParams({ seed: newSeed });
  if (newStyle !== "atlas") params.set("style", newStyle);
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
  makeButton(style === "atlas" ? "Classic map" : "Parchment map", "Switch map style (restarts this world from year 0)", () => goTo(seed, style === "atlas" ? "cel" : "atlas")),
);

// --- Settings, keys, hover ---
createSettings(settingsPanel, layers, () => {
  redrawNations(); // the Races, Cultures and Faiths toggles change the overlay itself
  draw();
});
/** Switches a land-tint layer on or off, and any other tint off. */
function toggleTint(layer: "races" | "cultures" | "faiths"): void {
  const on = !layers[layer];
  layers.races = layers.cultures = layers.faiths = false;
  layers[layer] = on;
  redrawNations();
  draw();
}
onKey("r", () => toggleTint("races"));
onKey("k", () => toggleTint("cultures"));
onKey("f", () => toggleTint("faiths"));
// H: no heatmap → each heatmap in turn → none again.
onKey("h", () => {
  const next = heat === null ? 0 : HEAT_KINDS.indexOf(heat) + 1;
  heat = HEAT_KINDS[next] ?? null;
  redrawNations();
  draw();
});
onKey("e", () => {
  layers.effects = !layers.effects;
  if (layers.effects) effects.refresh(state);
  present(performance.now());
});
onKey("w", () => {
  layers.armies = !layers.armies;
  present(performance.now());
});
onKey("t", () => {
  layers.settlements = !layers.settlements;
  draw();
});
onKey("m", () => {
  layers.resources = !layers.resources;
  draw();
});
onKey("a", () => {
  layers.alliances = !layers.alliances;
  draw();
});
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
// Canvas text can't wait for a font, so draw again once the parchment map's fonts arrive.
if (chart) void Promise.all(ATLAS_FONTS.map((font) => document.fonts.load(font))).then(draw);
