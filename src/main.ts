// Entry point: generates a world from a seed, draws it, and plays its history.
// Page address options: ?seed=anything picks the world, ?style=cel or ?style=painted switches to an older look, ?view=3d opens the 3D relief view.
// Keys: Space play/pause, → step, + / − / 0 zoom (or wheel, drag, double-click), C cell outlines, N nations, R races, K cultures, F faiths, A alliances, M resources, T towns, H heatmaps, E effects, W armies, P ruler card, V 3D map. Hover the map to inspect a cell and see its ruler.
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
import "@fontsource/im-fell-english-sc/400.css";
import { createRng } from "./core/rng";
import type { NationId, WorldState } from "./core/types";

import { drawAlliances } from "./render/alliances";
import { drawArmies } from "./render/armies";
import { drawChartFrame, drawSailingLines, drawTitlePanel, planChart } from "./render/atlasChart";
import { drawAtlasLand } from "./render/atlasSymbols";
import { drawCellOutlines } from "./render/debug";
import { lookAt, sameCamera, setView, WHOLE_MAP, type Camera } from "./render/camera";
import { buildDisplayCells, buildViewCells, groupPixelsByCell, type ViewGrid } from "./render/displayCells";
import { createEffects } from "./render/effects";
import { HEAT_KINDS, renderHeatmap, type HeatKind } from "./render/heatmap";
import { drawHeadline, drawHeatmapName, drawYear } from "./render/hud";
import { drawLabels } from "./render/labels";
import { ATLAS_FONTS, LOOK_ATLAS, LOOK_STANDARD } from "./render/palette";
import { markScale } from "./render/marks";
import { createNationOverlay, type NationOverlay, type OverlayTint } from "./render/overlay";
import { drawResources } from "./render/resources";
import { drawSettlements } from "./render/settlements";
import { drawRivers } from "./render/rivers";
import { renderAtlasTerrain } from "./render/terrainAtlas";
import { renderCelTerrain } from "./render/terrainCel";
import { renderPaintedTerrain } from "./render/terrainPainted";
import { drawWarFocus } from "./render/warFocus";
import type { ReliefView } from "./render3d/relief";
import { fromSnapshot, type Snapshot } from "./sim/snapshot";
import { createWorld, startFromText, startToText } from "./sim/start";
import { tick } from "./sim/tick";
import { FOLLOW_SPEED, FOLLOW_ZOOM_MAX, CLICK_SLOP, HIGHLIGHT_SECONDS, MAP_BESIDE_WIDTH, MAX_ZOOM, SIM_YEARS, ZOOM_SHARP_DELAY } from "./ui/config";
import { createControls, makeButton } from "./ui/controls";
import { cellAtPoint, cellUnderMouse, onKey, showCellOnHover, type CellFinder } from "./ui/debugInfo";
import { dispatchesFor, watchRealm } from "./ui/dispatches";
import { createEventLog } from "./ui/eventLog";
import { createRecorder, pickSnapshot, saveSnapshot } from "./ui/files";
import { createHeadlines, headlineText } from "./ui/headlines";
import { createRulerCard } from "./ui/rulerCard";
import { createVersus, pickDuel } from "./ui/versus";
import { applyParams, createSettings, type Layers } from "./ui/settings";
import { createPlayTab } from "./ui/play";
import { createSandbox } from "./ui/sandbox";
import { createWarRoom, nationsOf } from "./ui/warRoom";
import { attachZoom } from "./ui/zoom";

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
const panel = element("#panel");
const rulerCardBox = element("#ruler-card");

// --- Generate the world (or restore a loaded save) ---
const query = new URLSearchParams(location.search);
const seed = query.get("seed") ?? "realm-forge";
const styleParam = query.get("style");
let style = styleParam === "painted" || styleParam === "cel" ? styleParam : "atlas";
let look = style === "atlas" ? LOOK_ATLAS : LOOK_STANDARD;
// ?start=open for the old empty-land start, ?start=5 to 10 for that many old kingdoms (docs/systems/start.md).
const start = startFromText(query.get("start"));

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

