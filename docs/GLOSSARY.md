# Glossary

New concepts as we meet them, with where they show up in our code.

| Term | Meaning | In our code |
|---|---|---|
| **Seed** | A starting value for a random number generator. Same seed → same "random" numbers every time. | `createRng("...")` in `src/core/rng.ts` |
| **Seeded RNG** | A random number generator that's actually a recipe: it scrambles a number over and over, so the sequence is repeatable. | `src/core/rng.ts` |
| **Fork (RNG stream)** | A separate generator made from the main seed plus a name, so each system (war, names…) gets its own numbers. | `rng.fork("war")` |
| **Interface** | A TypeScript description of what an object looks like (its properties and methods), checked before the code runs. | `interface Rng` in `src/core/rng.ts` |
| **Module / `export` / `import`** | Each `.ts` file is a module. `export` makes something visible to other files; `import` pulls it in. | `src/main.ts` imports from `core/`, `gen/`, `render/` |
| **Strict mode** | TypeScript settings that catch more mistakes, e.g. using a value that might be missing. | `"strict": true` in `tsconfig.json` |
| **Vite** | The dev server: serves the page, rebuilds instantly when you save, and bundles the app for release. | `npm run dev`, `vite.config.ts` |
| **Vitest** | The test runner. Each `it(...)` is one check that must pass. | `tests/*.test.ts`, `npm test` |
| **Canvas 2D** | A browser drawing surface you paint with code (shapes, pixels, text). | `src/main.ts` |
| **Heightmap** | A grid of numbers, one per pixel, giving the elevation (0 = lowest, 1 = highest). | `src/gen/heightmap.ts` |
| **Simplex noise** | Smooth, natural-looking random values: nearby points get similar numbers, so it forms hills rather than static. | `createNoise2D` in `heightmap.ts` |
| **Octaves / fBm** | Adding several noise layers, each smaller and fainter, so you get continents *and* rocky detail. | `fbm()` in `heightmap.ts` |
| **Domain warp** | Bending *where* you read the noise, using more noise, so coastlines twist instead of looking blobby. | `sx`, `sy` in `generateHeightmap` |
| **Ridged noise** | Noise folded at zero (`1 - |n|`) so smooth hills become sharp crests, like mountain ranges. | `ridged()` in `heightmap.ts` |
| **Histogram** | Counting values into buckets. We use it to find the sea level that makes 40% of the map land. | `findSeaLevel()` |
| **Typed array** | A fast, fixed-size list of one number type, e.g. `Float32Array`. Good for millions of values. | `Heightmap.data` |
| **Hillshading** | Brightening slopes that face an imaginary sun and darkening the ones facing away, which makes a flat image look 3D. | `hillshade()` in `src/render/terrain.ts` |
| **Color ramp** | A list of colors at set heights; anything in between is blended. | `LAND_RAMP`, `WATER_RAMP` in `palette.ts` |
| **ImageData** | The raw pixels of a canvas: 4 numbers (red, green, blue, alpha) per pixel. We fill it, then paint it with `putImageData`. | `renderTerrain()` |
| **URL query (`?seed=`)** | Extra info after `?` in a web address. We read it to choose the world. | `URLSearchParams` in `src/main.ts` |
