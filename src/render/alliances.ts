// Alliances layer (SPEC §5.4c): a dashed line between the capitals of each pair of allies.
import type { GeneratedWorld } from "../gen";
import type { WorldState } from "../core/types";
import { markScale, zoomOf } from "./marks";
import { LOOK_STANDARD, type MapLook } from "./palette";

export function drawAlliances(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState, look: MapLook = LOOK_STANDARD): void {
  ctx.save();
  ctx.lineCap = "round";
  const k = markScale(zoomOf(ctx)); // zoomed in, lines stay fine
  for (const al of state.alliances) {
    const a = state.nations.get(al.a);
    const b = state.nations.get(al.b);
    if (!a?.alive || !b?.alive) continue;
    const [x1, y1] = world.cells[a.capital]!.site;
    const [x2, y2] = world.cells[b.capital]!.site;
    // A solid line underneath, in the opposite tone, makes the dashes readable on any color.
    ctx.setLineDash([]);
    ctx.strokeStyle = look.allianceOutline;
    ctx.lineWidth = (look.allianceWidth + 2) * k;
    line(ctx, x1, y1, x2, y2);
    ctx.setLineDash(look.allianceDash.map((d) => d * k));
    ctx.strokeStyle = look.allianceColor;
    ctx.lineWidth = look.allianceWidth * k;
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