const generated = createWorld(seed, start);
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

// The map is drawn at full size and shown as large as fits: beside the panel, in the height
// the controls below it leave (so everything is on one page); on narrow screens, the width.
const mapArea = element("#map-area");
const mainColumn = mapArea.parentElement!;
const wide = matchMedia(`(min-width: ${MAP_BESIDE_WIDTH}px)`);
/** Height of an element with its margins. */
function outerHeight(node: Element): number {
  const css = getComputedStyle(node);
  return node.getBoundingClientRect().height + parseFloat(css.marginTop) + parseFloat(css.marginBottom);
}
// --- 3D relief view (SPEC §5.4n): built the first time it's switched on ---
let relief: ReliefView | null = null;
/** Is the 3D view showing instead of the flat map? */
let show3d = false;
function fitMap(): void {
  const width = mapArea.clientWidth;
  let height = Infinity;
  if (wide.matches) {
    const below = [...mainColumn.children].filter((child) => child !== mapArea).reduce((sum, child) => sum + outerHeight(child), 0);
    height = mainColumn.clientHeight - below;
  }
  const scale = Math.max(0.1, Math.min(width / canvas.width, height / canvas.height));
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
  relief?.setSize(Math.floor(canvas.width * scale), Math.floor(canvas.height * scale));
}
// Refit when the window changes size, or anything below the map grows or shrinks (the settings opening).
const refit = new ResizeObserver(fitMap);
for (const child of [mainColumn, ...mainColumn.children]) refit.observe(child);
addEventListener("resize", fitMap);
fitMap();

// Makes an off-screen canvas the same size as the map.
function offscreen(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = world.width;
  c.height = world.height;
  return [c, c.getContext("2d")!];
}

// The terrain only needs repainting when its map style changes.
const displayCells = buildDisplayCells(world);
const [terrain, terrainCtx] = offscreen();
// The parchment map also keeps its rivers and terrain symbols on a layer above the nation
// colors, and works out where its title panel and compass go.
let chart = style === "atlas" ? planChart(world) : null;
const [symbols, symbolsCtx] = offscreen();
function paintTerrain(): void {
  symbolsCtx.clearRect(0, 0, world.width, world.height);
  if (chart) {
    terrainCtx.putImageData(renderAtlasTerrain(world, chart), 0, 0);
    drawSailingLines(terrainCtx, world, chart);
    drawAtlasLand(symbolsCtx, world, chart);
  } else {
    terrainCtx.putImageData(style === "painted" ? renderPaintedTerrain(world.heightmap) : renderCelTerrain(world, displayCells), 0, 0);
    drawRivers(terrainCtx, world);
  }
}
paintTerrain();

// --- Drawing ---
const layers: Layers = { nations: true, races: false, cultures: false, faiths: false, alliances: true, resources: false, settlements: true, labels: true, effects: true, armies: true, cells: query.get("debug") === "cells", falls: true, headlines: true };
/** The Races, Cultures and Faiths layers replace nation colors. Only one shows at a time. */
function overlayTint(): OverlayTint {
  if (layers.faiths) return "faith";
  if (layers.cultures) return "culture";
  return layers.races ? "race" : "nation";
}
/** Nations of a clicked event, kept bright for a few seconds. */
let eventHighlight = new Set<NationId>();
let highlightTimer = 0;
/** The war being followed (its id), or null (M16 War Room). */
let followed: number | null = null;
const followedRecord = () => (followed === null ? undefined : state.warRecords.find((r) => r.id === followed));
/** Nations to keep bright: a clicked event's for a moment, otherwise the followed war's. */
function highlight(): Set<NationId> {
  if (eventHighlight.size > 0) return eventHighlight;
  const record = followedRecord();
  return record ? new Set(nationsOf(record)) : new Set();
}
/** Which heatmap is showing (H cycles through them), or null for none. */
let heat: HeatKind | null = null;

