// Settlements layer (SPEC §5.4f): small dots for towns, a marker and a name for cities.
import type { GeneratedWorld } from "../gen";
import { Settlement, type WorldState } from "../core/types";
import { CITY_FILL, CITY_FONT, CITY_SIZE, LABEL_COLOR, LABEL_HALO, TOWN_FILL, TOWN_RADIUS } from "./palette";

export function drawSettlements(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState): void {
  const level = state.state.settlement;
  ctx.save();
  ctx.font = CITY_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const cell of world.cells) {
    const [x, y] = cell.site;
    if (level[cell.id] === Settlement.Town) {
      ctx.beginPath();
      ctx.arc(x, y, TOWN_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = TOWN_FILL;
      ctx.fill();
    } else if (level[cell.id] === Settlement.City) {
      ctx.fillStyle = CITY_FILL;
      ctx.strokeStyle = LABEL_COLOR;
      ctx.lineWidth = 1.2;
      ctx.fillRect(x - CITY_SIZE / 2, y - CITY_SIZE / 2, CITY_SIZE, CITY_SIZE);
      ctx.strokeRect(x - CITY_SIZE / 2, y - CITY_SIZE / 2, CITY_SIZE, CITY_SIZE);
      const name = state.cityNames.get(cell.id) ?? "";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = LABEL_HALO;
      ctx.strokeText(name, x + CITY_SIZE, y);
      ctx.fillStyle = LABEL_COLOR;
      ctx.fillText(name, x + CITY_SIZE, y);
    }
  }
  ctx.restore();
}
