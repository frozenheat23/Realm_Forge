// Resources layer (SPEC §5.4e): a small lettered marker on every deposit, bigger when richer.
import type { GeneratedWorld } from "../gen";
import { drawResourceIcon } from "./atlasMarkers";
import { cssColor, hexToRgb, mixRgb } from "./color";
import {
  ATLAS_PAPER,
  ATLAS_RESOURCE_GROWTH,
  ATLAS_RESOURCE_PAPER,
  LOOK_STANDARD,
  RESOURCE_COLORS,
  RESOURCE_FONT,
  RESOURCE_LETTERS,
  RESOURCE_OUTLINE,
  RESOURCE_RADIUS,
  RESOURCE_RICH_GROWTH,
  type MapLook,
} from "./palette";

export function drawResources(ctx: CanvasRenderingContext2D, world: GeneratedWorld, look: MapLook = LOOK_STANDARD): void {
  ctx.save();
  const iconFills = RESOURCE_COLORS.map((hex) => cssColor(mixRgb(hexToRgb(hex), hexToRgb(ATLAS_PAPER), ATLAS_RESOURCE_PAPER)));
  ctx.font = RESOURCE_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const cell of world.cells) {
    if (cell.resource === 0) continue;
    const [x, y] = cell.site;
    const radius = RESOURCE_RADIUS + cell.richness * RESOURCE_RICH_GROWTH;
    if (look.resourceMarker === "icon") {
      drawResourceIcon(ctx, x, y, radius * ATLAS_RESOURCE_GROWTH, cell.resource, iconFills[cell.resource]!);
      continue;
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = RESOURCE_COLORS[cell.resource]!;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = RESOURCE_OUTLINE;
    ctx.stroke();
    ctx.fillStyle = RESOURCE_OUTLINE;
    ctx.fillText(RESOURCE_LETTERS[cell.resource]!, x, y + 0.5);
  }
  ctx.restore();
}