// Nation colors (and the heatmap) are redrawn only when the world may have changed.
const [nationLayer, nationCtx] = offscreen();
const [heatLayer, heatCtx] = offscreen();
// Animated war and unrest effects (SPEC §5.4g) remember last year themselves.
const cellPixels = groupPixelsByCell(displayCells, world.cells.length);
let effects = createEffects(world, cellPixels, look);
const headlines = createHeadlines(world.cells.filter((c) => c.isLand).length);
let overlay = createNationOverlay(world, displayCells, cellPixels, look);
// Shares the overlay's memory; rebuilt only when a new style replaces the overlay.
let nationImage = new ImageData(new Uint8ClampedArray(overlay.pixels.buffer), world.width, world.height);
function redrawNations(): void {
  overlay.update(state, highlight(), overlayTint(), state.player?.nation);
  nationCtx.putImageData(nationImage, 0, 0);
  if (heat) heatCtx.putImageData(renderHeatmap(world, displayCells, state, heat), 0, 0);
  if (sharp) refreshSharp(sharp);
  if (layers.effects) effects.refresh(state);
}

// --- Zoom (M19) ---
/** What part of the map is on screen. */
let camera: Camera = WHOLE_MAP;
const bounds = { width: world.width, height: world.height, maxZoom: MAX_ZOOM };

/**
 * A zoomed view drawn sharp: terrain, nation colors, heatmap and terrain symbols
 * redrawn for just the part on screen, at screen size. Rebuilt when the view settles;
 * while it moves, the whole-map pictures are stretched instead.
 */
interface SharpView {
  camera: Camera;
  cells: Int32Array;
  overlay: NationOverlay;
  nationImage: ImageData;
  nationCtx: CanvasRenderingContext2D;
  nation: HTMLCanvasElement;
  heatCtx: CanvasRenderingContext2D;
  heat: HTMLCanvasElement;
  /** Only the parchment map's terrain and symbols can be redrawn; the classic maps' are stretched. */
  terrain: HTMLCanvasElement | null;
  symbols: HTMLCanvasElement | null;
}
let sharp: SharpView | null = null;
let sharpTimer = 0;

function buildSharp(): SharpView | null {
  if (camera.zoom === 1) return null;
  const view: ViewGrid = { width: world.width, height: world.height, zoom: camera.zoom, x: camera.x, y: camera.y };
  const cells = buildViewCells(world, view);
  const grid = { width: view.width, height: view.height, cells: world.cells };
  // The tinted band and the played realm's border keep their look: as wide as at zoom 1, grown like a marker.
  const grow = (width: number) => Math.round(width * camera.zoom * markScale(camera.zoom));
  const viewOverlay = createNationOverlay(grid, cells, groupPixelsByCell(cells, world.cells.length), {
    ...look,
    overlayEdgeWidth: grow(look.overlayEdgeWidth),
    playedBorderWidth: grow(look.playedBorderWidth),
  });
  const [nation, viewNationCtx] = offscreen();
  const [heatCanvas, viewHeatCtx] = offscreen();
  let terrainCanvas: HTMLCanvasElement | null = null;
  let symbolCanvas: HTMLCanvasElement | null = null;
  if (chart) {
    const [t, tCtx] = offscreen();
    tCtx.putImageData(renderAtlasTerrain(world, chart, view), 0, 0);
    setView(tCtx, camera);
    drawSailingLines(tCtx, world, chart);
    const [s, sCtx] = offscreen();
    setView(sCtx, camera);
    drawAtlasLand(sCtx, world, chart);
    [terrainCanvas, symbolCanvas] = [t, s];
  }
  const built: SharpView = {
    camera,
    cells,
    overlay: viewOverlay,
    nationImage: new ImageData(new Uint8ClampedArray(viewOverlay.pixels.buffer), view.width, view.height),
    nationCtx: viewNationCtx,
    nation,
    heatCtx: viewHeatCtx,
    heat: heatCanvas,
    terrain: terrainCanvas,
    symbols: symbolCanvas,
  };
  refreshSharp(built);
  return built;
}

