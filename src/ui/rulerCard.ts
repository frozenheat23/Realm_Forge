// The ruler card (SPEC §5.4k): a portrait in a frame tinted with the nation's color,
// with the ruler's name on the nameplate. Hover a nation to see its ruler; a great
// ruler's rise holds the card up for a few seconds.
import type { Nation } from "../core/types";
import { rulerName } from "../gen/rulers";
import {
  RULER_CARD_NAME_FONT,
  RULER_CARD_OPENINGS,
  RULER_CARD_PLATES,
  RULER_CARD_SHADOW,
  RULER_CARD_SUB_FONT,
  RULER_CARD_TEXT,
  RULER_CARD_TINT,
  RULER_CARD_WIDTH,
} from "../render/palette";
import { RULER_CARD_SECONDS } from "./config";
import { fallbackPath, portraitPath } from "./portraits";

/** The drawing size; the page shrinks it to RULER_CARD_WIDTH. */
const W = 512;
const H = 768;

export interface RulerCard {
  /** Shows the ruler of the nation under the mouse (or hides the card for null), unless a rise is being held. */
  hover(nation: Nation | null): void;
  /** Shows a great ruler who just rose, and keeps it up for RULER_CARD_SECONDS. */
  announce(nation: Nation): void;
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

/** The frame in the nation's color, on its own canvas: grey metal multiplied by the color, keeping the frame's see-through parts. */
function tintedFrame(frame: HTMLImageElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.drawImage(frame, 0, 0, W, H);
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = RULER_CARD_TINT;
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  // Multiplying also colored the see-through parts, so cut back to the frame's own shape.
  g.globalCompositeOperation = "destination-in";
  g.globalAlpha = 1;
  g.drawImage(frame, 0, 0, W, H);
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

  async function draw(nation: Nation): Promise<void> {
    const id = ++drawId;
    const { ruler } = nation;
    const kind = ruler.great === undefined ? "ordinary" : "great";
    const [portrait, frame] = await Promise.all([
      load(portraitPath(nation.race, ruler)).catch(() => load(fallbackPath(nation.race, ruler))),
      load(`frames/${kind}.png`),
    ]);
    if (id !== drawId) return;

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
    g.drawImage(tintedFrame(frame, nation.color), 0, 0);

    const [pl, pt, pr, pb] = RULER_CARD_PLATES[kind];
    const cx = ((pl + pr) / 2) * W;
    const plateWidth = (pr - pl) * W * 0.92;
    const plateMid = ((pt + pb) / 2) * H;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = RULER_CARD_TEXT;
    g.shadowColor = RULER_CARD_SHADOW;
    g.shadowBlur = 4;
    fitText(g, rulerName(ruler, nation.race), cx, plateMid - 13, plateWidth, RULER_CARD_NAME_FONT);
    fitText(g, `${ruler.dynasty} · ${nation.name}`, cx, plateMid + 15, plateWidth, RULER_CARD_SUB_FONT);
    g.shadowBlur = 0;
    container.hidden = !enabled;
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
    toggle() {
      enabled = !enabled;
      if (!enabled) container.hidden = true;
    },
  };
}
