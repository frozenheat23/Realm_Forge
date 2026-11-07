// Parchment ("atlas") style: aged paper, a pale sea and engraved lines along the coast.
// Terrain symbols are in atlasSymbols.ts, the compass and frame in atlasChart.ts.
import { createNoise2D } from "simplex-noise";
import { createRng } from "../core/rng";
import type { GeneratedWorld } from "../gen";
import type { AtlasChart } from "./atlasChart";
import { hexToRgb, mixRgb, scaleRgb, type Rgb } from "./color";
import { sampleAt, type ViewGrid } from "./displayCells";
import { markScale } from "./marks";
import {
  ATLAS_COAST_WIDTH,
  ATLAS_EDGE_DARKEN,
  ATLAS_INK,
  ATLAS_PAPER,
  ATLAS_SEA,
  ATLAS_SEA_NEAR,
  ATLAS_SEA_NEAR_FADE,
  ATLAS_SEA_NEAR_SHARE,
  ATLAS_STAIN,
  ATLAS_WATERLINES,
} from "./palette";

// How much a pixel's distance from a waterline may differ and still count as on the line.
const WATERLINE_HALF_WIDTH = 0.65;
// Noise sizes for the paper stains (smaller numbers make bigger stains).
const STAIN_SCALE_BROAD = 0.0035;
const STAIN_SCALE_FINE = 0.008;

/**
 * The paper, sea and coast. With a `view` (M19), only that zoomed part of the map is drawn,
 * at the view's size: heights and coast distances are blended between map pixels, so the
 * coast stays a smooth line.
 */
export function renderAtlasTerrain(world: GeneratedWorld, chart: AtlasChart, view?: ViewGrid): ImageData {
  const { width, height, data, seaLevel } = world.heightmap;
  const { coastDist } = chart;
  const noise = createNoise2D(createRng(world.seed).fork("atlas-paper").next);
  const outW = view?.width ?? width;
  const outH = view?.height ?? height;
  const image = new ImageData(outW, outH);
  const px = image.data;

  const ink = hexToRgb(ATLAS_INK);
  const paper = hexToRgb(ATLAS_PAPER);
  const sea = hexToRgb(ATLAS_SEA);
  const seaNear = hexToRgb(ATLAS_SEA_NEAR);
  // Zoomed in, inked lines grow more slowly than the map, so they stay fine (as markers do).
  const thin = markScale(view?.zoom ?? 1);
  const coastWidth = ATLAS_COAST_WIDTH * thin;
  const lineHalfWidth = WATERLINE_HALF_WIDTH * thin;

  for (let gy = 0; gy < outH; gy++) {
    for (let gx = 0; gx < outW; gx++) {
      // The map point this pixel shows, and its height and distance from the coast.
      let x = gx;
      let y = gy;
      let land: boolean;
      let dist: number;
      if (view) {
        x = view.x + (gx + 0.5) / view.zoom - 0.5;
        y = view.y + (gy + 0.5) / view.zoom - 0.5;
        land = sampleAt(data, width, height, x + 0.5, y + 0.5) > seaLevel;
        dist = sampleAt(coastDist, width, height, x + 0.5, y + 0.5);
      } else {
        const i = gy * width + gx;
        land = data[i]! > seaLevel;
        dist = coastDist[i]!;
      }
      let rgb: Rgb;
      if (land) {
        rgb = dist < coastWidth ? ink : paper;
      } else {
        rgb = mixRgb(sea, seaNear, ATLAS_SEA_NEAR_SHARE * Math.exp(-dist / ATLAS_SEA_NEAR_FADE));
        for (const [line, strength] of ATLAS_WATERLINES) {
          if (Math.abs(dist - line) < lineHalfWidth) rgb = mixRgb(rgb, ink, strength);
        }
      }

      // Age: soft stains everywhere, and darker toward the edge of the sheet.
      const stain = noise(x * STAIN_SCALE_BROAD, y * STAIN_SCALE_BROAD) * 0.6 + noise(x * STAIN_SCALE_FINE, y * STAIN_SCALE_FINE) * 0.3;
      const fromCenter = Math.max(Math.abs(x / width - 0.5), Math.abs(y / height - 0.5)) * 2;
      rgb = scaleRgb(rgb, 1 + stain * ATLAS_STAIN - fromCenter ** 5 * ATLAS_EDGE_DARKEN);

      const p = (gy * outW + gx) * 4;
      px[p] = rgb[0];
      px[p + 1] = rgb[1];
      px[p + 2] = rgb[2];
      px[p + 3] = 255;
    }
  }
  return image;
}