/** Brings a sharp view's nation colors and heatmap up to date with the world. */
function refreshSharp(view: SharpView): void {
  view.overlay.update(state, highlight(), overlayTint(), state.player?.nation);
  view.nationCtx.putImageData(view.nationImage, 0, 0);
  if (heat) view.heatCtx.putImageData(renderHeatmap(world, view.cells, state, heat), 0, 0);
}

/** Moves the view. It shows at once, stretched, and is redrawn sharp once it stops moving. */
function setCamera(next: Camera): void {
  // The 3D view wears the whole flat map as its skin, and has a camera of its own.
  if (show3d) next = WHOLE_MAP;
  if (sameCamera(next, camera)) return;
  camera = next;
  canvas.classList.toggle("zoomed", camera.zoom > 1);
  draw();
  clearTimeout(sharpTimer);
  sharpTimer = window.setTimeout(() => {
    sharp = buildSharp();
    draw();
  }, ZOOM_SHARP_DELAY);
}

// The whole still map is drawn to `base` only when something changes. Every screen
// frame copies it to the page and animates the effects on top (see `present`).
const [base, baseCtx] = offscreen();
baseCtx.imageSmoothingQuality = "high";
/** Draws one picture layer: the sharp view's if it has one, otherwise the whole-map picture through the camera. */
function layer(view: HTMLCanvasElement | null | undefined, whole: HTMLCanvasElement): void {
  if (view) baseCtx.setTransform(1, 0, 0, 1, 0, 0);
  else setView(baseCtx, camera);
  baseCtx.drawImage(view ?? whole, 0, 0);
}
function draw(): void {
  const view = sharp && sameCamera(sharp.camera, camera) ? sharp : null;
  baseCtx.setTransform(1, 0, 0, 1, 0, 0);
  baseCtx.clearRect(0, 0, base.width, base.height);
  layer(view?.terrain, terrain);
  if (layers.nations) layer(view?.nation, nationLayer);
  if (heat) layer(view?.heat, heatLayer);
  if (chart) layer(view?.symbols, symbols);
  // Lines, markers and names are drawn through the camera, so they're sharp at any zoom.
  setView(baseCtx, camera);
  if (layers.cells) drawCellOutlines(baseCtx, world);
  if (layers.settlements) drawSettlements(baseCtx, world, state, look);
  if (layers.resources) drawResources(baseCtx, world, look);
  if (layers.alliances) drawAlliances(baseCtx, world, state, look);
  const record = followedRecord();
  if (record) drawWarFocus(baseCtx, world, state, record);
  if (layers.nations && layers.labels) drawLabels(baseCtx, world, state, look);
  if (chart) drawChartFrame(baseCtx, world);
  // The title panel and year stay put on screen, whatever the zoom.
  baseCtx.setTransform(1, 0, 0, 1, 0, 0);
  if (chart) {
    drawTitlePanel(baseCtx, chart, state.year, heat);
  } else {
    drawYear(baseCtx, state.year, world.width);
    if (heat) drawHeatmapName(baseCtx, heat, world.width);
  }
  present(performance.now()); // show it right away, without waiting for the next frame
}

function present(now: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(base, 0, 0);
  setView(ctx, camera);
  if (layers.effects) effects.draw(ctx, now);
  if (layers.armies) drawArmies(ctx, world, state, (now - yearStart) * controls.speed / 1000, look);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // The headline stays put on screen, like the year. It is asked for every frame so its clock keeps time.
  const headline = headlines.current(now, controls.playing);
  if (headline && layers.headlines) drawHeadline(ctx, headline.text, headline.color, headline.alpha, world.width, world.height);
}

