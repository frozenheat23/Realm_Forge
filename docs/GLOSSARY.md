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
| **Cel shading** | Cartoon-style shading: instead of smooth gradients, light snaps to a few flat tones. | `renderCelTerrain()` in `src/render/terrainCel.ts` |
| **Box blur** | Replacing each pixel with the average of its neighbors, to smooth out small bumps. | `boxBlur()` in `terrainCel.ts` |
| **Distance field** | For every pixel, how far it is to the nearest coast. We use it for the ink line, shallows and ripples. | `distanceToCoast()` in `terrainCel.ts` |
| **Function as a value** | In TypeScript a function can be stored in a variable and called later, like picking a renderer. | `const renderTerrain = ...` in `src/main.ts` |
| **Voronoi diagram** | Splitting a plane into regions, one per point, where each region is everything closest to that point. Our cells. | `buildCellGraph()` in `src/gen/cells.ts` |
| **Delaunay triangulation** | The "partner" of Voronoi: lines joining points whose regions touch. We use it to find neighbors. | `delaunay.neighbors(i)` |
| **Jittered grid** | Points on a grid, each nudged randomly. Even spacing without looking like a grid. | `jitteredGrid()` |
| **Graph** | Things (cells) plus links between them (neighbors). Most of the sim walks this graph. | `Cell.neighbors` |
| **Breadth-first search (BFS)** | Exploring a graph in rings: everything 1 step away, then 2, and so on. | `stepsFromWater()` in `src/gen/climate.ts` |
| **Priority flood** | Like BFS, but always grow from the lowest cell next. Finds where water drains, even out of dips. | `drainageMap()` in `src/gen/rivers.ts` |
| **Min-heap** | A list that always gives back its smallest item quickly. Powers the priority flood. | `class MinHeap` in `rivers.ts` |
| **Class** | A blueprint for objects that bundle data with functions (methods). `private` hides parts from outside code. | `MinHeap` |
| **`as const`** | Tells TypeScript the values are fixed, so `Biome.Desert` is exactly `8`, not any number. | `Biome` in `src/core/types.ts` |
| **`Record<K, V>`** | A TypeScript type for "an object with a value of type V for every key K". | `BIOME_STATS`, `BIOME_COLORS` |
| **Event listener** | Code that runs when something happens on the page (a key press, the mouse moving). | `src/ui/debugInfo.ts` |
| **Markov chain** | A way to make new text: learn which letter tends to follow each pair of letters in examples, then build words one letter at a time using those odds. | `src/gen/names.ts` |
| **`Map`** | A JavaScript lookup table from keys to values, e.g. nation id → nation. Like an object, but any key type and easy to loop over. | `WorldState.nations`, `NameChain` |
| **`Set`** | A collection with no duplicates; great for "have we used this already?". | `takenNames` in `src/gen/nations.ts` |
| **Greedy algorithm** | Take the best option available right now, again and again, without undoing earlier choices. | `placeCapitals()` |
| **HSL color** | Describing a color by hue (position on the color wheel), saturation (vividness) and lightness. Easy to spread colors evenly. | `hslToHex()` |
| **Golden angle** | ~137.5°. Stepping round a circle by it never lands close to an earlier step, so every nation color stays distinct. | `GOLDEN_ANGLE` in `nations.ts` |
| **Alpha (transparency)** | The 4th color number: 0 = invisible, 255 = solid. Our nation tint is about half see-through so terrain shows. | `OVERLAY_ALPHA`, `src/render/overlay.ts` |
| **Off-screen canvas** | A canvas never shown on the page. We draw slow layers there once, then copy them to the screen quickly. | `offscreen()` in `src/main.ts` |
| **Destructuring** | Unpacking values by name or position: `const { world, state } = generateWorld(seed)`. | `src/main.ts` |
| **Tick** | One step of the simulation; for us, one year. | `tick()` in `src/sim/tick.ts` |
| **Logistic growth** | Growth that's fast when there's room and slows to zero at a limit (capacity). | `growPopulation()` in `src/sim/population.ts` |
| **Snapshot** | A copy of data taken at one moment, so later changes in the same step don't affect decisions. | `owner.slice()` in `src/sim/expansion.ts` |
| **`requestAnimationFrame`** | Asks the browser to call a function before the next screen refresh (~60×/s). Our playback loop. | `frame()` in `src/main.ts` |
| **Getter** | A property that runs code when read (`get playing() {...}`), so it always gives the current value. | `createControls()` in `src/ui/controls.ts` |
| **Closure** | A function that remembers variables from where it was created, even after that code finished. | `playing`, `speed` inside `createControls()` |
| **Bit packing** | Squeezing several small numbers into one bigger number (here R, G, B, A into one 32-bit pixel). | `packPixel()` in `src/render/overlay.ts` |
| **Collision check** | Testing whether two boxes overlap. Used to stop labels piling on top of each other. | `overlaps()` in `src/render/labels.ts` |
| **Flood fill** | Spreading out from one cell to connected cells that match a rule (here: same owner), like paint filling a shape. | `floodFill()` in `src/sim/rebellion.ts` |
| **Connected components** | Splitting cells into separate groups that touch each other. We use it to find empty regions. | `emptyRegions()` in `src/sim/emergence.ts` |
| **Union type** | A type that can be one of a few exact values, e.g. `"founded" \| "war" \| ...`. | `SimEvent["type"]` in `src/core/types.ts` |
| **Optional property (`?`)** | A property that may be missing, like `parent?: NationId` (only rebels have one). | `Nation.parent` |
| **Determinism test** | Run the same thing twice and demand identical results. Catches hidden randomness or order bugs. | "1,000 years of history" in `tests/instability.test.ts` |
| **DOM** | The page's structure as objects JavaScript can change, e.g. adding a new line to the event log. | `createEventLog()` in `src/ui/eventLog.ts` |
