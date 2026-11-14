// The ruler card (SPEC §5.4k): a portrait in a parchment frame whose wax seal takes
// the nation's color, with the ruler's name inked on the nameplate. Hover a nation to see its ruler; a great
// ruler's rise holds the card up for a few seconds, and a fallen realm's last ruler burns.
import type { Nation } from "../core/types";
import { rulerName } from "../gen/rulers";
import {
  RULER_CARD_NAME_FONT,
  RULER_CARD_OPENINGS,
  RULER_CARD_PLATES,
  RULER_CARD_SUB_FONT,
  RULER_CARD_TEXT,
  RULER_CARD_WIDTH,
} from "../render/palette";
import { burnFrame, burnOrder } from "./burn";
import { RULER_CARD_BURN_SECONDS, RULER_CARD_FALL_SECONDS, RULER_CARD_SECONDS } from "./config";
import { fallbackPath, portraitPath } from "./portraits";

/** The drawing size; the page shrinks it to RULER_CARD_WIDTH. */
export const CARD_W = 512;
export const CARD_H = 768;
const W = CARD_W;
const H = CARD_H;

export interface RulerCard {
  /** Shows the ruler of the nation under the mouse (or hides the card for null), unless a rise is being held. */
  hover(nation: Nation | null): void;
  /** Shows a great ruler who just rose, and keeps it up for RULER_CARD_SECONDS. */
  announce(nation: Nation): void;
  /** Shows the last ruler of a realm that just fell, and burns the card. */
  fall(nation: Nation): void;
  /** Turns the card on or off (key P). */
  toggle(): void;
}

// Each image is loaded once and kept. A promise is a value that arrives later.
const images = new Map<string, Promise<HTMLImageElement>>();
function load(path: string): Promise<HTMLImageElement> {
  let image = images.get(path);
  if (!image) {
    const img = new Image();
    img.src = path;
    image = img.decode().then(() => img);
    images.set(path, image);
  }
  return image;
}

/** The wax seal in the nation's color, on its own canvas: light grey wax multiplied by the color, keeping the seal's shape. */
function coloredSeal(seal: HTMLImageElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.drawImage(seal, 0, 0, W, H);
  g.globalCompositeOperation = "multiply";
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  // Multiplying also colored the see-through parts, so cut back to the seal's own shape.
  g.globalCompositeOperation = "destination-in";
  g.drawImage(seal, 0, 0, W, H);
  return c;
}

/** Writes one line centered at (x, y), shrinking the font until it fits in `maxWidth`. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, font: string): void {
  g.font = font;
  const width = g.measureText(text).width;
  if (width > maxWidth) {
    const size = Number(/(\d+)px/.exec(font)![1]);
    g.font = font.replace(`${size}px`, `${Math.floor((size * maxWidth) / width)}px`);
  }
  g.fillText(text, x, y);
}

/**
 * Loads what a nation's card needs (portrait, frame, seal, fonts) and returns a function
 * that paints the card onto a CARD_W × CARD_H canvas. Used by the ruler card and the versus screen.
 */
export async function prepareCard(nation: Nation): Promise<(g: CanvasRenderingContext2D) => void> {
  const { ruler } = nation;
  const kind = ruler.great === undefined ? "ordinary" : "great";
  const [portrait, frame, seal] = await Promise.all([
    load(portraitPath(nation.race, ruler)).catch(() => load(fallbackPath(nation.race, ruler))),
    load(`frames/${kind}.png`),
    load(`frames/${kind}-seal.png`),
    // Canvas only uses a web font once it has loaded; otherwise it quietly falls back to Georgia.
    document.fonts.load(RULER_CARD_NAME_FONT),
    document.fonts.load(RULER_CARD_SUB_FONT),
  ]);
  return (g) => {
    g.clearRect(0, 0, W, H);
    // The portrait fills the opening's width, top-aligned, so the face and crown show.
    const [left, top, right, bottom] = RULER_CARD_OPENINGS[kind];
    const ox = left * W;
    const oy = top * H;
    const ow = (right - left) * W;
    const oh = (bottom - top) * H;
    g.save();
    g.beginPath();
    g.rect(ox, oy, ow, oh);
    g.clip();
    g.drawImage(portrait, ox, oy, ow, (ow * portrait.height) / portrait.width);
    g.restore();
    g.drawImage(frame, 0, 0, W, H);
    g.drawImage(coloredSeal(seal, nation.color), 0, 0);

    const [pl, pt, pr, pb] = RULER_CARD_PLATES[kind];
    const cx = ((pl + pr) / 2) * W;
    const plateWidth = (pr - pl) * W * 0.92;
    const plateMid = ((pt + pb) / 2) * H;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = RULER_CARD_TEXT;
    fitText(g, rulerName(ruler, nation.race), cx, plateMid - 13, plateWidth, RULER_CARD_NAME_FONT);
    fitText(g, `${ruler.dynasty} · ${nation.name}`, cx, plateMid + 15, plateWidth, RULER_CARD_SUB_FONT);
  };
}

/** Burns whatever is drawn on a card's canvas, frame by frame, for as long as `stillMine()` says the card is still this one. */
export function burnCanvas(g: CanvasRenderingContext2D, name: string, stillMine: () => boolean): void {
  const clean = g.getImageData(0, 0, W, H);
  const frame = g.createImageData(W, H);
  const order = burnOrder(W, H, name);
  const start = performance.now();
  const step = (now: number): void => {
    if (!stillMine()) return; // another card has taken over
    const t = Math.min(1, (now - start) / (RULER_CARD_BURN_SECONDS * 1000));
    burnFrame(clean.data, frame.data, order, t);
    g.putImageData(frame, 0, 0);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function createRulerCard(container: HTMLElement): RulerCard {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${RULER_CARD_WIDTH}px`;
  container.append(canvas);
  const g = canvas.getContext("2d")!;

  let enabled = true;
  let holdUntil = 0;
  // Counts draws, so a slow image load can't paint over a newer card.
  let drawId = 0;

  /** Draws the nation's card. Resolves to false if a newer card took its place while images loaded. */
  async function draw(nation: Nation): Promise<boolean> {
    const id = ++drawId;
    const paint = await prepareCard(nation);
    if (id !== drawId) return false;
    paint(g);
    container.hidden = !enabled;
    return true;
  }

  /** Draws the card, then burns it, and takes it down when its time is up. */
  async function burn(nation: Nation): Promise<void> {
    if (!(await draw(nation)) || !enabled) return;
    const id = drawId;
    burnCanvas(g, nation.name, () => id === drawId);
    setTimeout(() => {
      if (id === drawId) container.hidden = true;
    }, RULER_CARD_FALL_SECONDS * 1000);
  }

  return {
    hover(nation) {
      if (performance.now() < holdUntil) return;
      if (!nation) {
        drawId++; // cancel any image still loading
        container.hidden = true;
        return;
      }
      void draw(nation);
    },
    announce(nation) {
      holdUntil = performance.now() + RULER_CARD_SECONDS * 1000;
      void draw(nation);
    },
    fall(nation) {
      holdUntil = performance.now() + RULER_CARD_FALL_SECONDS * 1000;
      void burn(nation);
    },
    toggle() {
      enabled = !enabled;
      if (!enabled) container.hidden = true;
    },
  };
}
