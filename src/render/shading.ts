// Hillshading: how brightly an imaginary sun lights each slope.
// Shared by every terrain style.
import { HILLSHADE_ALTITUDE, HILLSHADE_AZIMUTH } from "./palette";

export type Vec3 = [number, number, number];

/** The sun's direction as a 3D arrow. Azimuth is measured clockwise from north (up). */
export function lightDirection(): Vec3 {
  const az = (HILLSHADE_AZIMUTH * Math.PI) / 180;
  const alt = (HILLSHADE_ALTITUDE * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(alt), -Math.cos(az) * Math.cos(alt), Math.sin(alt)];
}

/**
 * How lit this pixel's slope is compared to flat ground:
 * about -1 (facing away from the sun) to +1 (facing it), 0 = flat.
 * `exaggeration` stretches the heights first, so gentle hills still show.
 */
export function hillshade(
  data: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  light: Vec3,
  exaggeration: number,
): number {
  const left = data[y * width + Math.max(0, x - 1)]!;
  const right = data[y * width + Math.min(width - 1, x + 1)]!;
  const up = data[Math.max(0, y - 1) * width + x]!;
  const down = data[Math.min(height - 1, y + 1) * width + x]!;

  // Slope in each direction, then the "normal": the direction the surface faces.
  const dx = ((right - left) / 2) * exaggeration;
  const dy = ((down - up) / 2) * exaggeration;
  const len = Math.sqrt(dx * dx + dy * dy + 1);
  const lit = (-dx * light[0] - dy * light[1] + light[2]) / len;
  // Subtract how bright flat ground is, so flat land is left unchanged.
  return (lit - light[2]) / (1 - light[2]);
}
