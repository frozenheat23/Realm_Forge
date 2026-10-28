// Paints the terrain layer: colors by height, hillshading, coasts and texture.
// Only reads the heightmap; it never changes it. Drawn once and reused every frame.
import type { Heightmap } from "../gen/heightmap";
import { clamp, lerp, smoothstep } from "../core/math";
import {
  COAST_GLOW_COLOR,
  COAST_GLOW_WIDTH,
  COAST_LINE_ALPHA,
  COAST_LINE_COLOR,
  HILLSHADE_ALTITUDE,
  HILLSHADE_AZIMUTH,
  HILLSHADE_EXAGGERATION,
  HILLSHADE_STRENGTH,
  LAND_RAMP,
  SEA_GRID_ALPHA,
  SEA_GRID_SPACING,
  TERRAIN_GRAIN,
  WATER_RAMP,
  type ColorStop,
} from "./palette";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Pre-computes a ramp into 256 colors so each pixel is just a lookup.
function buildRampTable(stops: ColorStop[]): Rgb[] {
  const rgbStops = stops.map((s) => ({ at: s.at, rgb: hexToRgb(s.color) }));
  const table: Rgb[] = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < rgbStops.length - 2 && t > rgbStops[k + 1]!.at) k++;
    const a = rgbStops[k]!;
    const b = rgbStops[k + 1]!;
    table.push(mixRgb(a.rgb, b.rgb, clamp((t - a.at) / (b.at - a.at), 0, 1)));
  }
  return table;
}

function rampLookup(table: Rgb[], t: number): Rgb {
  return table[Math.round(clamp(t, 0, 1) * 255)]!;
}

// A repeatable "random" value per pixel (-1..1), used for grain.
// Rendering must be repeatable too, so no Math.random() here either.
function pixelHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;
}

// Hillshade: how brightly the sun lights this pixel's slope, compared to flat ground.
// Returns about -1 (facing away from the light) to +1 (facing it), 0 = flat.
function hillshade(map: Heightmap, x: number, y: number, light: [number, number, number]): number {
  const { width, height, data } = map;
  const left = data[y * width + Math.max(0, x - 1)]!;
  const right = data[y * width + Math.min(width - 1, x + 1)]!;
  const up = data[Math.max(0, y - 1) * width + x]!;
  const down = data[Math.min(height - 1, y + 1) * width + x]!;

  // Slope in each direction, then the "normal": the direction the surface faces.
  const dx = ((right - left) / 2) * HILLSHADE_EXAGGERATION;
  const dy = ((down - up) / 2) * HILLSHADE_EXAGGERATION;
  const len = Math.sqrt(dx * dx + dy * dy + 1);
  const lit = (-dx * light[0] - dy * light[1] + light[2]) / len;
  // Subtract how bright flat ground is, so flat land is left unchanged.
  return (lit - light[2]) / (1 - light[2]);
}

// The sun's direction as a 3D arrow. Azimuth is measured clockwise from north (up).
function lightDirection(): [number, number, number] {
  const az = (HILLSHADE_AZIMUTH * Math.PI) / 180;
  const alt = (HILLSHADE_ALTITUDE * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(alt), -Math.cos(az) * Math.cos(alt), Math.sin(alt)];
}

// True if this land pixel touches water on any side (the coastline).
function isCoast(map: Heightmap, x: number, y: number): boolean {
  const { width, height, data, seaLevel } = map;
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return false;
  const i = y * width + x;
  return (
    data[i - 1]! <= seaLevel ||
    data[i + 1]! <= seaLevel ||
    data[i - width]! <= seaLevel ||
    data[i + width]! <= seaLevel
  );
}

export function renderTerrain(map: Heightmap): ImageData {
  const { width, height, data, seaLevel } = map;
  const image = new ImageData(width, height);
  const px = image.data;

  const landTable = buildRampTable(LAND_RAMP);
  const waterTable = buildRampTable(WATER_RAMP);
  const coastLine = hexToRgb(COAST_LINE_COLOR);
  const coastGlow = hexToRgb(COAST_GLOW_COLOR);
  const light = lightDirection();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const h = data[i]!;
      let rgb: Rgb;

      if (h > seaLevel) {
        // Land: color by how high above the sea it is, then shade the slopes.
        const t = (h - seaLevel) / (1 - seaLevel);
        rgb = rampLookup(landTable, t);
        // Clamped so steep slopes never go fully black or blown-out white.
        const shade = clamp(1 + hillshade(map, x, y, light) * HILLSHADE_STRENGTH, 0.55, 1.35);
        rgb = [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
        if (isCoast(map, x, y)) rgb = mixRgb(rgb, coastLine, COAST_LINE_ALPHA);
      } else {
        // Water: deeper = darker, with a pale glow along the shore.
        const depth = (seaLevel - h) / seaLevel;
        rgb = rampLookup(waterTable, depth);
        const glow = 1 - smoothstep(0, COAST_GLOW_WIDTH, seaLevel - h);
        rgb = mixRgb(rgb, coastGlow, glow * 0.6);
        if (x % SEA_GRID_SPACING === 0 || y % SEA_GRID_SPACING === 0) {
          rgb = mixRgb(rgb, [255, 255, 255], SEA_GRID_ALPHA);
        }
      }

      // Grain: tiny brightness wobble so it reads as painted, not flat digital color.
      const grain = 1 + pixelHash(x, y) * TERRAIN_GRAIN;
      const p = i * 4;
      px[p] = rgb[0] * grain;
      px[p + 1] = rgb[1] * grain;
      px[p + 2] = rgb[2] * grain;
      px[p + 3] = 255;
    }
  }
  return image;
}
