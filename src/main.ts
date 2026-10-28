// Entry point: generates a world from a seed and draws it.
// Try a different world by adding ?seed=anything to the page address.
import { createRng } from "./core/rng";
import { generateHeightmap } from "./gen/heightmap";
import { MAP_HEIGHT, MAP_WIDTH } from "./gen/params";
import { renderTerrain } from "./render/terrain";

const canvas = document.querySelector<HTMLCanvasElement>("#map");
if (!canvas) throw new Error("Missing <canvas id='map'> in index.html");

canvas.width = MAP_WIDTH;
canvas.height = MAP_HEIGHT;
const ctx = canvas.getContext("2d")!;

const seed = new URLSearchParams(location.search).get("seed") ?? "realm-forge";
const rng = createRng(seed);

const t0 = performance.now();
const heightmap = generateHeightmap(rng.fork("terrain"), MAP_WIDTH, MAP_HEIGHT);
const t1 = performance.now();
ctx.putImageData(renderTerrain(heightmap), 0, 0);
const t2 = performance.now();

console.log(
  `Seed "${seed}": heightmap ${(t1 - t0).toFixed(0)} ms, terrain ${(t2 - t1).toFixed(0)} ms`,
);
