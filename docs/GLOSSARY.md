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
| **Weighted coin flip** | A random yes/no where one side is more likely, e.g. attacker wins with chance A ÷ (A + D). | `fightBattle()` in `src/sim/war.ts` |
| **Pair key** | Turning two ids into one number that's the same in either order, so (3, 7) and (7, 3) match. | `pairKey()` in `war.ts` |
| **Comparator** | A function telling `sort` which of two items comes first (negative, zero or positive). | `.sort((x, y) => cost(x) - cost(y) \|\| x - y)` in `war.ts` |
| **`Infinity`** | A number bigger than every other number. Handy to push something to the end of a sort. | capital cost in `fightBattle()` |
| **Serialization** | Turning live data (Maps, typed arrays) into plain text like JSON so it can be saved, and back again. | `toSnapshot()` / `fromSnapshot()` in `src/sim/snapshot.ts` |
| **JSON** | A text format for data: objects `{}`, lists `[]`, numbers and strings. What our save files are. | Save / Load |
| **Blob** | A chunk of file data in the browser (text, video…) that can be downloaded. | `downloadFile()` in `src/ui/files.ts` |
| **Promise / `async` / `await`** | A value that arrives later (like a file the user picks). `await` pauses until it's ready. | `pickSnapshot()` and the Load button |
| **`sessionStorage`** | Small storage that survives a page reload in the same tab. We park a loaded save there while the page reloads. | `LOAD_KEY` in `src/main.ts` |
| **MediaRecorder** | Browser feature that records a live video stream (here, the canvas) to a file. | `createRecorder()` in `files.ts` |
| **Event delegation** | One click listener on a parent instead of one per child; it checks which child was clicked. | event log in `src/ui/eventLog.ts` |
| **Generic (`<T>`)** | A placeholder type filled in when used, e.g. `element<HTMLCanvasElement>("#map")`. | `element()` in `src/main.ts` |
| **`keyof` / `typeof`** | TypeScript tools to get a type from a value: `keyof typeof SIM` = all parameter names. | `SimParamName` in `src/sim/params.ts` |
| **Data table (data-driven design)** | Describing things as rows of numbers instead of separate code, so adding a race means adding a row, not new logic. | `RACES` in `src/gen/params.ts` |
| **`Partial<T>`** | A version of type T where every property is optional. Lets a race list only the biomes it cares about. | `affinity`, `terrainCost` in `RaceTraits` |
| **`Exclude<T, U>`** | A type with some options removed, e.g. every race except `None`. | `PlayableRace` in `src/core/types.ts` |
| **`??` (nullish coalescing)** | "Use the left value, or the right one if the left is missing": `affinity[biome] ?? 1`. | `affinityFactor()` in `src/gen/races.ts` |
| **Type assertion (`as`)** | Telling TypeScript "trust me, this number is a RaceId". Use sparingly: it skips a check. | `rebel()` in `src/sim/rebellion.ts` |
| **Weighted random pick** | Choosing randomly where some options are likelier: walk the list subtracting weights until a random point is passed. | `placeRaceHomes()` in `src/gen/races.ts` |
| **Multiplier baseline** | Making 1.0 mean "normal" so a new rule changes nothing until a value moves away from 1. Humans are all 1.0. | race traits |
| **Drift toward a target (exponential smoothing)** | Each year move a fixed share of the way to where a value "wants" to be. Changes are quick when far off, slow when close, and old shocks fade. | `updateOpinions()` in `src/sim/diplomacy.ts` |
| **Hysteresis** | Using a higher line to switch on than to switch off (ally at 0.15, break below 0.05), so a value hovering near one line doesn't flip back and forth. | `ALLIANCE_MIN_OPINION` / `ALLIANCE_BREAK_OPINION` |
| **Re-export** | A file passing on something it imports, so older `import`s keep working after code moves. | `export { neighborPairs, pairKey }` in `src/sim/war.ts` |
| **Default parameter** | A value a function uses when the caller leaves that argument out: `attackHelp = 0`. | `warChance()` in `src/sim/war.ts` |
| **`afterEach`** | A test hook that runs after every test in the file; we use it to put changed settings back. | `tests/diplomacy.test.ts` |
| **Dijkstra's algorithm** | Finding the cheapest path from a start to every cell, always expanding the cheapest-so-far cell next (with a min-heap). Like BFS, but steps can cost different amounts. | `controlMap()` in `src/sim/control.ts` |
| **Multi-source search** | Starting a search from many cells at once (all capitals, all province seeds), so each cell ends up belonging to the nearest one. | `controlMap()`, `placeProvinces()` |
| **Exponential falloff** | `exp(−cost / range)`: 1 at the start, ~37% at `range`, fading smoothly toward 0 but never reaching it. | `control` in `src/sim/control.ts` |
| **Fisher–Yates shuffle** | Putting a list in random order fairly: swap each item with a random earlier one, from the end backwards. | `placeProvinces()` in `src/gen/provinces.ts` |
| **Two-queue BFS** | A breadth-first search that always empties one queue (here: same province) before touching the other, so it prefers some cells without sorting. | `floodFill()` in `src/sim/rebellion.ts` |
| **Saturation (diminishing returns)** | A bonus that grows with how much you have, then stops: `min(1, access / RESOURCE_SATURATION)`. Keeps the rich from getting endlessly richer. | `resourceBonus()` in `src/sim/resources.ts` |
| **Profiling** | Timing each part of the code to find what's slow before trying to speed it up. M9 found war fronts and repeated lookups. | decision log, 2026-10-29 |
| **Lookup table (caching)** | Working a value out once per pass and storing it in an array, instead of recalculating it for every cell. | `grainBonuses()` in `src/sim/resources.ts` |
| **`switch`** | Picking code by the exact value of something; TypeScript checks every case is handled. | `fits()` in `src/gen/resources.ts` |
| **Environment variable** | A setting passed to a program from outside, e.g. `RACE_BALANCE=1` turns on the slow balance test. | `tests/raceBalance.test.ts` |
| **Diffing** | Comparing two versions of data to find what changed. M10 compared last year's owners with this year's to guess where battles were, until armies began reporting real ones. | history, see decision log |
| **Stencil (mask)** | An image that's solid where something should show and clear elsewhere, used to cut another image to shape. | occupied-land mask in `src/render/effects.ts` |
| **Composite operation** | How a new drawing combines with what's already on a canvas. `"destination-in"` keeps old paint only where the new paint is solid, which cuts the colored land into stripes. | `drawOccupiedHatch()` in `effects.ts` |
| **Canvas pattern** | A small image tiled over an area, like wallpaper. Moving its transform makes the tiles slide. | `stripeTile()` / `createPattern` in `effects.ts` |
| **Sprite** | A small pre-drawn picture copied many times, much faster than drawing it from scratch each time. | `glowSprite()` for smoke and embers |
| **Easing** | Bending the speed of an animation (fast start, slow finish) so it feels natural rather than mechanical. | `easeOut()` in `effects.ts` |
| **Float32 precision** | A `Float32Array` stores numbers with ~7 digits, so 0.7 becomes 0.69999999. Compare with care near a threshold. | comment in `tests/effects.test.ts` |
| **Stock vs rate** | A *stock* is an amount that builds up and gets used up (a nation's soldier reserve); a *rate* is how fast it changes each year (`LEVY_REFILL`). Stocks give the sim memory: a lost army stays lost. | `updateManpower()` in `src/sim/manpower.ts` |
| **Weighted sum** | Adding things up while counting some more than others: each cell's people count toward the soldier cap × their race's `martial` × how firmly the nation controls them. | `levyPop` in `src/sim/totals.ts` |
| **A/B comparison** | Running the old code and the new code on the same seeds and comparing the numbers, so you can see what a change really did. | how M11 step 1 was tuned (decision log) |
| **Pathfinding** | Dijkstra's algorithm with a memory: `cameFrom` records how we reached each cell, so the actual route can be read backward from the goal. | `findPath()` in `src/sim/armies.ts` |
| **Interpolation** | Working out a point part of the way between two known points. Banners slide because we draw them between cells of the march instead of jumping. | `marchPosition()` in `src/render/armies.ts` |
| **Derived value** | A number worked out from other data when needed, not stored, so it can't go out of date: a nation's total soldiers are always its reserve plus its armies. | `soldiers()` in `src/sim/manpower.ts` |
| **Fall-through rules** | A list of rules tried in order, where a rule that can't work hands over to the next instead of giving up. An army that can't reach one target tries the next. | `direct()` in `src/sim/armies.ts` |
| **Invariant** | Something that must always be true of the data. Here: land is only occupied by a nation at war with its owner. A sweep at the end of each year keeps it true whatever happened. | `releaseOccupations()` in `src/sim/siege.ts` |
| **Breadth-first search (BFS)** | Exploring outward one ring of neighbors at a time, so the first match found is the nearest. Armies muster at the settlement closest to the front this way. | `musterCell()` in `src/sim/armies.ts` |
| **Type guard** | A function that tells TypeScript what something is if it returns true. `main is War` means "after this check, `main` isn't undefined", so no `!` is needed. | `helping()` in `src/sim/armies.ts` |
| **Running counter (unique ids)** | A number that only ever goes up, so no two things get the same id, even if they exist at different times. Ids built from the year could repeat. | `nextWarId` in `startWar()`, `src/sim/war.ts` |
| **Stuck state (equilibrium)** | A balance where forces cancel out, so nothing changes any more. Empires froze this way: land lost to rebels was won back, and stability at 0 cost nothing. A long run can look busy and still be stuck, which is why we measure how long empires last. | tuning pass, `src/sim/rebellion.ts` |
| **Measure, don't guess** | Finding a cause by tracking numbers instead of trying settings. Counting one empire's revolts (5 in 1,000 years, with unrest at maximum) exposed a bug no parameter could fix. | tuning pass |
| **Exponential decay** | Something fading by the same share each period: fast at first, then slower, never quite zero. `Math.exp(-age / VIGOR_YEARS)` is how a young nation's vigor fades. | `adminCap` in `src/sim/stability.ts` |
| **Precomputing** | Working something out once and reusing it, instead of repeating the work. One yearly map of land near cities replaced a search per cell. | `cityAreas` in `src/sim/land.ts` |
| **Overfitting** | Tuning until the numbers look good on the examples you tuned on, then finding they don't hold on new ones. Our "4 of 10 worlds" was 1 in 20 on fresh seeds. | giants tuning |
| **Holdout set** | Examples kept aside and never tuned on, used only for the final check, so the result is honest. | seeds named `holdout-N` in the tuning runs |
| **Noise** | Differences that come from chance, not from your change. In a chaotic simulation any tiny change reshuffles history, so you need many seeds to see a real effect. | comparing settings |
| **Cellular automaton (neighbor rule)** | Many small cells each follow one simple rule about their neighbors, and big shapes appear by themselves. Here: copy a random neighbor now and then, and solid blobs of culture grow. | `assimilate()` in `src/sim/culture.ts`, `spreadFaith()` in `src/sim/faith.ts` |
| **Feedback loop** | An effect that feeds its own cause. Cults make land restless, and restless land spreads cults faster. Worth measuring: loops can run away. | Whispers in `src/sim/land.ts` |
| **Leave-one-out test** | Switch off one thing at a time and see what changes, to find which one is responsible. | How we found that Order was cutting rebellions |
| **Event hash** | One number worked out from every event's text, so two histories can be compared at a glance. Forks leave other random streams alone, so a feature using only its own fork keeps the same hash, which proved rulers step 1 changed no history. | `rng.fork("ruler")` in `src/sim/newNation.ts` |
| **Incremental update** | Instead of redoing all the work each time, keep the old result and fix only what changed. The test that matters: the result must equal doing it all from scratch. | `createNationOverlay()` in `src/render/overlay.ts` |
| **Options object** | One object holding many related settings, passed to a function, so it needs one extra argument and not twenty. | `MapLook` in `src/render/palette.ts`, `LOOK_ATLAS` |
| **Default parameter** | A value a function uses when the caller leaves that argument out, so old calls keep working unchanged. | `look: MapLook = LOOK_STANDARD` in `src/render/labels.ts` |
| **Canvas transform** | Moving or scaling the canvas's drawing position, so a picture can be drawn around (0, 0) and placed anywhere at any size. `save()` and `restore()` undo it afterwards. | `atPlace()` in `src/render/atlasMarkers.ts` |
| **Static site** | A website that's only files sent to the browser, with no program running on a server. The game all runs in your browser, so it can be hosted for free. | `npm run build` makes it, in `dist/` |
| **CI workflow (GitHub Actions)** | A recipe GitHub runs for you on its own computers whenever you push. Ours tests the game, builds it and publishes it, and a failed test stops the publish. | `.github/workflows/publish.yml` |
| **Interface (as a contract)** | A promise of which functions something has, without saying how they work. Any object that has them can stand in: the AI today, a player later. | `Controller` in `src/sim/ai/controller.ts` |
| **Command pattern** | Turning a choice into a small piece of data ("declare war on Kethar to reclaim") that something else checks and carries out. Easy to log, replay and refuse. | `Command` in `src/sim/commands.ts` |
| **Passing dependencies in** | Giving a function the things it uses (here, who makes each nation's choices) as a parameter, instead of it reaching for a fixed one. Lets tests and later a player swap them. | `controllers` parameter of `tick()` and the rule steps |
| **Circular import** | Two files that import each other. It can half-work and break in confusing ways, so the AI imports the rule files but never the other way round. | `sim/ai/default.ts`, `sim/marching.ts` |
| **Golden test** | A test that compares output with a fingerprint recorded earlier, to prove a refactor changed nothing. | `tests/golden.test.ts` |
| **Refactor** | Changing how code is organized without changing what it does. | M15 steps 1–4 |
| **Chaos (sensitive dependence)** | Tiny changes early grow into completely different histories. Why a fair change to the dice can swing a 5-world average a lot. | M15 decision log |
| **Write-only record** | Data the simulation writes for others to read but never reads itself, so it can't change what happens. | `sim/warRecords.ts` |
| **CSS grid / media query** | Laying a page out in columns, and switching layout by screen width (`@media (min-width: 1200px)`). | side panel in `index.html` |
| **Sticky position** | An element that scrolls with the page until it reaches the top, then stays in view. | `#panel` in `index.html` |
| **SVG polyline** | A line through a list of points, drawn by the browser from a few numbers: the war report's score line. | `sparkline()` in `src/ui/warRoom.ts` |
| **Round-robin region growing** | Several regions grow from their seeds in turns, one cell each per round, each taking its cheapest next cell. Fair shares, but terrain still shapes the borders. | `growKingdoms()` in `src/gen/kingdoms.ts` |
| **Farthest-first selection** | Picking each new point as far as possible from the ones already picked, so they spread evenly. | `kingdomHomes()` in `src/gen/kingdoms.ts` |
| **Discriminated union** | A type that is one of several shapes, told apart by a field like `kind`. TypeScript then knows `kingdoms` exists only when `kind` is `"settled"`. | `StartOptions` in `src/core/types.ts` |
| **`public/` folder** | Files Vite copies as they are into the finished site, so the page can load them by path (e.g. `portraits/orc-m-ordinary.webp`). Good for images; code goes in `src/`. | `public/portraits/`, `public/frames/` |
| **Promise / `async` / `await`** | A promise is a value that arrives later, like an image still downloading. `await` pauses a function until it arrives, without freezing the page. | `load()` and `draw()` in `src/ui/rulerCard.ts` |
| **`import.meta.glob`** | A Vite feature that lists the files matching a pattern, so a test can check they exist without reading the disk itself. | `tests/portraits.test.ts` |
| **Web font loading** | A font file from the web arrives a moment after the page. Canvas won't wait for it, so `document.fonts.load()` is awaited first, or the text would quietly use a fallback font. | `draw()` in `src/ui/rulerCard.ts` |
| **Union of string literals** | A type whose only allowed values are a few fixed words, like `"revolt" \| "pretender"`. A typo such as `"pretnder"` is caught before the code runs. | `UprisingKind` in `src/sim/rebellion.ts` |
| **Event loop** | JavaScript does one thing at a time. Messages and timers wait in a queue until the running code stops, so code that runs for a minute without a break leaves everything else waiting. | `runYears()` in `tests/longRun.ts` |
| **`structuredClone`** | Makes a deep copy of a value: every object, list and Map inside it is copied too, so changing the copy never touches the original. A plain `{ ...x }` only copies the top level. | `runFuture()` in `src/sim/odds.ts` |
| **Monte Carlo** | Working out how likely something is by trying it many times with different dice and counting. 20 futures of the same war give rough odds of who wins. | `runFutures()` in `src/sim/odds.ts` |
| **Canvas transform** | `ctx.setTransform(zoom, 0, 0, zoom, dx, dy)` tells the canvas to scale and shift everything drawn after it. We draw in map coordinates and the transform puts them where the camera shows them, so no drawing code needs to know about zoom. | `setView()` in `src/render/camera.ts` |
| **Debounce** | Waiting until something has stopped happening before reacting: each move of the map restarts a short timer, and only when it runs out is the slow sharp redraw done. | `setCamera()` in `src/main.ts` |
| **Predicate function** | A small function that answers yes or no, named like a question (`onlyDefending`, `holdingOut`). Several rules can then ask the same question in the same words instead of each repeating the check. | `onlyDefending()` in `src/sim/helpers.ts`, `holdingOut()` in `src/sim/war.ts` |
| **Multiplying by e^x** | `Math.exp(rng.range(-0.6, 0.6))` gives a factor from ×0.55 to ×1.8 that is as likely to halve as to nearly double. Adding on the "x" side and multiplying on the result side keep "too much" and "too little" balanced. | `makeRuler()` in `src/gen/rulers.ts`, `estimate()` in `src/sim/ai/default.ts` |
| **`satisfies`** | `{ ... } as const satisfies SomeType` checks that a value fits a type without changing the value's own, narrower type. The policy choices are checked against `Policies` (a typo like `"alwys"` is an error), but stay exact lists the code can loop over. | `POLICY_CHOICES` in `src/sim/ai/player.ts` |
| **Optional property and `delete`** | `player?: Player` means a world may have no player at all. `delete state.player` removes it again, so "no one is playing" looks exactly like a world from before playing existed. | `WorldState.player` in `src/core/types.ts`, `applyPlay()` in `src/sim/play.ts` |
| **Mapped type** | `{ [K in ChoicePolicy]: Record<Policies[K], string> }` builds a type by going through a list of keys: for each policy, a label for each of its answers. Leave one answer out and TypeScript complains, so the screen can't forget a choice. | `ANSWER_LABELS` in `src/ui/play.ts` |
| **localStorage** | A small store in the browser that keeps text between visits to the page, on that computer only. Good for preferences (which dispatches pause the game); not for history, which must travel in save files. Reading it can fail (private windows), so it's wrapped in `try`. | `loadDispatchesOff()` in `src/ui/play.ts` |
| **Bounded search** | Looking through a map only up to a fixed distance. Supply searches at most `SUPPLY_RANGE` cell links so faraway land cannot feed an invasion indefinitely. | `src/sim/supply.ts` |
| **Validation seeds** | Fixed simulated worlds held back while making tuning choices, then run to check whether the behavior carries over. Small samples still have substantial chance variation. | `tests/campaignBalance.test.ts` |
