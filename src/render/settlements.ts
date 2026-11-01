// Settlements layer (SPEC §5.4f): small dots for towns, a marker and a name for cities.
import type { GeneratedWorld } from "../gen";
import { Settlement, type WorldState } from "../core/types";
import { CITY_FILL, CITY_RING_RADIUS, CITY_SIZE, LOOK_STANDARD, TOWN_FILL, TOWN_RADIUS, type MapLook } from "./palette";

export function drawSettlements(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState, look: MapLook = LOOK_STANDARD): void {
  const level = state.state.settlement;
  ctx.save();
  ctx.font = look.cityFont;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const cell of world.cells) {
    const [x, y] = cell.site;
    if (level[cell.id] === Settlement.Town && look.townDots) {
      ctx.beginPath();
      ctx.arc(x, y, TOWN_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = TOWN_FILL;
      ctx.fill();
    } else if (level[cell.id] === Settlement.City) {
      ctx.fillStyle = CITY_FILL;
      ctx.strokeStyle = look.labelColor;
      ctx.lineWidth = 1.2;
      if (look.cityMarker === "ring") {
        ctx.beginPath();
        ctx.arc(x, y, CITY_RING_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(x - CITY_SIZE / 2, y - CITY_SIZE / 2, CITY_SIZE, CITY_SIZE);
        ctx.strokeRect(x - CITY_SIZE / 2, y - CITY_SIZE / 2, CITY_SIZE, CITY_SIZE);
      }
      const name = state.cityNames.get(cell.id) ?? "";
      const nameX = x + CITY_SIZE + (look.cityMarker === "ring" ? 2 : 0);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = look.labelHalo;
      ctx.strokeText(name, nameX, y);
      ctx.fillStyle = look.labelColor;
      ctx.fillText(name, nameX, y);
    }
  }
  ctx.restore();
}
