// Burning a fallen ruler's card (SPEC §5.4k). Only math on pixel colors here, no page
// or canvas, so it can be tested on its own. A picture is a long list of numbers:
// four per pixel (red, green, blue, and alpha = how solid it is), each 0..255.
import { createNoise2D } from "simplex-noise";
import { createRng } from "../core/rng";
import { hexToRgb } from "../render/color";
import { RULER_CARD_BURN_BOTTOM, RULER_CARD_BURN_CHAR, RULER_CARD_BURN_EMBER, RULER_CARD_BURN_REACH, RULER_CARD_BURN_SCORCH } from "../render/palette";

/** Width of the glowing line at the fire's front, and of the blackened band behind it, in the same 0..1 units as the burn order. */
const EMBER_BAND = 0.02;
const CHAR_BAND = 0.11;
/** Size of the fire's ragged tongues, in card pixels. */
const NOISE_SIZE = 70;

/**
 * When each pixel of a `width` × `height` card catches fire: 0 = first, 1 = last (never, in practice).
 * Fire creeps in from the top and sides, raggedly; the bottom, where the name is written, resists.
 * `name` picks the ragged pattern, so each card burns its own way (and the same way every time).
 */
export function burnOrder(width: number, height: number, name: string): Float32Array {
  const noise = createNoise2D(createRng(`burn/${name}`).next);
  const order = new Float32Array(width * height);
  const half = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fromEdge = Math.min(x, width - 1 - x, y, (height - 1 - y) * RULER_CARD_BURN_BOTTOM) / half;
      const ragged = (noise(x / NOISE_SIZE, y / NOISE_SIZE) + 0.5 * noise(x / (NOISE_SIZE / 3), y / (NOISE_SIZE / 3)) + 1.5) / 3; // 0..1
      order[y * width + x] = Math.min(1, fromEdge) * 0.75 + ragged * 0.25;
    }
  }
  return order;
}

/**
 * Writes into `out` how the `clean` picture looks when the fire is `t` of the way through
 * (0 = untouched, 1 = burned out). Pixels the fire has passed are gone (see-through); just
 * ahead of it they glow, then blacken; the rest of the card browns in the heat.
 */
export function burnFrame(clean: Uint8ClampedArray, out: Uint8ClampedArray, order: Float32Array, t: number): void {
  const front = t * RULER_CARD_BURN_REACH;
  // The bands grow in over the first moments, so an untouched card (t = 0) has no black rim.
  const grow = Math.min(1, t * 5);
  const ember = EMBER_BAND * grow;
  const char = CHAR_BAND * grow;
  const [er, eg, eb] = hexToRgb(RULER_CARD_BURN_EMBER);
  const [cr, cg, cb] = hexToRgb(RULER_CARD_BURN_CHAR);
  const glow = 1 - t; // embers die down as the fire burns out
  const scorch = RULER_CARD_BURN_SCORCH * t;

  for (let p = 0; p < order.length; p++) {
    const i = p * 4;
    const ahead = order[p]! - front; // how far this pixel is from the fire's front
    if (ahead < 0) {
      out[i + 3] = 0;
      continue;
    }
    // Browned by heat: blue fades fastest, red slowest, which reads as old, smoked paper.
    let r = clean[i]! * (1 - 0.5 * scorch);
    let g = clean[i + 1]! * (1 - 0.8 * scorch);
    let b = clean[i + 2]! * (1 - scorch);
    if (ahead < char) {
      // 0 right at the front (all black) .. 1 at the band's far side (not blackened).
      const k = ahead / char;
      r = cr + (r - cr) * k;
      g = cg + (g - cg) * k;
      b = cb + (b - cb) * k;
    }
    if (ahead < ember) {
      r += (er - r) * glow;
      g += (eg - g) * glow;
      b += (eb - b) * glow;
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = clean[i + 3]!;
  }
}
