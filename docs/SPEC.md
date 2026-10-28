# Realm Forge — Design Spec

How the world is built, how the simulation works, and how it's drawn. This is the **"how it works"** doc.

- **Numbers live elsewhere.** Every tunable value is documented in [`PARAMS.md`](PARAMS.md) and set in code in `gen/params.ts`, `sim/params.ts` or `render/palette.ts`. This doc refers to parameters by `NAME` only.
- **Mirrored structure.** Section headings here match the headings in `PARAMS.md`, so "War" here pairs with "War" there.
- **Adding a feature?** See [§9](#9-adding-a-new-system).

---

## 1. Architecture

Five layers. Each layer may only use the layers below it.

```
ui/        buttons, speed control, event log, export        (screen)
render/    terrain, nation overlay, borders, labels          (screen)
sim/       yearly tick: population, wars, rebellions...      (pure data)
gen/       terrain, climate, biomes, rivers, cells, nations  (pure data)
core/      types, seeded random generator, math, graph helpers
```

**Rules**
- `gen/` and `sim/` have **no** DOM or Canvas code. They take data in and return data out, so they can be tested and later moved to a Web Worker or ported to Rust.
- `sim/` advances a `WorldState` by one year **in place** (`tick(state, rng)` in `sim/tick.ts`) and returns that year's events. No hidden global variables. Each year gets its own RNG fork (`year-N`), and each step a fork of that.
- `render/` reads the world but never changes it.
- All randomness comes from one seeded generator, split into named streams (`rng.fork("war")`). Adding randomness to one system then doesn't reshuffle the others.

**File layout**

```
src/
  core/    rng.ts, types.ts, math.ts, graph.ts
  gen/     params.ts, heightmap.ts, climate.ts, biomes.ts, rivers.ts, cells.ts, nations.ts, names.ts, index.ts
  sim/     params.ts, tick.ts, population.ts, stability.ts, expansion.ts, war.ts, rebellion.ts, collapse.ts, emergence.ts, events.ts
  render/  palette.ts, terrain.ts, overlay.ts, borders.ts, labels.ts
  ui/      controls.ts, eventLog.ts, timeline.ts, export.ts
  main.ts
tests/
docs/      SPEC.md, PARAMS.md, GLOSSARY.md, ref/ (reference screenshots)
```

---

## 2. Data model

The world is a set of **cells** (Voronoi polygons). Cells don't move; only who owns them and how many people live there changes.

```ts
type CellId = number;
type NationId = number;   // 0 = unowned

// Fixed after generation
interface Cell {
  id: CellId;
  site: [number, number]; // center point, in map pixels
  neighbors: CellId[];
  h: number;              // raw elevation 0..1 (land if above the sea level)
  elevation: number;      // height above the sea: 0 = coast, 1 = highest peak (0 for water)
  isLand: boolean;
  temp: number;           // roughly °C
  moisture: number;       // 0..1
  biome: BiomeId;
  river: boolean;
  riverFlow: number;      // how many river sources pass through (0 = none)
  downstream: CellId;     // cell water drains into on its way to the sea (-1 for water)
  coastal: boolean;
  mountain: boolean;      // elevation above MOUNTAIN_H
  capacity: number;       // max population this cell can hold
}

// Changes every year (typed arrays for speed)
interface CellState {
  pop: Float32Array;      // people per cell
  owner: Int32Array;      // NationId per cell
}

interface Nation {
  id: NationId;
  name: string;
  color: string;          // stays the same for the nation's whole life
  capital: CellId;
  founded: number;        // year
  parent?: NationId;      // set if born from a rebellion
  alive: boolean;
  stability: number;      // 0..1
  warWeariness: number;   // 0..1
  // recomputed every year:
  area: number; pop: number; strength: number;
}

interface War {
  id: number;
  attacker: NationId;
  defender: NationId;
  startYear: number;
  score: number;          // positive = attacker winning
}

interface SimEvent {
  year: number;
  type: "founded" | "war" | "peace" | "rebellion" | "collapse" | "annexed" | "capital_moved";
  actors: NationId[];
  text: string;
}

interface WorldState {
  seed: string;
  year: number;
  cells: Cell[];
  state: CellState;
  nations: Map<NationId, Nation>;
  wars: War[];
  truces: { a: NationId; b: NationId; until: number }[];
  events: SimEvent[];
}
```

**Render helpers** (built once during generation):
- `heightmap: Float32Array` (width × height) for terrain shading
- `pixelToCell: Int32Array` (width × height), so the overlay can color any pixel by its cell's owner quickly

**Save files:** `Map` and typed arrays don't convert to JSON automatically. Snapshot save/load must convert them explicitly (to arrays and plain objects).

**Future import:** keep cell and nation shapes close to Azgaar's data model so an importer can be added later. Check Azgaar's docs before building it.

---

## 3. Generation (`gen/`)

Runs once per seed, in this order.

### 3.1 World
Map size `MAP_WIDTH` × `MAP_HEIGHT`, divided into about `CELL_COUNT` cells.

### 3.2 Terrain
1. **Heightmap:** layered simplex noise (`NOISE_OCTAVES`, `NOISE_SCALE`, `NOISE_PERSISTENCE`, `NOISE_LACUNARITY`), multiplied by a fall-off toward the map edges (`EDGE_FALLOFF`) so land forms continents rather than touching the borders.
2. **Domain warp** (`DOMAIN_WARP`): bends the noise so coastlines look less blobby.
3. **Normalize** heights to 0..1.
4. **Sea level:** choose `SEA_LEVEL` automatically so land covers about `LAND_RATIO` of the map.
5. **Mountains:** land above `MOUNTAIN_H` is marked `mountain`.

### 3.3 Climate
- **Temperature:** warmest at the equator line (`EQUATOR_TEMP`), coldest at top and bottom (`POLE_TEMP`), minus `LAPSE_RATE` × elevation.
- **Moisture:** noise plus a bonus near coasts (`COAST_MOISTURE_BONUS`). A rain-shadow behind mountains is a later improvement.

### 3.4 Biomes
Look up each land cell's biome from temperature × moisture (Whittaker-style chart). The biome sets base capacity and movement cost (table in `PARAMS.md`).

### 3.5 Rivers
1. **Drainage:** a *priority flood* from every water cell decides where each land cell drains (`downstream`). It always reaches the sea, even out of dips where plain "steepest downhill" would get stuck.
2. **Sources:** land cells with moisture above `RIVER_SOURCE_MOISTURE` and land elevation above `RIVER_SOURCE_MIN_H`, each picked with chance `RIVER_SOURCE_PROB`.
3. Follow `downstream` to the sea, adding 1 to `riverFlow` on every cell passed. Joining rivers add up. Drop sources whose path is shorter than `RIVER_MIN_LENGTH` cells.
4. Drawn as smooth curves through cell centers, wider where `riverFlow` is higher.

### 3.6 Cells
1. Place cell centers on a jittered grid (`CELL_JITTER`).
2. Build the Voronoi diagram with `d3-delaunay`.
3. Sample height, climate and biome at each center; find neighbors.
4. Build `pixelToCell`.

### 3.7 Capacity
`capacity = biomeBase × (river ? RIVER_CAP_MULT : 1) × (coastal ? COAST_CAP_MULT : 1) × (mountain ? MOUNTAIN_CAP_MULT : 1)`

### 3.8 Starting nations
Place `START_NATIONS` capitals on the highest-capacity land cells, at least `START_MIN_SPACING` cell-steps apart. Each claims a small core of `START_CORE_SIZE` cells around its capital (nearest first). Starting population is `START_POP_FRACTION` × capacity, stability `START_STABILITY`. Colors step round the color wheel by the golden angle (~137.5°) so no two are alike. Each nation logs a `founded` event at year 0.

### 3.9 Names
A Markov-chain name generator (order `NAME_ORDER`) trained on invented example names, one list per culture (`gen/nameCorpus.ts`). Each culture gets a random home point on the map; a nation uses the culture of the nearest home point, so nearby nations sound related. Names never repeat and never copy an example.

---

## 4. Simulation (`sim/`)

One tick = one year. The steps always run in this order:

| # | Step | Section |
|---|---|---|
| 1 | Population | 4.1 |
| 2 | Totals | 4.2 |
| 3 | Stability | 4.3 |
| 4 | Expansion | 4.4 |
| 5 | War declared | 4.5 |
| 6 | War fought | 4.5 |
| 7 | Rebellion | 4.6 |
| 8 | Collapse | 4.7 |
| 9 | Emergence | 4.8 |
| 10 | Events | 4.9 |

**The core loop to protect:** expansion → overextension → instability → fragmentation. If history looks frozen or chaotic, tune this loop first (see "Tuning recipes" in `PARAMS.md`).

### 4.1 Population
- Each owned cell grows toward its capacity: `pop += POP_GROWTH × pop × (1 − pop / capacity)` (logistic growth).
- Cells on an active war front lose `WAR_ATTRITION` of their population.
- Unowned cells hold no population (simplification for now).

### 4.2 Totals
For each living nation, recompute:
- `area` = number of owned cells
- `pop` = sum of owned cells' population
- `strength = pop ^ STRENGTH_POP_EXP × (0.5 + stability)`

### 4.3 Stability
Each year:

```
stability += STAB_RECOVERY
           − overextension
           − warWeariness × WEARINESS_STAB_K
           − capitalDistancePenalty
clamp to 0..1

overextension          = max(0, area − ADMIN_CAP_BASE) × OVEREXT_K
capitalDistancePenalty = max(0, avgHopsToCapital − CAPITAL_DIST_FREE) × CAPITAL_DIST_K
```

**War weariness:** rises by `WEARINESS_GAIN` per year at war, falls by `WEARINESS_DECAY` per year at peace, clamped to 0..1.

### 4.4 Expansion
For each unowned land cell, every neighboring nation rolls to claim it with probability `EXPANSION_RATE / moveCost`; if several succeed, one wins at random. Decisions use ownership from the start of the year (one ring of growth per year). A new cell starts with `NEW_CELL_POP_FRACTION` × capacity people. No expansion across water. `moveCost` comes from the biome table, × `MOUNTAIN_COST_MULT` for mountains and × `RIVER_COST_MULT` for river cells (rivers are cheaper).

### 4.5 War
**Declaring.** For each pair of neighboring nations that aren't at war or in a truce:

```
chance = WAR_BASE_PROB × (strongerStrength / weakerStrength) ^ WAR_STRENGTH_EXP × (1 − attacker.warWeariness)
```

The chance is capped at `WAR_MAX_PROB`. The stronger side is the attacker. A nation can be in at most `MAX_WARS_PER_NATION` wars.

**Fighting.** Each year, for each war:
1. **Front cells** are owned cells that touch an enemy cell.
2. Roll a weighted contest: attacker strength vs defender strength × `DEFENDER_BONUS`.
3. The winner captures up to `FRONT_FLIPS_PER_YEAR` enemy front cells (lowest move cost first; the loser's capital always last).
4. Adjust `score` toward the winner by `SCORE_PER_FLIP` per captured cell.
5. If a capital is captured, see §4.7.

**Ending.** Peace when any of these is true:
- `|score| ≥ PEACE_SCORE`
- either side's war weariness ≥ `WEARINESS_PEACE`
- the war has lasted `MAX_WAR_YEARS`

The winner keeps captured cells. The two sides then can't fight again for `TRUCE_YEARS`. The `peace` event names a winner only if `|score|` ≥ `PEACE_SCORE` / 3; otherwise it's a white peace. Wars with a side that has died end silently.

### 4.6 Rebellion
If a nation's stability is below `REBEL_THRESHOLD`, each year it has a `REBEL_PROB` chance of a rebellion:
1. Pick a seed cell at least `REBEL_MIN_CAPITAL_DIST` steps from the capital (walking only through the nation's own land), or one the capital can't reach that way at all (e.g. an island).
2. Flood-fill outward through the nation's cells, up to `REBEL_MAX_CELLS`, never taking the capital. If the region is smaller than `MIN_AREA`, no rebellion happens.
3. Those cells become a new nation with a new name and color. Set `parent` to the old nation and give it starting stability `REBEL_START_STABILITY`. Its capital is the region's most populous cell.

### 4.7 Collapse
- **Capital lost:** the capital moves to the nation's most populous remaining cell (`capital_moved` event), and stability drops by `CAPITAL_LOSS_STAB_HIT`.
- **Collapse:** a nation with `area < MIN_AREA`, or with no cells left, dissolves. Each of its cells is annexed by the strongest nation bordering *that cell* (judged on ownership before the collapse, so it doesn't chain), or becomes unowned if there's none. Logged as `annexed` (naming the nation that took the most cells) or `collapse`.

### 4.8 Emergence
If a connected unowned land region has at least `EMERGENCE_MIN_REGION` habitable cells, each year it has an `EMERGENCE_PROB` chance of spawning a new nation at its highest-capacity cell, claiming `EMERGENCE_CORE_SIZE` cells around it.

### 4.9 Events
Emit a `SimEvent` for: nation founded, war declared, peace signed, rebellion, collapse, annexation, capital moved. Each event gets a short readable sentence, e.g. *"Year 412: Velmora declares war on the Kethari Reach."*

---

## 5. Rendering (`render/`)

**Target look:** game-like, atmospheric and readable while borders change every year. Reference screenshots go in `docs/ref/`.

### 5.1 Terrain layer (drawn once, cached)
- Color each pixel from elevation + biome (lowland greens → highland browns → snow).
- **Hillshade:** light from direction `HILLSHADE_AZIMUTH` at angle `HILLSHADE_ALTITUDE`, blended in at `HILLSHADE_STRENGTH`. This is the single biggest contributor to the look.
- **Grain:** faint noise texture at `TERRAIN_GRAIN`.
- **Water:** deep-to-shallow gradient with a lighter coastal band.

### 5.2 Nation overlay (redrawn each year)
- Tint land pixels with the owner's color at `OVERLAY_ALPHA` so terrain shows through. Unowned land is not tinted.
- Implementation: write into `ImageData` using a *display-cell* map (`render/displayCells.ts`): like `pixelToCell`, but shifted by smooth waves so borders curve, and with coastal land pixels always mapped to a land cell. If redrawing gets too slow, only recolor cells whose owner changed.

### 5.3 Borders
- Draw a line wherever neighboring pixels have different owners: darker (`BORDER_DARKEN`) and more opaque (`BORDER_ALPHA`).
- Borders between nations at war are drawn in `WAR_FRONT_COLOR`, 2 px wider on each side.

### 5.4 Labels
- Nation name at the center of its territory, sized by area, letter-spaced.
- Hidden below `LABEL_MIN_AREA`. Bigger nations are labeled first; a label that would overlap one already drawn is skipped.
- Later: fade in and out when nations are born or die.

### 5.5 Performance budget
- At 1600×900 with ~10k cells: overlay redraw under 8 ms, sim tick under 5 ms, smooth at 20 years per second.
- Run the sim on the main thread until M6; move it to a Web Worker only if it slows the screen.

---

## 6. UI and playback (`ui/`)

- Play / pause, step one year, speed options from `SPEEDS` (Space, →). Stops at `SIM_YEARS`.
- Year counter drawn on the map canvas itself (`render/hud.ts`) so it appears in videos.
- Event log: scrolling, newest first, filter checkboxes per type, click an event to highlight its nations for `HIGHLIGHT_SECONDS` (others fade to `HIGHLIGHT_DIM`).
- Seed box + **New world** (Enter works too) and **Random**. Both reload the page with `?seed=`.
- **Settings** panel: every `SIM` parameter editable live (`ui/settings.ts`), layer toggles (nations, labels, cell outlines), reset to defaults. Generation numbers are not live; they need a new world.
- **Save** downloads a JSON snapshot (`sim/snapshot.ts`): seed, year, sim params, per-cell owner/pop, nations, wars, truces, events. The map isn't stored; **Load** reloads the page with the save's seed (passing the file through `sessionStorage`), regenerates the map and restores the state. Continuing from a save gives exactly the same history as never stopping.
- **Record** captures the canvas as WebM (`canvas.captureStream()` + `MediaRecorder`) and downloads it on stop.
- Web Worker: not needed. A tick takes ~4 ms and a redraw ~15 ms at 1600×900.

---

## 7. Determinism and testing

- Same seed + same parameters = identical history **in the same browser**. JavaScript's `Math.exp`, `Math.pow` and similar functions can differ very slightly between browsers, so cross-browser results may drift.
- **Key test:** run 1,000 years twice with the same seed; the event lists must be identical.
- Each sim step gets unit tests on a tiny hand-built map (e.g. 6 cells, 2 nations).
- No `Math.random()` anywhere in `gen/` or `sim/`.

---

## 8. Backlog systems

Not designed yet. When one is picked up, give it its own section in §4 and matching parameters in `PARAMS.md`.

- Cultures and religions (affect rebellion and war odds)
- Dynasties and succession crises
- Trade routes and economy
- Alliances and diplomacy
- Naval expansion across water
- Plagues, famines and golden ages
- Azgaar map import
- Rust port of `sim/` (after M5)

---

## 9. Adding a new system

1. Write the design here as a new subsection of §4 (or §3 or §5). Say where it runs in the tick order.
2. Add its parameters to `PARAMS.md` under the **same heading**: value, range, and what happens when it goes up or down.
3. Add the values to the matching `params.ts`.
4. Write tests on a tiny hand-built map.
5. Log the decision in `CLAUDE.md`.
6. If this doc passes ~700 lines, or one system gets large, move that system to `docs/systems/<name>.md` and link it from here.

---

## 10. Open questions

- Map size and aspect ratio (default 1600×900)?
- Single continent vs archipelago presets?
- Slow down time automatically during major events?
- Which reference frames define the target look? (Add them to `docs/ref/`.)
