// Heatmap layers (SPEC §5.4d): color each owned land cell by one 0..1 value, for tuning and curiosity.
import type { GeneratedWorld } from "../gen";
import type { WorldState } from "../core/types";
import { controlMap } from "../sim/control";
import { buildRampTable, rampLookup } from "./color";
import { HEAT_ALPHA, HEAT_RAMP } from "./palette";

/** The heatmaps the H key cycles through, in order. */
export const HEAT_KINDS = ["unrest", "control", "devastation", "development"] as const;
export type HeatKind = (typeof HEAT_KINDS)[number];

/** The value (0..1) of every cell for one heatmap. */
function heatValues(state: WorldState, kind: HeatKind): Float32Array {
  switch (kind) {
    case "control":
      return controlMap(state);
    case "unrest":
    case "devastation":
    case "development":
      return state.state[kind];
  }
}

const ramp = buildRampTable(HEAT_RAMP);

export function renderHeatmap(world: Pick<GeneratedWorld, "width" | "height">, displayCells: Int32Array, state: WorldState, kind: HeatKind): ImageData {
  const values = heatValues(state, kind);
  const owner = state.state.owner;
  const image = new ImageData(world.width, world.height);
  const data = image.data;
  const alpha = Math.round(HEAT_ALPHA * 255);
  for (let i = 0; i < displayCells.length; i++) {
    const cell = displayCells[i]!;
    if (cell < 0 || owner[cell] === 0) continue;
    const [r, g, b] = rampLookup(ramp, values[cell]!);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = alpha;
  }
  return image;
}
