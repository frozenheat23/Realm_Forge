// Alliances layer (SPEC §5.4c): a dashed line between the capitals of each pair of allies.
import type { GeneratedWorld } from "../gen";
import type { WorldState } from "../core/types";
import { ALLIANCE_COLOR, ALLIANCE_DASH, ALLIANCE_OUTLINE, ALLIANCE_WIDTH } from "./palette";

export function drawAlliances(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState): void {
  ctx.save();
  ctx.lineCap = "round";
  for (const al of state.alliances) {
    const a = state.nations.get(al.a);
    const b = state.nations.get(al.b);
    if (!a?.alive || !b?.alive) continue;
    const [x1, y1] = world.cells[a.capital]!.site;
    const [x2, y2] = world.cells[b.capital]!.site;
    // A dark solid line underneath makes the light dashes readable on any color.
    ctx.setLineDash([]);
    ctx.strokeStyle = ALLIANCE_OUTLINE;
    ctx.lineWidth = ALLIANCE_WIDTH + 2;
    line(ctx, x1, y1, x2, y2);
    ctx.setLineDash(ALLIANCE_DASH);
    ctx.strokeStyle = ALLIANCE_COLOR;
    ctx.lineWidth = ALLIANCE_WIDTH;
    line(ctx, x1, y1, x2, y2);
  }
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
