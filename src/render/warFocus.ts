// Following a war (M16, docs/systems/warroom.md): what the war is about, drawn over the map.
// Gold rings on goal land the attacker hasn't taken; a small mark, in the occupier's color,
// on land each side holds. Only reads the world.
import type { GeneratedWorld } from "../gen";
import type { WarRecord, WorldState } from "../core/types";
import { FOCUS_EDGE, FOCUS_GOAL_COLOR, FOCUS_GOAL_RADIUS, FOCUS_HELD_SIZE } from "./palette";

export function drawWarFocus(ctx: CanvasRenderingContext2D, world: GeneratedWorld, state: WorldState, record: WarRecord): void {
  const war = state.wars.find((w) => w.id === record.id);
  if (!war) return;
  const { owner, occupier } = state.state;
  const sides = new Set([record.attacker, record.defender, ...record.allies.map((a) => a.nation)]);
  ctx.save();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = FOCUS_GOAL_COLOR;
  for (const c of war.goalCells) {
    if (owner[c] !== record.defender || occupier[c] === record.attacker) continue;
    const [x, y] = world.cells[c]!.site;
    ctx.beginPath();
    ctx.arc(x, y, FOCUS_GOAL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = FOCUS_EDGE;
  const half = FOCUS_HELD_SIZE / 2;
  for (let c = 0; c < occupier.length; c++) {
    const holder = occupier[c]!;
    if (holder === 0 || !sides.has(holder) || !sides.has(owner[c]!)) continue;
    const [x, y] = world.cells[c]!.site;
    ctx.fillStyle = state.nations.get(holder)?.color ?? "#777";
    // A small diamond, so it reads apart from towns and resources.
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x - half, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