// --- Event log (click an event → its nations light up for a few seconds) ---
const eventLog = createEventLog(logFilters, logList, (nations) => {
  eventHighlight = new Set(nations);
  redrawNations();
  draw();
  clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(() => {
    eventHighlight = new Set();
    redrawNations();
    draw();
  }, HIGHLIGHT_SECONDS * 1000);
});
eventLog.add(state.events, state);

// --- War Room (M16): the side panel's wars, and following one ---
/** The speed before following slowed playback down, to go back to afterwards. */
let speedBefore: number | null = null;
// The Sandbox tab (M17): god commands go to the rules, then the screen catches up.
const sandbox = createSandbox(element("#tab-sandbox"), {
  state: () => state,
  world,
  pause: () => controls.pause(),
  changed(events) {
    eventLog.add(events, state);
    redrawNations();
    draw();
    warRoom.update(state);
  },
});
// The Play tab (M20): taking over a nation and its policies are orders, as god commands are.
const playTab = createPlayTab(element("#tab-play"), {
  state: () => state,
  pause: () => controls.pause(),
  changed(events) {
    eventLog.add(events, state);
    redrawNations();
    draw();
    warRoom.update(state);
  },
  follow: (war) => follow(war),
  resume: () => controls.play(),
});
const warRoom = createWarRoom(panel, () => followed, follow, {
  sandbox: { update: sandbox.update, opened: () => controls.pause() },
  // Opening it pauses only to choose a nation; a player keeps it open while time runs.
  play: { update: playTab.update, opened: () => state.player === undefined && controls.pause() },
});

/** Starts following a war (dimming everyone else and slowing time), or stops with null. */
function follow(id: number | null): void {
  if (id !== null && followed === null && controls.speed > FOLLOW_SPEED) {
    speedBefore = controls.speed;
    controls.setSpeed(FOLLOW_SPEED);
  }
  if (id === null && speedBefore !== null) {
    controls.setSpeed(speedBefore);
    speedBefore = null;
  }
  followed = id;
  const record = followedRecord();
  if (record) setCamera(warView(record.attacker, record.defender));
  warRoom.update(state);
  redrawNations();
  draw();
}

/** A view of both sides' capitals, with room around them. */
function warView(a: NationId, b: NationId): Camera {
  const [ax, ay] = world.cells[state.nations.get(a)!.capital]!.site;
  const [bx, by] = world.cells[state.nations.get(b)!.capital]!.site;
  // Fit the two capitals inside the middle half of the screen.
  const fit = Math.min(world.width / 2 / Math.max(1, Math.abs(ax - bx)), world.height / 2 / Math.max(1, Math.abs(ay - by)));
  return lookAt((ax + bx) / 2, (ay + by) / 2, Math.min(FOLLOW_ZOOM_MAX, fit), bounds);
}

/** After a year: pause on the followed war's big moments, and show its report when it ends. */
function watchFollowed(): void {
  const record = followedRecord();
  if (!record) return;
  if (record.end !== undefined) {
    controls.pause();
    follow(null);
    warRoom.showReport(record, state);
    return;
  }
  if (record.moments.some((m) => m.year === state.year && m.kind !== "joined")) controls.pause();
}

// --- History playback ---
const simRng = createRng(seed).fork("sim");

/** When the latest year began playing (milliseconds): armies slide along its march. */
let yearStart = 0;

// Hover a nation to see its ruler; a great ruler's rise shows on its own.
const rulerCard = createRulerCard(rulerCardBox);
// The versus screen measures the page when it opens: the map shown, and where the controls below it end.
const versus = createVersus(
  element("#versus"),
  () => (show3d && relief ? relief.canvas : canvas).getBoundingClientRect(),
  () => element("#settings").getBoundingClientRect().bottom,
);

