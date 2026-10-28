// Entry point: starts the app. For M0 it just proves the page, TypeScript and
// the seeded generator all work by drawing a few random dots.
import { createRng } from "./core/rng";
import { MAP_HEIGHT, MAP_WIDTH } from "./gen/params";
import { PLACEHOLDER_DOT, PLACEHOLDER_WATER } from "./render/palette";

const canvas = document.querySelector<HTMLCanvasElement>("#map");
if (!canvas) throw new Error("Missing <canvas id='map'> in index.html");

canvas.width = MAP_WIDTH;
canvas.height = MAP_HEIGHT;
const ctx = canvas.getContext("2d")!;

ctx.fillStyle = PLACEHOLDER_WATER;
ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

// Reload the page: the dots stay in the same place because the seed is fixed.
const rng = createRng("realm-forge");
ctx.fillStyle = PLACEHOLDER_DOT;
for (let i = 0; i < 200; i++) {
  ctx.beginPath();
  ctx.arc(rng.range(0, MAP_WIDTH), rng.range(0, MAP_HEIGHT), rng.range(2, 6), 0, Math.PI * 2);
  ctx.fill();
}

ctx.font = "48px Georgia, serif";
ctx.fillText("Realm Forge", 40, 80);
