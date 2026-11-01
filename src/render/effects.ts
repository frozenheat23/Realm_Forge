// War and unrest effects (SPEC §5.4g): animation drawn on top of the map every screen frame.
// Only reads the world. It remembers last year's owners itself, to spot what changed.
import type { GeneratedWorld } from "../gen";
import type { CellId, SimEvent, WorldState } from "../core/types";
import { pairKey } from "../sim/helpers";
import { SIM } from "../sim/params";
import { cellPhase, hotCells, restlessCells, siegeCells } from "./changes";
import type { CellPixels } from "./displayCells";
import { hexToRgb } from "./color";
import {
  BATTLE_RADIUS,
  BATTLE_RING_WIDTH,
  BATTLE_SECONDS,
  BATTLE_SWORD_COLOR,
  BATTLE_SWORD_SIZE,
  CEL_INK_COLOR,
  COLLAPSE_COLOR,
  EMBER_COLOR,
  EMBER_DENSITY,
  EMBER_FLICKER,
  EMBER_MIN_UNREST,
  EMBER_SIZE,
  EVENT_BURST_RADIUS,
  EVENT_BURST_SECONDS,
  EVENT_RING_WIDTH,
  MAX_BURSTS,
  OCCUPIED_HATCH_ALPHA,
  OCCUPIED_HATCH_SPACING,
  OCCUPIED_HATCH_SPEED,
  OCCUPIED_HATCH_WIDTH,
  SIEGE_RING_COLOR,
  SIEGE_RING_RADIUS,
  SIEGE_RING_WIDTH,
  SMOKE_ALPHA,
  SMOKE_COLOR,
  SMOKE_MIN_DEVASTATION,
  SMOKE_RISE,
  SMOKE_SECONDS,
  SMOKE_SIZE,
  WAR_FRONT_COLOR,
} from "./palette";

/** A short flash: a battle, or a nation rising or falling. `start` is in milliseconds. */
interface Burst {
  kind: "battle" | "event";
  x: number;
  y: number;
  color: string;
  start: number;
  /** Battles between the same two nations share a key: a new one replaces the old (no pile-up at high speed). */
  key?: number;
}

export interface Effects {
  /** Call after each simulated year with that year's events. `now` = milliseconds. */
  noteYear(state: WorldState, events: SimEvent[], now: number): void;
  /** Call when the map is redrawn: finds the current occupations, sieges, smoke and embers. */
  refresh(state: WorldState): void;
  /** Draws one frame of animation on top of the map. */
  draw(ctx: CanvasRenderingContext2D, now: number): void;
}

const TAU = Math.PI * 2;