function advanceYear(): void {
  const realmBefore = watchRealm(state);
  const events = tick(state, simRng);
  yearStart = performance.now();
  eventLog.add(events, state);
  effects.noteYear(state, events, performance.now());
  headlines.noteYear(state, events, performance.now());
  watchFollowed();
  // Playing (M20): pause on what happened to your realm, and say what it was.
  const news = dispatchesFor(state, events, realmBefore).filter((d) => playTab.wants(d.kind));
  if (news.length > 0) {
    controls.pause();
    warRoom.showTab("play");
    playTab.showDispatches(state.year, news);
  }
  // The last year: what became of the realms you played, and your people.
  if (state.player && state.year === SIM_YEARS) {
    controls.pause();
    warRoom.showTab("play");
    playTab.showSummary(state);
  }
  for (const event of events) {
    const nation = event.type === "ruler" ? state.nations.get(event.actors[0]!) : undefined;
    // A great ruler crowned this year is a rise (other ruler events are deaths and crises).
    if (nation?.alive && nation.ruler.great !== undefined && nation.ruler.crowned === state.year) rulerCard.announce(nation);
  }
  // A realm that died this year, however it died: its last ruler's card burns. If several fell, the last is shown.
  if (layers.falls) {
    // A conquered realm of some size gets the versus screen: its ruler faces the conqueror's, then burns there.
    const duel = versus.busy ? null : pickDuel(events, headlines.peakOf);
    const winner = duel && state.nations.get(duel.winner);
    const loser = duel && state.nations.get(duel.loser);
    if (duel && winner?.alive && loser) versus.show(winner, loser, headlineText(duel.event.text));
    for (const nation of state.nations.values()) {
      if (!nation.alive && nation.fell === state.year && !(winner?.alive && nation === loser)) rulerCard.fall(nation);
    }
  }
}

const controls = createControls(bar, () => {
  advanceYear();
  redrawNations();
  draw();
  warRoom.update(state);
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
    // Something in a year can pause playback (the followed war's big moments): stop there.
    while (yearsDue >= 1 && state.year < SIM_YEARS && controls.playing) {
      advanceYear();
      yearsDue -= 1;
      ran++;
    }
    if (state.year >= SIM_YEARS) controls.pause();
    if (ran > 0) {
      redrawNations();
      draw();
      warRoom.update(state);
    }
  } else {
    yearsDue = 0;
  }
  present(now); // every frame, so effects keep moving even while paused
  if (show3d) relief?.render(); // the 3D view copies the picture just drawn
  requestAnimationFrame(frame);
}

// --- Toolbar: world, save/load, video ---
/** Rebuilds only the drawing layers, keeping the world and all its controls in place. */
function switchMapStyle(): void {
  style = style === "atlas" ? "cel" : "atlas";
  look = style === "atlas" ? LOOK_ATLAS : LOOK_STANDARD;
  chart = style === "atlas" ? planChart(world) : null;
  paintTerrain();
  effects = createEffects(world, cellPixels, look);
  overlay = createNationOverlay(world, displayCells, cellPixels, look);
  nationImage = new ImageData(new Uint8ClampedArray(overlay.pixels.buffer), world.width, world.height);
  clearTimeout(sharpTimer);
  sharp = buildSharp();
  redrawNations();
  draw();
  styleButton.textContent = style === "atlas" ? "Classic map" : "Parchment map";
  const url = new URL(location.href);
  if (style === "atlas") url.searchParams.delete("style");
  else url.searchParams.set("style", style);
  history.replaceState(null, "", url);
  if (chart) void Promise.all(ATLAS_FONTS.map((font) => document.fonts.load(font))).then(draw);
}
const styleButton = makeButton(style === "atlas" ? "Classic map" : "Parchment map", "Switch map style while keeping your progress", switchMapStyle);

/**
 * Switches between the flat map and the 3D relief view, keeping the world as it is.
 * `await import(...)` fetches the 3D code (and three.js) only now, so people who never
 * use 3D never download it.
 */
