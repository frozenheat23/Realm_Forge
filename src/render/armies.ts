// Armies layer (SPEC §5.4h): a banner for each army, sliding along this year's
// march, with a dashed line to where it's heading. Only reads the world.
import type { Army, WorldState } from "../core/types";
import { NO_TARGET } from "../core/types";
import type { GeneratedWorld } from "../gen";
import {
  ARMY_BANNER_FULL,
  ARMY_BANNER_MAX,
  ARMY_BANNER_MIN,
  ARMY_LABEL_COLOR,
  ARMY_MEN_PER_UNIT,
  ARMY_TARGET_ALPHA,
  CEL_INK_COLOR,
} from "./palette";

/** A short size for a banner: "12k", or "800" under a thousand. */
export function menLabel(size: number): string {
  const men = size * ARMY_MEN_PER_UNIT;
  return men >= 1000 ? `${Math.round(men / 1000)}k` : `${Math.round(men / 100) * 100}`;
}

/** Where the army is on its march. `progress` 0 = where it began this year, 1 = where it ended. */
export function marchPosition(world: GeneratedWorld, army: Army, progress: number): [number, number] {
  const legs = army.trail.length - 1;
  if (legs < 1) return world.cells[army.cell]!.site;
  const along = Math.min(0.999, Math.max(0, progress)) * legs;
  const leg = Math.floor(along);
  const [x0, y0] = world.cells[army.trail[leg]!]!.site;
  const [x1, y1] = world.cells[army.trail[leg + 1]!]!.site;
  const t = along - leg;
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

/** A shield: flat top, curving to a point at the bottom. (x, y) is its middle, `r` its half-height. */
function shieldPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const w = r * 0.85;
  ctx.beginPath();
  ctx.moveTo(x - w, y - r);
  ctx.lineTo(x + w, y - r);
  ctx.lineTo(x + w, y + r * 0.2);
  ctx.quadraticCurveTo(x + w, y + r * 0.75, x, y + r);
  ctx.quadraticCurveTo(x - w, y + r * 0.75, x - w, y + r * 0.2);
  ctx.closePath();
}

function drawTargetLine(ctx: CanvasRenderingContext2D, world: GeneratedWorld, army: Army, color: string, x: number, y: number): void {
  if (army.target === NO_TARGET || army.target === army.cell) return;
  const [tx, ty] = world.cells[army.target]!.site;
  ctx.globalAlpha = ARMY_TARGET_ALPHA;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** Draws every army. `progress` (0..1) is how far through its march this year's playback is. */
export function drawArmies(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState, progress: number): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const army of state.armies) {
    const nation = state.nations.get(army.owner)!;
    const [x, y] = marchPosition(world, army, progress);
    drawTargetLine(ctx, world, army, nation.color, x, y);

    const grown = Math.sqrt(Math.min(1, army.size / ARMY_BANNER_FULL));
    const r = ARMY_BANNER_MIN + (ARMY_BANNER_MAX - ARMY_BANNER_MIN) * grown;
    shieldPath(ctx, x, y, r);
    ctx.fillStyle = nation.color;
    ctx.fill();
    ctx.strokeStyle = CEL_INK_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 10px Georgia, serif";
    ctx.lineWidth = 3;
    ctx.strokeText(menLabel(army.size), x, y - r * 0.1);
    ctx.fillStyle = ARMY_LABEL_COLOR;
    ctx.fillText(menLabel(army.size), x, y - r * 0.1);
  }
}
