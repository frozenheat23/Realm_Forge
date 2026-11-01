// Parchment ("atlas") style: aged paper, a pale sea and engraved lines along the coast.
// Terrain symbols are in atlasSymbols.ts, the compass and frame in atlasChart.ts.
import { createNoise2D } from "simplex-noise";
import { createRng } from "../core/rng";
import type { GeneratedWorld } from "../gen";
import type { AtlasChart } from "./atlasChart";
import { hexToRgb, mixRgb, scaleRgb, type Rgb } from "./color";
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

export function renderAtlasTerrain(world: GeneratedWorld, chart: AtlasChart): ImageData {
  const { width, height, data, seaLevel } = world.heightmap;
  const { coastDist } = chart;
  const noise = createNoise2D(createRng(world.seed).fork("atlas-paper").next);
  const image = new ImageData(width, height);
  const px = image.data;

  const ink = hexToRgb(ATLAS_INK);
  const paper = hexToRgb(ATLAS_PAPER);
  const sea = hexToRgb(ATLAS_SEA);
  const seaNear = hexToRgb(ATLAS_SEA_NEAR);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dist = coastDist[i]!;
      let rgb: Rgb;
      if (data[i]! > seaLevel) {
        rgb = dist < ATLAS_COAST_WIDTH ? ink : paper;
      } else {
        rgb = mixRgb(sea, seaNear, ATLAS_SEA_NEAR_SHARE * Math.exp(-dist / ATLAS_SEA_NEAR_FADE));
        for (const [line, strength] of ATLAS_WATERLINES) {
          if (Math.abs(dist - line) < WATERLINE_HALF_WIDTH) rgb = mixRgb(rgb, ink, strength);
        }
      }

      // Age: soft stains everywhere, and darker toward the edge of the sheet.
      const stain = noise(x * STAIN_SCALE_BROAD, y * STAIN_SCALE_BROAD) * 0.6 + noise(x * STAIN_SCALE_FINE, y * STAIN_SCALE_FINE) * 0.3;
      const fromCenter = Math.max(Math.abs(x / width - 0.5), Math.abs(y / height - 0.5)) * 2;
      rgb = scaleRgb(rgb, 1 + stain * ATLAS_STAIN - fromCenter ** 5 * ATLAS_EDGE_DARKEN);

      const p = i * 4;
      px[p] = rgb[0];
      px[p + 1] = rgb[1];
      px[p + 2] = rgb[2];
      px[p + 3] = 255;
    }
  }
  return image;
}
