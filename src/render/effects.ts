// War and unrest effects (SPEC §5.4g): animation drawn on top of the map every screen frame.
// Only reads the world. It remembers last year's owners itself, to spot what changed.
import type { GeneratedWorld } from "../gen";
import type { CellId, SimEvent, WorldState } from "../core/types";
import { pairKey } from "../sim/helpers";
import { SIM } from "../sim/params";
import { allFrontCells } from "../sim/war";
import { cellPhase, findBattles, hotCells, restlessCells } from "./changes";
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
  FRONT_HATCH_ALPHA,
  FRONT_HATCH_SPACING,
  FRONT_HATCH_SPEED,
  FRONT_HATCH_WIDTH,
  MAX_BURSTS,
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
  /** Call when the map is redrawn: finds the current fronts, smoke and embers. */
  refresh(state: WorldState): void;
  /** Draws one frame of animation on top of the map. */
  draw(ctx: CanvasRenderingContext2D, now: number): void;
}

const TAU = Math.PI * 2;

export function createEffects(world: GeneratedWorld, displayCells: Int32Array, initial: WorldState): Effects {
  const { width, height, cells } = world;

  // What the world looked like last year, to compare against.
  const lastOwner = initial.state.owner.slice();
  let lastWarPairs = warPairs(initial);
  let bursts: Burst[] = [];

  // Refreshed with the map: which cells smoke or glow, and how strongly.
  let smoke: CellId[] = [];
  let smokeStrength = new Float32Array(0);
  let embers: CellId[] = [];
  let hasFront = false;

  // Off-screen canvases: the front cells as a stencil, and a scratch canvas to hatch them on.
  const [frontMask, maskCtx] = makeCanvas(width, height);
  const [hatch, hatchCtx] = makeCanvas(width, height);
  const stripes = hatchCtx.createPattern(stripeTile(), "repeat")!;
  const smokeSprite = glowSprite(SMOKE_COLOR);
  const emberSprite = glowSprite(EMBER_COLOR);

  function addBurst(burst: Burst): void {
    if (burst.key !== undefined) bursts = bursts.filter((b) => b.key !== burst.key);
    bursts.push(burst);
    if (bursts.length > MAX_BURSTS) bursts.shift(); // oldest gives way
  }

  function noteYear(state: WorldState, events: SimEvent[], now: number): void {
    // A war that ended this year still counts, so include last year's pairs too.
    const pairs = warPairs(state);
    for (const key of lastWarPairs) pairs.add(key);
    for (const battle of findBattles(cells, lastOwner, state.state.owner, pairs)) {
      const color = state.nations.get(battle.winner)?.color ?? WAR_FRONT_COLOR;
      const key = pairKey(battle.winner, battle.loser);
      addBurst({ kind: "battle", x: battle.x, y: battle.y, color, start: now, key });
    }
    lastOwner.set(state.state.owner);
    lastWarPairs = warPairs(state);

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

    // Paint every pixel of a front cell solid white in the stencil; everything else stays clear.
    const front = allFrontCells(state);
    hasFront = front.size > 0;
    if (!hasFront) return;
    const onFront = new Uint8Array(cells.length);
    for (const c of front) onFront[c] = 1;
    const image = maskCtx.createImageData(width, height);
    const px = new Uint32Array(image.data.buffer);
    for (let i = 0; i < px.length; i++) {
      const c = displayCells[i]!;
      if (c >= 0 && onFront[c]) px[i] = 0xffffffff;
    }
    maskCtx.putImageData(image, 0, 0);
  }

  function draw(ctx: CanvasRenderingContext2D, now: number): void {
    const seconds = now / 1000;
    ctx.save();
    if (hasFront) drawFrontHatch(ctx, seconds);
    drawSmoke(ctx, seconds);
    drawEmbers(ctx, seconds);
    bursts = bursts.filter((b) => drawBurst(ctx, b, now));
    ctx.restore();
  }

  function drawFrontHatch(ctx: CanvasRenderingContext2D, seconds: number): void {
    // Copy the stencil, then "source-in" keeps the stripes only where the stencil is solid.
    hatchCtx.globalCompositeOperation = "copy";
    hatchCtx.drawImage(frontMask, 0, 0);
    hatchCtx.globalCompositeOperation = "source-in";
    const offset = (seconds * FRONT_HATCH_SPEED) % FRONT_HATCH_SPACING;
    stripes.setTransform(new DOMMatrix().translateSelf(offset, 0));
    hatchCtx.fillStyle = stripes;
    hatchCtx.fillRect(0, 0, width, height);
    ctx.globalAlpha = FRONT_HATCH_ALPHA;
    ctx.drawImage(hatch, 0, 0);
    ctx.globalAlpha = 1;
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

/** `pairKey` of every pair of nations at war right now. */
function warPairs(state: WorldState): Set<number> {
  return new Set(state.wars.map((w) => pairKey(w.attacker, w.defender)));
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
  const s = FRONT_HATCH_SPACING;
  const [tile, t] = makeCanvas(s, s);
  t.strokeStyle = WAR_FRONT_COLOR;
  t.lineWidth = FRONT_HATCH_WIDTH;
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