export function createEffects(world: GeneratedWorld, cellPixels: CellPixels): Effects {
  const { width, height, cells } = world;

  let bursts: Burst[] = [];

  // Refreshed with the map: which cells smoke or glow, and how strongly.
  let smoke: CellId[] = [];
  let smokeStrength = new Float32Array(0);
  let embers: CellId[] = [];
  let sieges: CellId[] = [];
  let siegeProgress = new Float32Array(0);
  let hasOccupied = false;
  // The mask as drawn: only cells whose occupier changed get repainted.
  const shownOccupier = new Int32Array(cells.length);

  // Off-screen canvases: occupied cells in their occupier's color, and a scratch canvas to hatch them on.
  const [occupiedMask, maskCtx] = makeCanvas(width, height);
  const [hatch, hatchCtx] = makeCanvas(width, height);
  const maskImage = maskCtx.createImageData(width, height);
  const maskPixels = new Uint32Array(maskImage.data.buffer);
  const stripes = hatchCtx.createPattern(stripeTile(), "repeat")!;
  const smokeSprite = glowSprite(SMOKE_COLOR);
  const emberSprite = glowSprite(EMBER_COLOR);

  function addBurst(burst: Burst): void {
    if (burst.key !== undefined) bursts = bursts.filter((b) => b.key !== burst.key);
    bursts.push(burst);
    if (bursts.length > MAX_BURSTS) bursts.shift(); // oldest gives way
  }

  function noteYear(state: WorldState, events: SimEvent[], now: number): void {
    for (const battle of state.battles) {
      const color = state.nations.get(battle.winner)?.color ?? WAR_FRONT_COLOR;
      const [x, y] = cells[battle.cell]!.site;
      addBurst({ kind: "battle", x, y, color, start: now, key: pairKey(battle.winner, battle.loser) });
    }

    for (const event of events) {
      const nation = state.nations.get(event.actors[0]!);
      if (!nation) continue;
      const falls = event.type === "collapse" || event.type === "annexed";
      if (!falls && event.type !== "rebellion" && event.type !== "founded") continue;
      const [x, y] = cells[nation.capital]!.site;
      addBurst({ kind: "event", x, y, color: falls ? COLLAPSE_COLOR : nation.color, start: now });
    }
  }

  function refresh(state: WorldState): void {
    const { owner, devastation } = state.state;
    smoke = hotCells(devastation, owner, SMOKE_MIN_DEVASTATION);
    smokeStrength = Float32Array.from(smoke, (c) => devastation[c]!);
    embers = restlessCells(state, EMBER_MIN_UNREST, SIM.REBEL_THRESHOLD, EMBER_DENSITY);

    sieges = siegeCells(state);
    siegeProgress = Float32Array.from(sieges, (c) => state.state.siege[c]!);
    paintOccupied(state);
  }

  /** Paints every pixel of an occupied cell in its occupier's color; everything else stays clear. */
  function paintOccupied(state: WorldState): void {
    const { occupier } = state.state;
    hasOccupied = occupier.some((id) => id !== 0);
    let changed = false;
    for (let c = 0; c < cells.length; c++) {
      const id = occupier[c]!;
      if (id === shownOccupier[c]) continue;
      shownOccupier[c] = id;
      changed = true;
      let color = 0;
      if (id !== 0) {
        const [r, g, b] = hexToRgb(state.nations.get(id)?.color ?? WAR_FRONT_COLOR);
        color = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; // pixels are stored as ABGR
      }
      for (let p = cellPixels.start[c]!; p < cellPixels.start[c + 1]!; p++) maskPixels[cellPixels.pixels[p]!] = color;
    }
    if (changed) maskCtx.putImageData(maskImage, 0, 0);
  }

  function draw(ctx: CanvasRenderingContext2D, now: number): void {
    const seconds = now / 1000;
    ctx.save();
    if (hasOccupied) drawOccupiedHatch(ctx, seconds);
    drawSiegeRings(ctx);
    drawSmoke(ctx, seconds);
    drawEmbers(ctx, seconds);
    bursts = bursts.filter((b) => drawBurst(ctx, b, now));
    ctx.restore();
  }

  function drawOccupiedHatch(ctx: CanvasRenderingContext2D, seconds: number): void {
    // Copy the colored cells, then "destination-in" keeps them only where the stripes are.
    hatchCtx.globalCompositeOperation = "copy";
    hatchCtx.drawImage(occupiedMask, 0, 0);
    hatchCtx.globalCompositeOperation = "destination-in";
    const offset = (seconds * OCCUPIED_HATCH_SPEED) % OCCUPIED_HATCH_SPACING;
    stripes.setTransform(new DOMMatrix().translateSelf(offset, 0));
    hatchCtx.fillStyle = stripes;
    hatchCtx.fillRect(0, 0, width, height);
    ctx.globalAlpha = OCCUPIED_HATCH_ALPHA;
    ctx.drawImage(hatch, 0, 0);
    ctx.globalAlpha = 1;
  }

  /** A ring around each besieged cell, closing as the siege nears its end. */
  function drawSiegeRings(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = SIEGE_RING_COLOR;
    ctx.lineWidth = SIEGE_RING_WIDTH;
    for (let i = 0; i < sieges.length; i++) {
      const [x, y] = cells[sieges[i]!]!.site;
      ctx.beginPath();
      ctx.arc(x, y, SIEGE_RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + TAU * siegeProgress[i]!);
      ctx.stroke();
    }
  }

  function drawSmoke(ctx: CanvasRenderingContext2D, seconds: number): void {
    for (let i = 0; i < smoke.length; i++) {
      const cell = smoke[i]!;
      const [sx, sy] = cells[cell]!.site;
      const phase = cellPhase(cell);
      // Two puffs per cell, half a cycle apart, so there's always one rising.
      for (let k = 0; k < 2; k++) {
        const t = (seconds / SMOKE_SECONDS + phase + k * 0.5) % 1; // 0 = just born, 1 = gone
        const size = SMOKE_SIZE * (0.6 + t);
        const x = sx + Math.sin(t * TAU + phase * 6) * 2;
        const y = sy - t * SMOKE_RISE;
        ctx.globalAlpha = SMOKE_ALPHA * smokeStrength[i]! * Math.sin(Math.PI * t); // fade in, then out
        ctx.drawImage(smokeSprite, x - size, y - size, size * 2, size * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(ctx: CanvasRenderingContext2D, seconds: number): void {
    for (const cell of embers) {
      const [x, y] = cells[cell]!.site;
      const wave = seconds * EMBER_FLICKER + cellPhase(cell) * TAU;
      const size = EMBER_SIZE * (0.85 + 0.15 * Math.sin(wave * 1.7));
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(wave);
      ctx.drawImage(emberSprite, x - size, y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  }

  /** Draws one burst; returns false once it has finished (so it's dropped). */
  function drawBurst(ctx: CanvasRenderingContext2D, b: Burst, now: number): boolean {
    const seconds = b.kind === "battle" ? BATTLE_SECONDS : EVENT_BURST_SECONDS;
    const p = (now - b.start) / 1000 / seconds; // progress 0..1
    if (p >= 1) return false;
    if (p < 0) return true; // not started yet
    const fade = 1 - p;
    if (b.kind === "battle") {
      ring(ctx, b.x, b.y, BATTLE_RADIUS * easeOut(p), BATTLE_RING_WIDTH * fade, b.color, fade);
      swords(ctx, b.x, b.y, fade);
    } else {
      // Two rings: the inner one starts a fifth of the way in and spreads 60% as far.
      ring(ctx, b.x, b.y, EVENT_BURST_RADIUS * easeOut(p), EVENT_RING_WIDTH * fade, b.color, fade);
      const p2 = Math.max(0, p - 0.2) / 0.8;
      ring(ctx, b.x, b.y, EVENT_BURST_RADIUS * 0.6 * easeOut(p2), EVENT_RING_WIDTH * fade, b.color, fade);
    }
    return true;
  }

  return { noteYear, refresh, draw };
}

/** Fast at first, slowing at the end: feels like a shockwave. */
function easeOut(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lineWidth: number, color: string, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Two crossed blades with a dark outline, fading with `alpha`. */
function swords(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  const s = BATTLE_SWORD_SIZE;
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  // Draw each stroke twice: thick and dark underneath, thin and light on top.
  for (const [color, w] of [[CEL_INK_COLOR, 4], [BATTLE_SWORD_COLOR, 2]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    // Blades corner to corner, plus a short crossguard near each hilt.
    ctx.moveTo(x - s, y + s);
    ctx.lineTo(x + s, y - s);
    ctx.moveTo(x + s, y + s);
    ctx.lineTo(x - s, y - s);
    ctx.moveTo(x - s * 0.9, y + s * 0.3);
    ctx.lineTo(x - s * 0.3, y + s * 0.9);
    ctx.moveTo(x + s * 0.9, y + s * 0.3);
    ctx.lineTo(x + s * 0.3, y + s * 0.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return [c, c.getContext("2d")!];
}

/** One square tile of a diagonal stripe; repeated, it makes seamless hatching. */
function stripeTile(): HTMLCanvasElement {
  const s = OCCUPIED_HATCH_SPACING;
  const [tile, t] = makeCanvas(s, s);
  t.strokeStyle = "#000"; // only its shape matters: the colors come from the mask
  t.lineWidth = OCCUPIED_HATCH_WIDTH;
  t.beginPath();
  // The main diagonal, plus the two corner pieces that join it to the next tiles.
  t.moveTo(0, s);
  t.lineTo(s, 0);
  t.moveTo(-s / 2, s / 2);
  t.lineTo(s / 2, -s / 2);
  t.moveTo(s / 2, s * 1.5);
  t.lineTo(s * 1.5, s / 2);
  t.stroke();
  return tile;
}

/** A soft round blob, solid in the middle and fading to clear at the edge. `rgb` = "R, G, B". */
function glowSprite(rgb: string): HTMLCanvasElement {
  const size = 32;
  const [sprite, g] = makeCanvas(size, size);
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${rgb}, 1)`);
  gradient.addColorStop(0.5, `rgba(${rgb}, 0.6)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return sprite;
}