async function switchView(): Promise<void> {
  if (!relief) {
    try {
      const { createReliefView } = await import("./render3d/relief");
      relief = createReliefView(world, canvas);
      relief.canvas.id = "map3d";
      canvas.after(relief.canvas);
      const view = relief;
      attachMapMouse(view.canvas, (event) => {
        const point = view.mapPointAt(event);
        return point ? cellAtPoint(world, ...point) : undefined;
      });
    } catch (error) {
      alert(`This browser can't show the 3D map: ${(error as Error).message}`);
      return;
    }
  }
  if (!show3d) setCamera(WHOLE_MAP); // before the switch: afterwards the flat camera stays put
  show3d = !show3d;
  canvas.style.display = show3d ? "none" : "";
  relief.canvas.style.display = show3d ? "block" : "none";
  fitMap();
  viewButton.textContent = show3d ? "Flat map" : "3D map";
  const url = new URL(location.href);
  if (show3d) url.searchParams.set("view", "3d");
  else url.searchParams.delete("view");
  history.replaceState(null, "", url);
}
const viewButton = makeButton("3D map", "Show the map as raised terrain you can swing around (key V): drag to turn, wheel to zoom, right-drag to slide", () => void switchView());

function goTo(newSeed: string, newStyle: string = style, newStart: string = startToText(start)): void {
  const params = new URLSearchParams({ seed: newSeed });
  if (newStyle !== "atlas") params.set("style", newStyle);
  if (show3d) params.set("view", "3d");
  params.set("start", newStart);
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

// How history opens: old kingdoms (5 to 10) sharing the land, or small nations in empty land.
const startPicker = document.createElement("select");
startPicker.title = "How history opens (restarts this world from year 0)";
for (const value of ["5", "6", "7", "8", "9", "10", "open"]) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value === "open" ? "Open land" : `${value} kingdoms`;
  startPicker.append(option);
}
startPicker.value = startToText(start);
startPicker.addEventListener("change", () => goTo(seed, style, startPicker.value));

bar.append(
  spacer,
  startPicker,
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
  makeButton("Whole map", "Zoom out to show the whole map (key 0). Zoom in with the mouse wheel, double-click or +, and drag to move.", () => setCamera(WHOLE_MAP)),
  recordButton,
  styleButton,
  viewButton,
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
onKey("p", () => rulerCard.toggle());
onKey("v", () => void switchView());
/**
 * What the mouse does on a map picture, flat or 3D: hover to inspect a cell and see its
 * ruler, click a realm to pick it as your war target. `cellAt` finds the cell under the mouse.
 * (A `function` declaration, so `switchView` above can call it.)
 */
function attachMapMouse(target: HTMLCanvasElement, cellAt: CellFinder): void {
  showCellOnHover(target, infoPanel, () => state, cellAt);
  target.addEventListener("mousemove", (event) => {
    const cell = cellAt(event);
    rulerCard.hover((cell && state.nations.get(state.state.owner[cell.id]!)) ?? null);
  });
  target.addEventListener("mouseleave", () => rulerCard.hover(null));
  // Playing (M20): click a realm to pick it as your war target. A drag to move the map isn't a click.
  let pressedAt: [number, number] = [0, 0];
  target.addEventListener("mousedown", (event) => (pressedAt = [event.clientX, event.clientY]));
  target.addEventListener("click", (event) => {
    if (!state.player || Math.hypot(event.clientX - pressedAt[0], event.clientY - pressedAt[1]) > CLICK_SLOP) return;
    const cell = cellAt(event);
    const owner = cell ? state.state.owner[cell.id]! : 0;
    if (owner === 0) return;
    warRoom.showTab("play");
    playTab.pickTarget(owner);
  });
}
attachMapMouse(canvas, (event) => cellUnderMouse(canvas, world, event, camera));
attachZoom(canvas, bounds, () => camera, setCamera);

redrawNations();
draw();
warRoom.update(state);
requestAnimationFrame(frame);
// ?view=3d opens straight into the 3D view.
if (query.get("view") === "3d") void switchView();
// Canvas text can't wait for a font, so draw again once the parchment map's fonts arrive.
if (chart) void Promise.all(ATLAS_FONTS.map((font) => document.fonts.load(font))).then(draw);
