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
  gen/     params.ts, heightmap.ts, climate.ts, biomes.ts, rivers.ts, cells.ts, races.ts, resources.ts, provinces.ts, nations.ts, names.ts, index.ts
  sim/     params.ts, tick.ts, population.ts, totals.ts, manpower.ts, control.ts, land.ts, resources.ts, stability.ts, expansion.ts, diplomacy.ts, war.ts, armies.ts, rebellion.ts, collapse.ts, emergence.ts, events.ts, snapshot.ts
  render/  palette.ts, terrain*.ts, atlasChart.ts, atlasMarkers.ts, atlasSymbols.ts, overlay.ts, labels.ts, alliances.ts, armies.ts, heatmap.ts, resources.ts, settlements.ts, hud.ts
  ui/      controls.ts, eventLog.ts, timeline.ts, export.ts
  main.ts
tests/
docs/      SPEC.md, PARAMS.md, GLOSSARY.md, systems/ (one file per later system), art/
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
  resource: ResourceId;   // deposit here, 0 = none (§4.11)
  richness: number;       // 0..1 (0 without a deposit)
  defensibility: number;  // ~0.8..2, how hard it is to take in war
  province: number;       // province id, −1 for water
}

// Changes every year (typed arrays for speed)
interface CellState {
  pop: Float32Array;      // people per cell
  owner: Int32Array;      // NationId per cell
  race: Uint8Array;       // RaceId of the people living there (0 = nobody)
  unrest: Float32Array;   // 0..1 (§4.11)
  devastation: Float32Array; // 0..1
  development: Float32Array; // 0..1
  settlement: Uint8Array; // 0 none, 1 village, 2 town, 3 city
  ownedSince: Int32Array; // year the current owner took it
  prevOwner: Int32Array;  // who had it before (0 = nobody)
  occupier: Int32Array;   // nation holding it in a war (0 = nobody, §4.13); the owner stays the owner
  siege: Float32Array;    // progress of the siege here, 0..1 (§4.13)
  culture: Uint16Array;   // the realm whose people these are (§4.14, 0 = nobody)
  faith: Uint8Array;      // FaithId of the people there (§4.14, 0 = nobody)
}

type RaceId = number;     // index into RACES; 0 = none

interface Nation {
  id: NationId;
  name: string;
  color: string;          // stays the same for the nation's whole life
  capital: CellId;
  founded: number;        // year
  parent?: NationId;      // set if born from a rebellion
  race: RaceId;           // ruling race, fixed for the nation's whole life
  culture: number;        // culture of its rulers (§4.14)
  faith: FaithId;         // faith of its rulers (§4.14); can change
  alive: boolean;
  fell?: number;          // year it died
  stability: number;      // 0..1
  warWeariness: number;   // 0..1
  reserve: number;        // trained soldiers not yet in an army, in pop units (§4.13)
  // recomputed every year:
  area: number; pop: number; strength: number;
  manpowerCap: number;    // most soldiers it can keep (§4.13)
  foreignShare: number;   // share of pop not of the ruling race, 0..1
  unrest: number;         // population-weighted average of each race's `unrest` trait
  control: number;        // population-weighted average control, 0..1 (§4.2)
  access: number[];       // total richness of each resource owned, indexed by ResourceId (§4.11)
}

interface War {
  id: number;
  attacker: NationId;
  defender: NationId;
  startYear: number;
  score: number;          // positive = attacker winning; battle score + occupation score
  battleScore: number;    // the part won in battle, which adds up over the war (§4.13)
  goal: "conquer" | "reclaim" | "raid" | "support"; // what it's for; support = an ally who joined (§4.13)
  goalCells: CellId[];    // what the attacker went to war to take; empty for raid and support
  joined?: number;        // set if an ally joined someone else's war: that main war's id (§4.12)
}

interface Army {          // one side's soldiers in one war (§4.13)
  id: number;
  owner: NationId;
  war: number;            // the war it was raised for
  cell: CellId;
  size: number;           // soldiers, in pop units
  morale: number;         // 0..1
  target: CellId;         // where it's heading, or NO_TARGET (−1)
  path: CellId[];         // cells still to walk, next first
  trail: CellId[];        // cells walked this year, for the map animation
}

interface BattleReport { // this year's battles, for the map (§4.13)
  cell: CellId;
  winner: NationId;
  loser: NationId;
  lost: number;          // soldiers killed, both sides
  routed: boolean;       // was the loser's army destroyed?
}

interface Alliance {
  a: NationId; b: NationId; // a < b
  since: number;            // year
}

interface SimEvent {
  year: number;
  type: "founded" | "war" | "peace" | "rebellion" | "collapse" | "annexed" | "capital_moved" | "alliance" | "alliance_ended" | "city_founded" | "battle";
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
  armies: Army[];
  nextArmyId: number;
  nextWarId: number;
  battles: BattleReport[]; // not saved
  truces: { a: NationId; b: NationId; until: number }[];
  events: SimEvent[];
  raceHomes: { race: RaceId; at: [number, number] }[]; // homeland points (§4.10)
  relations: Map<number, number>; // opinion −1..1 per pair of nations that have met, keyed by pairKey (§4.12)
  alliances: Alliance[];
  cityNames: Map<CellId, string>; // cells that have grown into cities (§4.11)
}
```

Races and resources are fixed data tables (`RACES`, `RESOURCES` in `gen/params.ts`), described in §4.10 and §4.11.

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

### 3.7b Resources, terrain defense and provinces
Each cell also gets `defensibility`, maybe a resource deposit (stream `resources`), and a province (stream `provinces`). How they're made is in §4.11.

### 3.8 Starting nations
Place `START_NATIONS` capitals on the highest-capacity land cells, at least `START_MIN_SPACING` cell-steps apart. Once a capital has its race (below) it may shift up to `START_HOME_RANGE` steps to the free land that race likes best. Each claims a core of `START_CORE_SIZE × startSize` cells (race trait), cheapest terrain for its race first, so elves spread along their forests. Starting population is `START_POP_FRACTION` × capacity, stability `START_STABILITY`. Colors step round the color wheel by the golden angle (~137.5°) so no two are alike. Each nation logs a `founded` event at year 0.

Each starting nation's race is the race of the nearest race homeland (§4.10); its core cells are settled by that race. If a race ends up with no starting nation, the capital nearest to that race's homeland switches to it, so every race is on the map at year 0.

### 3.8b Settled start: old kingdoms
The default start since M16b: 5–10 old kingdoms share all the habitable land at year 0, with subject peoples, core land, towns and cities. Picked in the toolbar or with `?start=5`…`10`; `?start=open` gives §3.8. See [`systems/start.md`](systems/start.md).

### 3.9 Names
A Markov-chain name generator (order `NAME_ORDER`) trained on invented example names, one list per culture (`gen/nameCorpus.ts`). Each culture gets a random home point on the map; a nation uses the culture of the nearest home point, so nearby nations sound related. Names never repeat and never copy an example.

**Names by race family:** Human nations keep the four regional cultures above. Elves, Dwarves and Orcs each get one name list of their own, shared within a family (Light and Dark Elves both sound elvish), so a nation's race shows in its name.

---

## 4. Simulation (`sim/`)

One tick = one year. The steps always run in this order:

| # | Step | Section |
|---|---|---|
| 1 | Population | 4.1 |
| 2 | Totals, then each cell's land (unrest, devastation, development, settlements), then its people (assimilation, faith) | 4.2, 4.11, 4.14 |
| 3 | Stability | 4.3 |
| 4 | Expansion | 4.4 |
| 4b | Diplomacy | 4.12 |
| 5 | War declared | 4.5 |
| 5b | Armies raised and reinforced | 4.13 |
| 6 | Campaign (`CAMPAIGN_STEPS` seasons of target, march, battle, siege, attrition) | 4.13 |
| 6b | Peace | 4.5 |
| 7 | Rebellion | 4.6 |
| 7b | Succession: schemes, reigns end, crises and civil wars | 4.15 |
| 7c | Vassals: those of fallen overlords go free; those whose overlord has a new ruler may declare independence | `systems/vassalage.md` |
| 8 | Collapse, then armies with no war go home and leftover occupations end | 4.7, 4.13 |
| 9 | Emergence | 4.8 |
| 10 | Events | 4.9 |

**The core loop to protect:** expansion → overextension → instability → fragmentation. If history looks frozen or chaotic, tune this loop first (see "Tuning recipes" in `PARAMS.md`).

Races (§4.10), land detail (§4.11) and culture and faith (§4.14) don't add steps. They change numbers inside steps 1–9; each section below says how.

### 4.1 Population
- Each owned cell grows toward its capacity: `pop += POP_GROWTH × growth × pop × (1 − pop / capacity)` (logistic growth), where `growth` is the trait of the race living in the cell and `capacity` is the **effective capacity**: the cell's capacity × that race's affinity (§4.10) × `(1 − devastation × DEVASTATION_CAP_LOSS)` × the owner's grain bonus (§4.11).
- War hurts cells where armies actually are: battles kill people and devastate their cell, marching and sieges devastate the land (§4.13).
- Unowned cells hold no population (simplification for now); their race, culture, faith, unrest, development and settlement are reset to 0. Devastation stays and heals.

### 4.2 Totals
For each living nation, recompute:
- `area` = number of owned cells
- `pop` = sum of owned cells' population
- `strength = militaryPop ^ STRENGTH_POP_EXP × (0.5 + stability)`, where `militaryPop` = the sum over owned cells of `pop × martial` (the trait of the race living in each cell, so an orc province makes a human kingdom stronger), × the iron bonus
- `access[resource]` = sum of richness over the nation's deposits of each resource (§4.11); occupied cells don't count
- **Manpower** (§4.13): `manpowerCap = levyPop × LEVY_SHARE`, where `levyPop` = the sum over owned cells of `pop × martial × control` (× the iron bonus), so loosely held provinces send few soldiers, and occupied cells send none. The reserve refills toward the cap.
- `foreignShare` = share of `pop` living in cells whose race isn't the nation's race
- `unrest` = population-weighted average of the `unrest` trait of the races living in the nation
- **`control`** per cell, 0..1, the owner's grip (`sim/control.ts`, worked out fresh each year, never stored): travel cost from the capital through the nation's own cells (Dijkstra, paying each cell's move cost for the ruling race), then `control = exp(−travelCost / (CONTROL_RANGE × cohesion))`. Cells the capital can't reach over its own land (e.g. islands) get `CONTROL_ISLAND`. So mountains and marshes, not just distance, decide where an empire frays. The nation's `control` = population-weighted average.

### 4.3 Stability
Each year:

```
stability += STAB_RECOVERY × goldBonus
           − overextension
           − warWeariness × WEARINESS_STAB_K
           − controlPenalty
           − foreignPenalty
clamp to 0..1

overextension  = max(0, area − adminCap) × OVEREXT_K
adminCap       = ADMIN_CAP_BASE × cohesion × (1 + VIGOR_BONUS × e^(−age / VIGOR_YEARS))
controlPenalty = max(0, CONTROL_FREE − nation.control) × CONTROL_STAB_K
foreignPenalty = max(0, foreignShare − FOREIGN_FREE) × FOREIGN_K / tolerance
```

`cohesion` and `tolerance` are traits of the nation's ruling race. `age` is years since the nation was founded: young realms can rule far more land, and that vigor fades, so empires built fast crack a few generations later while younger states rise.

**War weariness:** rises by `WEARINESS_GAIN / endurance` per year at war (ruling race's trait), falls by `WEARINESS_DECAY` per year at peace, clamped to 0..1.

### 4.4 Expansion
For each unowned land cell, every neighboring nation rolls to claim it with probability `EXPANSION_RATE × horsesBonus / (moveCost × timberBonus)`; if several succeed, one wins at random. Decisions use ownership from the start of the year (one ring of growth per year). A new cell is settled by the claiming nation's race and starts with `NEW_CELL_POP_FRACTION` × its race capacity in people. No expansion across water. `moveCost` comes from the biome table, × `MOUNTAIN_COST_MULT` for mountains and × `RIVER_COST_MULT` for river cells (rivers are cheaper), × the claiming nation's race terrain cost for that biome (and its `mountainCost` on mountains).

### 4.5 War
**Declaring.** For each pair of neighboring nations that aren't at war, allied, or in a truce:

```
chance = WAR_BASE_PROB × aggression × estimate ^ WAR_STRENGTH_EXP × (1 − attacker.warWeariness) × mood × motive
estimate = attackSide / defendSide × confidence × ruler's boldness × e^(±INTEL_ERROR, × INTEL_FOREIGN against another race)   // M18
power      = soldiers × (0.5 + stability)                           // fightingPower, §4.13
attackSide = attacker power + Σ power of attacker's helpers × ALLY_ATTACK_PROB
defendSide = defender power + Σ power of defender's helpers × ALLY_DEFEND_PROB
mood       = max(0, 1 − opinion × OPINION_WAR_K)
motive     = (claim ? CLAIM_WAR_BONUS : 1) × (1 + WAR_VALUE_K × value of the defender's best border cell)
```

The chance is capped at `WAR_MAX_PROB`. Only a side whose **estimate** is above 1, that believes it's the stronger, considers war, so both sides may; before M18 only the truly stronger side did. The estimate (misjudgment, [`systems/realwar.md`](systems/realwar.md)) fools only the decision: battles use true strength. `aggression`, `confidence` and `temper` are the ruling race's traits. A nation can be in at most `MAX_WARS_PER_NATION` wars it declares or is declared on. `opinion` and **helpers** (allies who would join) are from §4.12, so allies deter attacks and hatred invites them. A **claim** means the defender holds land the attacker lost to it within `CLAIM_YEARS`; cell **value** (as the attacker's race sees it) is in §4.11. Each war gets a **goal** (§4.13). The `war` event says why: *"…to reclaim its lost lands"* for a claim, *"…to raid its lands"* for a raid, otherwise *"…, coveting its iron"* when the best border cell holds a resource the attacker's race favors, or else *"…to seize the lands around Arvenna"* when the goal holds a city.

**Allies join.** Right after a declaration, each of the defender's helpers joins with chance `ALLY_DEFEND_PROB`, and each of the attacker's with `ALLY_ATTACK_PROB`. A helper is an ally that borders the enemy or the ally it's helping, isn't allied with the enemy too, isn't already at war or in a truce with it, and isn't at its own war limit. Each joining ally gets its own `War` with the enemy (its own army and score), with `joined` set to the main war's id.

**Fighting.** Armies do this now, in seasons: march, battle, siege (§4.13). `DEFENDER_BONUS` helps the army that stood its ground. Every army has a **general** whose skill and victories multiply its power (M18, [`systems/realwar.md`](systems/realwar.md)). Cells don't change owner during a war; they're **occupied**.

**Ending.** Peace when any of these is true:
- the attacker occupies every goal cell (it wins, whatever the score)
- `|score| ≥ PEACE_SCORE`
- the losing side **sues for peace** and the winner accepts (M18, [`systems/realwar.md`](systems/realwar.md)): only a side behind by `WIN_SCORE` or more, after the war's first year; the winner takes only the goal cells it holds
- either side's war weariness ≥ `WEARINESS_PEACE` (a nation only defending, attacking no one, gains weariness `DEFEND_WEARINESS` times as fast, from the yearly gain and from losses)
- the war has lasted `MAX_WAR_YEARS`

`score` is brought up to date first (`endWars`, §4.13 "War score and peace"). The peace event names a winner if the goal was reached or `|score|` ≥ `WIN_SCORE`, and that winner takes land by the terms in §4.13, through `setOwner`, with unrest raised to at least `UNREST_CONQUEST`; otherwise it's a white peace. Either way all other occupations end. The two sides then can't fight again for `TRUCE_YEARS`. If the winner took a deposit, the text names it (*"…, taking 6 provinces and its iron."*). Wars with a side that has died end silently. A joined war can end on its own terms the same way, and otherwise ends silently (with a truce) in the year its main war ends.

### 4.6 Rebellion
If a nation's stability is below `REBEL_THRESHOLD`, each year it has a chance of a revolt of `REBEL_PROB × unrest × (total unrest of its cells / REBEL_RESTLESS_CELLS)` (`unrest` from §4.2, then the cells' own unrest from §4.11). So a lot of restless land means frequent revolts, and calm land doesn't revolt however shaky the nation. Each revolt has a `REBEL_SPREAD` chance of setting off another in that nation the same year, up to `REBEL_MAX_SPREAD`: this is how a great empire falls within a few bad years. Each revolt:
1. Pick a seed cell at least `REBEL_MIN_CAPITAL_DIST` steps from the capital (walking only through the nation's own land), or one the capital can't reach that way at all (e.g. an island). **Cells of another culture are tried first** (subject peoples rise first); if the region they'd form is too small to be a nation, the seed is picked from all those cells instead, so a few foreign villages can't shield an empire from revolt. Among the candidates the seed is picked at random **weighted by each cell's unrest** (§4.11), so rebellions start in weakly held, recently conquered or war-torn land (uniform if none is restless).
2. Flood-fill outward through the nation's cells **of the seed's culture**, up to `REBEL_MAX_CELLS`, never taking the capital, **filling the seed's own province first** before spilling into neighboring ones. If the region is smaller than `MIN_AREA`, no rebellion happens.
3. Those cells become a new nation, ruled by the seed's race. Its culture, name and color depend on who rose (§4.14): usually a new name and color, but a fallen realm's people bring back its own. It takes the most common faith among its cells. Set `parent` to the old nation and give it starting stability `REBEL_START_STABILITY`. Its capital is the region's biggest settlement (then most populous cell). The rebel cells' unrest resets to 0, and since their `prevOwner` is the old nation, it has a claim to win them back. Opinion between the rebels and their old rulers starts at `REBEL_OPINION` (§4.12).
4. Part of the old nation's soldiers go over to the rebels, and it may fight at once to take the land back (§4.13 "Rebels and allies").

### 4.7 Collapse
- **Capital lost:** (when the capital's cell changes owner, at peace or to rebels; merely *occupying* a capital costs stability in §4.13) the capital moves to the nation's biggest remaining settlement, then its most populous cell (`capital_moved` event), and stability drops by `CAPITAL_LOSS_STAB_HIT`.
- **Collapse:** a nation with `area < MIN_AREA`, or with no cells left, dissolves. Each of its cells is annexed by the strongest nation bordering *that cell* (judged on ownership before the collapse, so it doesn't chain), or becomes unowned if there's none. Logged as `annexed` (naming the nation that took the most cells) or `collapse`. Annexed cells keep their people, race, culture and faith; cells left unowned are emptied (all reset to 0).

### 4.8 Emergence
If a connected unowned land region has at least `EMERGENCE_MIN_REGION` habitable cells, each year it has an `EMERGENCE_PROB` chance of spawning a new nation at its highest-capacity cell, claiming `EMERGENCE_CORE_SIZE` cells around it. The new nation's race is the race of the nearest race homeland (§4.10), and its cells are settled by that race.

### 4.9 Events
Emit a `SimEvent` for: nation founded, war declared (and allies joining, also type `war`), peace signed, rebellion, collapse, annexation, capital moved, alliance formed, alliance broken, city founded (§4.11), battle. Battles are named after a city within `BATTLE_NAME_RANGE` steps (*"Year 412: at the Battle of Arvenna, Velmora routs the host of Kethar (12,000 fell)."*), otherwise after the land (*"in the hills of Kethar"*). Each event gets a short readable sentence, e.g. *"Year 412: Velmora declares war on the Kethari Reach."*

Race shows in the text where it adds to the story: *"Year 88: Kazdrum, a realm of Dwarves, rises in the wilderness."* and, when rebels are of a different race than their rulers, *"Year 412: the Dark Elves of Vael rise against Kethar."*

### 4.10 Races
Every cell's people belong to one race, and every nation is ruled by one race. Each race is a row in the `RACES` table (`gen/params.ts`, next to `BIOME_STATS`, because generation needs it too and `gen/` may not import from `sim/`) with traits that **multiply existing parameters**. Lookups live in `gen/races.ts`. Humans are 1.0 everywhere, so a human-only world behaves exactly as before races existed.

**Who supplies which trait**
- **The people living in a cell:** `growth`, affinity (capacity), `martial`, `defense`, `unrest`. Subjects of another race keep their own nature.
- **The ruling race (`nation.race`):** `aggression`, `endurance`, `cohesion`, `tolerance`, terrain cost. These describe how the state behaves.

| Trait | Used in | Effect |
|---|---|---|
| `growth` | §4.1 | × `POP_GROWTH` |
| `affinity[biome]`, `mountainAffinity` | §4.1, §4.4 | × cell capacity for this race (missing = 1.0) |
| `terrainCost[biome]`, `mountainCost` | §4.4 | × move cost when this race's nation expands (missing = 1.0) |
| `martial` | §4.2 | × each cell's population in `militaryPop` |
| `defense` | §4.13 | Of the race living in the battle's cell, for an army fighting in its own land, × `DEFENDER_BONUS` |
| `aggression` | §4.5 | × war declaration chance |
| `endurance` | §4.3 | ÷ `WEARINESS_GAIN` |
| `cohesion` | §4.3 | × `ADMIN_CAP_BASE` |
| `unrest` | §4.2, §4.6 | Population-weighted average × `REBEL_PROB` |
| `tolerance` | §4.3 | ÷ foreign-population penalty |
| `RACE_ATTITUDES` | §4.12 | How two races feel about each other, −1..1: the base of every opinion between their nations |

**Families.** Each race has a `family` (`human`, `elf`, `dwarf`, `orc`). Light and Dark Elves are one family with different traits; the family decides which name list a nation uses (§3.9). Orcs are one race for now (Green Orc values); Red Orcs can be split off later as a second orc race.

**Homelands (generation).** For each race, pick `RACE_HOMES_PER_RACE` land cells as homeland points, each chosen at random weighted by `capacity × affinity ^ RACE_HOME_FOCUS` for that race (seeded stream `races`), so races start in land that suits them. Stored as `raceHomes`. Starting nations (§3.8) and emerging nations (§4.8) take the race of the nearest homeland point.

**Where races live.** A cell's race changes in only two ways:
1. A nation claims an empty cell: it's settled by the nation's race (§4.4).
2. A cell is left unowned: it's emptied and its race is reset to 0 (§4.1, §4.7).

Conquest and annexation keep the people (and their race) in place. So a race's lands grow by settling and shrink by being emptied, and a conqueror's empire fills up with foreign subjects who weigh on its stability and lead its rebellions. Culture and faith (§4.14) change far more easily than race: only a race never changes.

### 4.11 Land and cell detail

Built in M9. Like §4.10 Races, this section describes the whole system in one place; each step's own section (§4.1–4.9) says what changed there. Numbers are in `PARAMS.md` → "Land and cell detail". Code: `gen/resources.ts`, `gen/provinces.ts`, `sim/control.ts`, `sim/land.ts`, `sim/resources.ts`.

**Goal.** Give each cell enough memory and character that nations have *reasons*: why a border sits where it does, why a war starts, where a rebellion begins. Like races, every new value **multiplies or replaces an existing rule**; nothing adds a new tick step.

**Principle: store causes, calculate chances.** Cells store slow-changing facts (unrest, devastation…). Chances (rebellion, flipping in war, settling) are worked out fresh each year from those facts, never stored, so they can't go stale and every roll has a reason. Each one can be drawn as a heatmap layer for tuning.

#### Fixed per cell (generation, §3.7b)

| Field | Type | How it's made |
|---|---|---|
| `resource` | `ResourceId` (0 = none) | Each land cell gets a deposit with chance `RESOURCE_PROB` (seeded stream `resources`). The type is picked at random among the resources that fit the cell (`fits()` in `gen/resources.ts`, table below), weighted by each one's rarity `weight` in `RESOURCES`. |
| `richness` | 0..1 | `random ^ RICHNESS_SKEW`, so most deposits are poor and a few are rich. |
| `defensibility` | ~0.8..2.0 | `biome defense × (mountain ? MOUNTAIN_DEFENSE : 1) × (river ? RIVER_DEFENSE : 1)`. `defense` column in `BIOME_STATS`. |
| `province` | id (−1 water) | Land is split into provinces of about `PROVINCE_SIZE` cells (stream `provinces`): land cells in random order become seeds unless an earlier seed is within √`PROVINCE_SIZE` land steps (measured: provinces come out at about spacing² cells), then all seeds grow outward at once by travel cost, never across water. Every island gets its own. The unit rebellions break along; named regions later. |

**Resources** (`RESOURCES` table in `gen/params.ts`, next to `BIOME_STATS`). Six types. Effects are **nation-wide multipliers on existing parameters**, active while the nation owns deposits of that type:

| Resource | Where it appears | Effect while owned | Favored by |
|---|---|---|---|
| Grain | River or grassland cells | × capacity of all the nation's cells | Humans |
| Timber | Forests, taiga | × move cost when expanding (cheaper) | Light Elves |
| Iron | Hills: land elevation from `HILL_H` up to `MOUNTAIN_H` | × `martial` in `militaryPop` | Dwarves, Orcs |
| Gold | Mountains | × `STAB_RECOVERY` | Dwarves |
| Horses | Grassland, savanna, shrubland | × `EXPANSION_RATE` | Orcs, Humans |
| Mithril | High mountains only (land elevation ≥ `HIGH_MOUNTAIN_H`), rare | × `defense` of armies fighting in their own land | Dwarves, Dark Elves |

- **Access, not stockpiles.** `access = sum of richness over the nation's cells with that resource`. Bonus = `1 + (effect − 1) × min(1, access / RESOURCE_SATURATION)`. Owning more stops helping once saturated, which limits snowballing.
- **Race preference.** Each race gets a `favoredResources` list in `RACES`. Favored resources count `FAVORED_RESOURCE_VALUE` × in a cell's value (below), so Dwarves fight harder for iron hills. No direct stat effect.
- Stockpiles, trade and depletion are left for the economy milestone.

#### Changing per cell (`CellState` typed arrays)

Updated once a year right after Totals (`updateLand` in `sim/land.ts`), using that year's control. Every change of owner anywhere in the simulation goes through `setOwner`, which records `prevOwner` and `ownedSince`.

| Field | Type | Rises when | Falls when | Used for |
|---|---|---|---|---|
| `unrest` | `Float32Array` 0..1 | Captured (jumps to at least `UNREST_CONQUEST`); each year `+ UNREST_CONTROL_K × (1 − control) + UNREST_FOREIGN_K / tolerance` (if ruled by another race) `+ UNREST_KIN_K / tolerance` (own race, another culture) `+ UNREST_FAITH_K × fervor / tolerance` (another faith) `+ UNREST_DEVASTATION_K × devastation + UNREST_CRISIS_K × max(0, 1 − stability / REBEL_THRESHOLD)` | `UNREST_DECAY` per year, doubled in core land; reset to 0 when the cell rebels | Sets how often rebellions happen and where they start (§4.6) |
| `devastation` | `Float32Array` 0..1 | Battles (`DEVASTATION_BATTLE`), marching (`DEVASTATION_MARCH`) and being occupied (`DEVASTATION_CAPTURE`) | Heals `DEVASTATION_HEAL` of itself per year | Cuts capacity and development; raises unrest |
| `development` | `Float32Array` 0..1 | `DEV_GROWTH × (pop / capacity) × control × (1 − devastation)` per year | `DEV_DEVASTATION_LOSS × devastation` per year | Cell value, settlement level |
| `settlement` | `Uint8Array` 0 none, 1 village, 2 town, 3 city | One level a year when development passes `SETTLE_VILLAGE` / `SETTLE_TOWN` / `SETTLE_CITY` (towns and cities also need pop ≥ `SETTLE_MIN_POP_FRACTION` × capacity) | One level when development falls below that level's threshold × `SETTLE_DOWN_FACTOR` (so levels don't flicker) | City names and events, capital choice, map markers |
| `ownedSince` | `Int32Array` year | Set when the owner changes | — | Core land: owned ≥ `CORE_YEARS` |
| `prevOwner` | `Int32Array` NationId | Set to the old owner when the owner changes | — | Claims: reasons to reconquer |

- Cities need at least `CITY_MIN_SPACING` cell-steps between them. A cell reaching level 3 for the first time gets a name from its nation's name culture (stored in `WorldState.cityNames`, kept if the city shrinks and regrows) and logs a `city_founded` event: *"Year 640: Arvenna grows into a great city of Velmora."*
- A cell left unowned resets `development`, `settlement` and `unrest` to 0 (it's emptied, §4.10) but keeps `devastation`, which heals as normal.

#### Calculated each year (not stored)

- **`control` 0..1**: the owner's grip (§4.2). Replaces the old average-distance-to-capital penalty in §4.3, so mountains and marshes, not just distance, decide where an empire frays.
- **`value`**: how much a nation of a given race wants a cell: `min(1, pop / effective capacity) + development + richness × (favored ? FAVORED_RESOURCE_VALUE : 1)`. Picks war targets (§4.5) and makes rich border land a reason for war.
- **Resource bonuses** from `access` (§4.2), and **chances** (rebellion seed, war flip, settling) worked out from the stored fields when each step runs.

#### Where each part acts

| Step | What changes |
|---|---|
| 4.1 Population | Effective capacity (devastation, grain); abandoned land is cleared. |
| 4.2 Totals | Control, resource access, iron; then `updateLand` (table above). |
| 4.3 Stability | Control penalty; gold. |
| 4.4 Expansion | Horses, timber. |
| 4.5 War | Claims and cell value raise war chance and give the reason; defensibility and mithril help defending armies; armies march on the most valuable cells; conquest adds unrest and devastation; peace text names a captured resource. |
| 4.6 Rebellion | Seeds weighted by unrest; fill the seed's province first; rebels' capital is their biggest settlement. |
| 4.7 Collapse | A moved capital goes to the biggest settlement. |

Rendering (§5.4d–f): heatmaps (H), Resources layer (M), Towns & cities (T); the hover info shows every new field. Saves are format **v4** (§6).

**What it gives** (5 seeds × 1,000 years, after tuning `WAR_BASE_PROB` and `WAR_VALUE_K` down): ~60–85 wars per century, about a third of them to reclaim lost land and a few over a prized resource; ~40–55 cities standing at year 1000; 26–50 nations alive; the 10-seed race balance check still shows no takeover (biggest race 41%). Big empires mostly saturate the common resources (timber, horses); no one resource decides every run.

### 4.12 Diplomacy
Runs as step **4b**, after expansion (so new neighbors have met) and before wars are declared. Code: `sim/diplomacy.ts`.

**Opinion.** Every pair of nations that have met shares one opinion, −1 (hatred) .. 1 (friendship), stored in `relations` by `pairKey`. Pairs that have never met judge by race alone. Each year every stored opinion moves `OPINION_DRIFT` of the way toward its target:

```
target = raceAttitude(raceA, raceB)          // RACE_ATTITUDES, averaged both ways
       − BORDER_FRICTION                      if they share a border
       − WAR_OPINION_PENALTY                  if at war with each other
       + SHARED_ENEMY_BONUS                   else, if both fight the same nation
       ± FAITH_OPINION × average fervor       + for one faith, − for different faiths (§4.14)
clamp to −1..1
```

- Neighbors meeting for the first time start at their target.
- Declaring war (or joining one) drops opinion by `WAR_OPINION_HIT` at once: a grudge that fades over decades.
- A rebellion sets the rebels' opinion of their old rulers to `REBEL_OPINION` (§4.6).
- Pairs with a dead nation are forgotten.

**Alliances** (`alliances`, at most `MAX_ALLIES` per nation):
1. An alliance with a dead member just lapses. Any year both allies fight a shared enemy renews it (`renewed`). Then each ally's controller is asked whether to keep it (`keepAlliance`); the AI lets it go (`alliance_ended` event) if:
   - opinion has fallen below `ALLIANCE_BREAK_OPINION` (*"the alliance between X and Y breaks down"*), or
   - its ruler was crowned last year, with chance `NEW_RULER_BREAK` × race `fickleness` (× `GREAT_SCHEMER_BREAK` for a Schemer) (*"Queen Selena of X, new to the throne, breaks the alliance with Y"*), or
   - with chance `PACT_FADE` × years since the pact was last renewed × race `fickleness`, so an unused pact grows ever likelier to lapse (*"after 80 years without a shared war, X lets its alliance with Y lapse"*).
   A broken pact drops the pair's opinion to at most `PACT_BROKEN_OPINION`, so they don't swear a new one the next year. Allies fighting together right now are never asked to leave by the last two. The log line is chosen from what's true when the pact ends, so a pact that fades in a new ruler's first year is told as the new ruler's choice.
2. Each neighbor pair that isn't allied or at war, with opinion ≥ `ALLIANCE_MIN_OPINION` and room for another ally on both sides, allies with chance `ALLIANCE_PROB` (`alliance` event; told as a "kinship pact" when both are the same race).

Allies never declare war on each other. Alliances are both defensive and offensive: how allies deter and join wars is in §4.5.

**What this gives.** Kin of the friendlier races ally readily, and pacts that keep fighting together last; quiet ones lapse in a few generations, and new rulers sometimes tear them up. Dwarf and Light Elf pacts last longest, Orc and Dark Elf pacts shortest. Other alliances are wartime coalitions: two nations fighting the same enemy warm to each other and ally, then drift apart after the peace. Hated pairs (Light vs Dark Elves, Dwarves vs Orcs) go to war more often.

### 4.13 Armies

> Built in M11, in five steps (see the Decision log). Numbers are in `PARAMS.md` → "Armies". Code lives in `sim/manpower.ts`, `sim/armies.ts`, `sim/battle.ts`, `sim/siege.ts`, `sim/warGoals.ts`.

**Goal.** Make war *happen somewhere*. Before M11 a war was one weighted roll per year between whole-nation strengths, and the winner took a few cells anywhere along the border. With armies, soldiers are a limited stock that takes decades to rebuild; armies march across the map, meet in battle and besiege towns; and peace hands over the land a war was fought *for*. A big empire with two wars has to split its soldiers, which is the overstretch the core loop needs.

**Principles**
- **One army per side per war.** Simple to follow on the map, and fast: about 10–30 armies at a time.
- **Seasons inside a year.** One tick is still one year, but the war part runs `CAMPAIGN_STEPS` times (default 4, the seasons). Each step: armies choose a target, march, fight, besiege.
- **Occupation is not ownership.** Armies *occupy* enemy cells during a war. Cells only change owner at peace, through the war's terms.
- **Race traits keep their meaning.** `martial` sets how many soldiers a cell's people give (as in `militaryPop`); `defense`, `defensibility` and mithril help armies defending in their own land; the ruling race's terrain cost sets marching speed.

#### Manpower (in step 2, Totals)

Each nation has a **reserve** of trained soldiers who aren't in an army yet.

```
cap      = levyPop × LEVY_SHARE      // levyPop = Σ pop × martial × control (× iron); occupied cells don't count
soldiers = reserve + size of the nation's armies
reserve += (cap − soldiers) × LEVY_REFILL × (0.5 + stability)    // only if soldiers < cap; × RALLY_REFILL while defending in a war (M18)
power    = soldiers × (0.5 + stability)                           // fightingPower
```

- So a nation that loses its army is weak for decades, and unstable nations rebuild slowly. A nation starts with a full reserve in its first year.
- **Why `× control`** (built, changed from the design): with a plain `militaryPop` cap, soldiers grow in step with size and empires snowballed (5 seeds: 18 nations left at year 1000, the biggest 1,344 cells). Counting only the people a nation really controls makes overstretch cost soldiers.
- **Why `× (0.5 + stability)` in power** (built): the old `strength` had it; without it shaky empires still won their wars.
- Soldiers above the cap (after losing land) aren't removed; they just stop refilling.
- Units: soldiers are in the same units as `pop` (1 ≈ one fully settled grassland cell). The map shows them in men using `ARMY_MEN_PER_UNIT` (render only).
- **Declaring war** (§4.5) compares power instead of `strength`: `attackSide = attacker power + helpers' power × ALLY_ATTACK_PROB` (same for the defender). `strength` stays for collapse (who annexes).
- **War weariness** also rises with losses: `+ casualties / cap × WEARINESS_LOSS_K` for each battle and each step of attrition.

#### Raising and reinforcing armies

- **Raised** when a nation enters a war (declared, declared on, or joining as an ally) and doesn't yet have an army for that war: `size = reserve × MOBILIZE_SHARE / (number of its wars still without an army)`, placed at the settlement nearest to the front, searching outward through its own land from the cells that touch the enemy (the capital if it has no front, so an army never starts on a cut-off patch of land). Not raised if smaller than `MIN_ARMY_SIZE`. If an army is destroyed, a new one is raised the next year from whatever reserve is left.
- **Reinforced** once a year: `REINFORCE_RATE` of the reserve is shared out equally among the nation's armies that are **in supply** (standing on friendly-controlled land with a route of at most `SUPPLY_RANGE` links to unoccupied home/allied territory; hostile occupation and armies cut routes).
- **Disbanded** when its war ends, or when it shrinks below `MIN_ARMY_SIZE`: the soldiers go back into the reserve. A dead nation's armies just melt away.
- Each army stores: `id`, `owner`, `war`, `cell`, `size`, `morale` (0..1, starts at 1), `target`, and `trail` (the cells it walked this year, so the renderer can animate the march).

#### Each campaign step

Armies act in order of `id` (deterministic). Random rolls use the `campaign` stream.

**1. Choose a target.** The first rule that works decides; a rule whose target can't be reached falls through to the next one, so one unreachable enemy doesn't leave an army idle. An army with no way to the enemy at all tries again next year, because a failed search covers the whole map.
1. **Retreat**: morale below `RETREAT_MORALE` → head for the nearest own settlement and stay there until morale is back above it.
2. **Attack or fall back**: a hostile army (any war this nation fights) within `ENGAGE_RANGE` steps. Estimate the enemy's effective power at its current position, including the same terrain, settlement, home-defense, resource and faith bonuses as battle. Scouting multiplies that estimate by `e^uniform(-ENGAGE_INTEL_ERROR, ENGAGE_INTEL_ERROR)`. If `my power × general boldness / estimated enemy power ≥ ENGAGE_RATIO` → march at it; otherwise → head for the nearest own settlement. Reports have separate army/foe dice and stay consistent through the year's seasons, while actual troops, morale and positions can change. Cautious and bold generals can still misjudge a fight; they never see its outcome roll. Contact and morale-retreat rules below still apply. See `systems/realwar.md` → "Imperfect engagement judgment".
3. **Liberate**: own land occupied by this enemy → the nearest such cell.
4. **Support** (only an ally's army in a war it joined): the friend's land held by this enemy, or else the enemy's armies, however far.
5. **Goal** (only the attacker): the nearest goal cell it hasn't taken. It keeps a goal cell it's already heading for.
6. **Plunder**: rich enemy land (§4.11 value) within `RAID_RANGE` steps, or else near the border. This is what defenders and raiders do, and what an attacker does if it can't reach its goal.

**2. March.** Shortest path by move cost (biome × mountain × river × ruling-race terrain cost, the same costs as §4.4 and `control`). An army may walk through its own land, allied land, and land of nations it's at war with; never through neutral nations or water (navies are in the backlog). It gets `ARMY_MOVE` move points per step and can always enter one cell per step, however hard the ground. It **stops** as soon as it steps into a cell next to a hostile army (contact), and a retreating army may walk away from one. Paths are only recalculated when the target changes or the path is blocked, to keep the tick fast. Marching through enemy land adds `DEVASTATION_MARCH` to each cell.

**3. Battle.** Two hostile armies in the same or neighboring cells fight once per step. The **defender** is the army that didn't move into contact this step (if both moved, the one standing in its own land, then the larger).

```
power    = size × morale × (0.5 + stability)
defender power × DEFENDER_BONUS × cell.defensibility × (1 + FORT_BONUS × settlement level)
                × (in own land: defense trait of the cell's race × mithril bonus)
winner   = weighted roll: P(A wins) = powerA / (powerA + powerB)
ratio    = winner power / loser power
loser loses  min(BATTLE_MAX_LOSS, BATTLE_LOSS × ratio) of its size
winner loses min(BATTLE_MAX_LOSS, BATTLE_LOSS × WINNER_LOSS_SHARE / ratio) of its size
```

- Morale: loser `− MORALE_LOSS`, winner `+ MORALE_GAIN` (max 1). Armies recover `MORALE_RECOVERY` per step on supplied, unoccupied home/allied land. Connected occupations feed armies but do not restore morale.
- The loser falls back one cell toward its own land.
- **Rout**: an army below `MIN_ARMY_SIZE` or with morale under `ROUT_MORALE` is destroyed; `ROUT_RETURN` of its soldiers straggle back to the reserve.
- The battle cell loses `BATTLE_POP_LOSS` of its people and gains `DEVASTATION_BATTLE`.
- War score toward the winner: `BATTLE_SCORE`, plus `ROUT_SCORE` if the enemy army was destroyed.
- The sim records each battle this year in `WorldState.battles` (cell, winner, loser, losses) for the renderer and log.

**4. Siege and occupation.** An army standing in an enemy cell, with no hostile army in or next to it, builds up `siege` on that cell:

```
steps to take it = SIEGE_STEPS × (1 + SIEGE_SETTLEMENT_K × settlement level) × defensibility × (capital ? CAPITAL_SIEGE_MULT : 1)
```

- `siege` is progress, 0..1, representing pressure and weakening defenses. Progress per season is `min(1, army size × morale / resistance) × (1 − shortage / 2) / steps`. Resistance is local population × `SIEGE_GARRISON_SHARE` × the settlement multiplier × terrain × capital multiplier × remaining siege progress, with a floor of `MIN_ARMY_SIZE`. It is an abstract local defense, not additional recruitable soldiers.
- Only one fit, unopposed army works each cell per season. If besiegers leave, break, or are interrupted by a relief army, progress falls by `SIEGE_RECOVERY` each season. No work occurs below `RETREAT_MORALE`.
- Generals choose waiting or assaulting through `orderSiege`, saved in the `orderArmy` command. The choice uses the same scouting-error range and general boldness as engagement judgment. For towns, cities and capitals, an assault rolls `power / (power + remaining resistance)` after that season's siege progress, always costs `SIEGE_ASSAULT_LOSS` of the army, and affects morale. A success occupies the cell immediately; failure leaves the siege ongoing. Assaults appear in the war report. Player armies use the same decisions.
- Completed sieges **occupy** the cell (`occupier` = the army's nation), reset progress and add `DEVASTATION_CAPTURE`. A town or city also brings in its open neighbors, excluding capitals and defended cells.
- An occupied cell gives its owner no soldiers and no resource access, and gains `UNREST_OCCUPIED` unrest each year.
- Occupying the enemy's **capital** costs it `CAPITAL_LOSS_STAB_HIT` stability once and scores `CAPITAL_SCORE`.
- An army of the owner (or of an ally in the same war) entering an occupied cell frees it at once.

**5. Supply and attrition.** A short route through friendly-controlled cells reaches unoccupied home/allied territory. The army's current hostile cell may be the endpoint of a route, allowing a frontier siege to receive food, but reinforcements require controlled ground. Enemy armies block the cells they stand in; water and neutral land cannot carry supplies. Cut-off armies forage at most `FORAGE_SHARE`, scaled by local population relative to army size and by intact land (`1 − devastation`). The remaining food shortage multiplies `ARMY_ATTRITION` (× 2 in desert, tundra, ice and mountains) and `SUPPLY_MORALE_LOSS`. Hunger eventually triggers the ordinary morale retreat. This first version has no wagons, stored food, seasonal harvests or capital-connected depot network. See [simple campaigns](systems/campaigns.md).

#### War goals (at declaration)

| Goal | When it's picked | Goal cells | Event text |
|---|---|---|---|
| **Reclaim** | The attacker has a claim (§4.5) | Its claimed cells the defender holds | *"…to reclaim its lost lands"* |
| **Raid** | Otherwise, with chance `RAID_CHANCE × aggression` (ruling race) | None: armies go for rich cells and the enemy army | *"…to raid its lands"* |
| **Conquer** | Otherwise | The defender's cells in the province holding its most valuable border cell (§4.11 value, as the attacker's race sees it), and in nearby provinces: one province per whole time the attacker's fighting power beats the defender's, up to `CONQUEST_MAX_PROVINCES`. If the attacker is at least `SUBJUGATE_RATIO` times stronger, the enemy capital is a goal cell too | *"…to seize the lands around Arvenna"* (nearest city) or *"…, coveting its iron"* |

Goal cells that break away to rebels stop counting. Joined allies fight in support (goal `support`): no goal cells; their armies hunt enemy armies and free occupied allied land.

#### War score and peace

`score = battle score (adds up over the war) + occupation score (worked out fresh each year) − years held off × HOLD_SCORE`. The occupation score is `SCORE_PER_OCCUPIED` per occupied cell (× `GOAL_SCORE_MULT` for goal cells), plus `CAPITAL_SCORE` for a held capital, attacker's minus defender's. **Holding out** (M18, [`systems/realwar.md`](systems/realwar.md)): every year after the first in which the attacker holds none of its goal cells (in a raid or an ally's war: none of the defender's land), `War.heldOff` grows by one, so an invasion that takes nothing slowly becomes a defeat.

Occupations can't outlive their war: at the end of each tick any occupier that's no longer at war with the owner lets go (`releaseOccupations`), and `setOwner` clears `occupier` and `siege`.

**Peace** when any of these is true:
- the attacker occupies **every goal cell** still held by the defender, at least one (goal achieved; attacker wins whatever the score)
- `|score| ≥ PEACE_SCORE`
- either side's war weariness ≥ `WEARINESS_PEACE`
- the war has lasted `MAX_WAR_YEARS`

**Terms.** A winner (goal achieved, or `|score|` ≥ `WIN_SCORE`) takes:
- **the loser as its vassal, if it holds the loser's capital** (since 2026-11-09, [`systems/vassalage.md`](systems/vassalage.md)): the winner takes the land below as usual, never the capital, and the loser serves it (*"…takes the capital of Kethar, which, giving up 12 provinces, submits and becomes its vassal."*). A winner that is itself a vassal still takes the whole nation. With or without the capital, it also takes:
- the goal cells it occupies (only the attacker has goals);
- up to `PEACE_EXTRA_CELLS` other occupied cells that touch its own land, most valuable first; each cell taken can make the next one touch;
- for a raid the **attacker** won, no land. Instead the loser loses `RAID_TRIBUTE` stability, the winner gains it, and the event reads *"…plunders Kethar and goes home laden with spoils."* A defender who beats a raid still takes what it occupies.
- a **defender** who wins makes the attacker pay as a raid's victim would (`RAID_TRIBUTE` stability moves to the defender), and takes what it occupies; with no land, the event reads *"…Kethar drives off Velmora."*

Taken cells go through `setOwner` (unrest jumps to `UNREST_CONQUEST`). All other occupations end; armies go home and disband. White peace: everyone keeps what they had. Truces and peace text as before.

#### Rebels and allies

- **Rebel armies.** When a rebellion starts, the old nation loses `REBEL_LEVY` of its reserve (its soldiers defect). With chance `REBEL_WAR_PROB`, if it isn't already at `MAX_WARS_PER_NATION`, it goes straight to war to take them back (goal **Reclaim**, goal cells = the rebel region), and the rebels raise an army at once: `size = the region's Σ pop × martial × REBEL_LEVY`. Otherwise there's no war for now, though the old nation's claim can bring one later (§4.5).
- **Allies.** A helper (§4.5) needs to border the enemy *or* the ally it's helping, because its army can march through allied land. If it doesn't touch the enemy it musters at its capital.

### 4.14 Culture and faith

> Built in M12, in six steps (see the Decision log). Numbers are in `PARAMS.md` → "Culture and faith". Code: `sim/culture.ts`, `sim/faith.ts`, `gen/faiths.ts`.

**Goal.** Give peoples a memory. Today a conquered province is only "Humans"; with culture it's *the people of Velmora*, who can rise and bring Velmora back. Faith cuts across race, so kingdoms of different peoples can share a god and a kingdom can turn from its old one. The core rule: **culture stays inside a race; faith crosses races.**

Like races and land detail, this adds no tick step: new values change numbers inside existing steps, and the spreading runs straight after `updateLand` in step 2.

#### What's stored

| Where | Field | Meaning |
|---|---|---|
| Cell | `culture: Uint16Array` | Id of the realm whose people these are: the nation that first settled the cell, or that broke away (0 = nobody). Dead nations stay in `state.nations`, so a culture's name and color are its founder's |
| Cell | `faith: Uint8Array` | `FaithId` of the people there (0 = nobody) |
| Nation | `culture` | The culture of its rulers, set at founding. Not read from the capital, because a moved capital can land on other people |
| Nation | `faith` | The faith of its rulers. Can change (see Realm conversion) |
| Nation | `fell?` | Year it died |

Both tags are set wherever `race` is set: generation, expansion, emergence, and cleared when a cell is left empty (§4.1, §4.7). Conquest leaves them alone.

A cell only ever assimilates to a ruler of its own race, so **a culture always belongs to one race**.

#### Faiths

Nine, in the `FAITHS` table (`gen/params.ts`, next to `RACES`). **Reach** is how fast it spreads. **Fervor** is how hard its believers resent other rulers. **Blessing** is one small multiplier on an existing rule, active in nations of that faith.

| Faith | Home race | Reach | Fervor | Blessing |
|---|---|---|---|---|
| The Old Gods | none: forbidden shrines, anywhere | low (high in restless land) | low | **Whispers**: land next to a hidden shrine grows more restless |
| The Radiant Covenant | Humans | high | high | **Order**: stability recovers faster |
| The Evergreen Vow | Light Elves, elves only | low | medium | **Sanctuary**: defenders fight better |
| The Silver Choir | Light Elves, elves only | low | medium | **Remembrance**: its believers assimilate slower, whoever rules them |
| The Hollow Mother | Dark Elves (their only faith; the forest mother gone hollow, an offshoot of the Evergreen Vow) | medium | very high | **Devotion**: the soldier reserve refills faster |
| The Deep Ancestors | Dwarves | very low | low | **Grudges**: claims last longer |
| The Anvil Oath | Dwarves | low | medium | **Forge**: development grows faster |
| The Red Hunger | Orcs | high | high | **Warpath**: more eager to start wars |
| The Bone Drums | Orcs | high | low | **Kinship**: people of its nations assimilate faster |

**At the start.** Each race's homeland points take its faiths in turn, so a race with two faiths starts with one in each homeland. A nation and its cells take the faith of the nearest homeland of its race. Emerging nations do the same.

#### Spreading (`sim/culture.ts`, `sim/faith.ts`)

Both use the **neighbor rule**, which grows solid blobs rather than speckle. Each year, each populated cell that could change looks at one random neighbor and copies its tag with a small chance.

**Culture (assimilation).** A cell can only be assimilated if it has the ruler's race but not the ruler's culture, is core land (§4.11), has unrest below `ASSIMILATE_MAX_UNREST` and isn't occupied. It copies a neighbor of the ruler's culture with chance `CULTURE_RATE × assimilation × control`, where `assimilation` is a new race trait of the people living there.

**Faith (conversion).** A cell copies a neighbor's different faith with chance:

```
chance = FAITH_RATE × reach × conversion × (faith is the owner's ? 1 : FAITH_FOREIGN_SPREAD)
```

`conversion` is a new race trait of the people living there. Capitals never convert, so a realm can't lose its own faith at the source. Elves-only faiths only enter Light Elf cells. The Old Gods' reach rises with the cell's unrest and they enter elf cells only slowly (`OLD_GODS_ELF_SPREAD`).

**The Old Gods appear.** Any owned cell at unrest ≥ `OLD_GODS_MIN_UNREST` can turn to them each year with chance `OLD_GODS_SPARK`, even where they've died out. If the realm had no shrine yet, it's logged: *"The Old Gods stir in the east of Kethar."* (event type `faith`, with realm conversions).

#### What they change

- **Unrest (§4.11).** New yearly gains: `UNREST_KIN_K / tolerance` for people of the ruler's race but another culture, and `UNREST_FAITH_K × fervor / tolerance` for people of a faith other than the ruler's (their fervor, the ruler's tolerance). `UNREST_FOREIGN_K` and the stability penalty for foreign peoples don't change.
- **Rebellion (§4.6).** Rebels are now one culture, not just one race. The flood-fill and the "subject peoples first" filter go by culture, with the same fallback to the ruling people. Then:
  - **Ruling people rise:** the breakaway is a new culture. The region's cells take the rebels' id as their culture.
  - **A conquered people rise, and no living nation rules that culture:** their old realm returns, with its old name and color: *"Velmora is reborn, 340 years after its fall."*
  - **A conquered people rise, and a living nation already rules that culture:** a new sister state of the same culture with a fresh name.
- **Realm conversion.** Each year, a nation whose biggest faith isn't its own, and holds at least `FAITH_MAJORITY` of the people, adopts it with chance `FAITH_ADOPT`, and its capital's cell turns with it: *"Kethar embraces the Silver Choir."* or, for the Old Gods, *"Kethar turns to the Old Gods."*
- **Rebel faith.** A new nation of rebels takes the most common faith among its cells.
- **Diplomacy (§4.12).** Target opinion gains `FAITH_OPINION × average fervor` between nations of one faith, and loses as much between nations of different faiths.

#### What stays out

Schisms, holy wars and holy cities (could return as their own step), morale bonuses, claims by culture, and any change to a cell's `race`.

#### What it gives

On 20 unseen seeds: ~17 realms reborn and ~5 realm conversions per run, ~8 of 9 faiths alive at year 1000, no culture ever crossing a race; wars, rebellions and empire sizes within noise of before. Conversions stay below the hoped-for 10: rulers' faith spreads fastest, so a realm rarely holds a rival majority (the full measurements are in git history, commit for M12 step 6).

### 4.15 Rulers and dynasties

> Built in M13. The full description is in [`systems/rulers.md`](systems/rulers.md), so this doc stays short. Numbers are in `PARAMS.md` → "Rulers and dynasties".

Every nation has a named ruler and dynasty. A few rulers are great (Conqueror, Lawgiver, Builder, Prophet, Schemer): each race leans toward one type, and bigger realms draw them more often. When a reign ends, a crisis can strike, and big nations fall into civil war, worst after a great ruler. One new tick step: 7b Succession. Golden ages are designed in the same file but not built.

### 4.16 Controllers and commands

> Built in M15. The full description is in [`systems/controllers.md`](systems/controllers.md).

Every choice a nation makes (declare war and its goal, join an ally, form or break an alliance, accept peace, mobilize, campaign orders, crush a revolt, adopt a faith) is asked of the nation's **controller** and comes back as a **command** that the rules validate and apply. The AI controller is today's logic, moved; a player controller replaces it for the played nation (M20, [`systems/play.md`](systems/play.md)). Battle rolls, revolts, spreading, succession and everything else stay rules. No new tick step.

---

## 5. Rendering (`render/`)

**Target look:** game-like, atmospheric and readable while borders change every year.

### 5.1 Terrain layer (drawn once, cached)
- Color each pixel from elevation + biome (lowland greens → highland browns → snow).
- **Hillshade:** light from direction `HILLSHADE_AZIMUTH` at angle `HILLSHADE_ALTITUDE`, blended in at `HILLSHADE_STRENGTH`. This is the single biggest contributor to the look.
- **Grain:** faint noise texture at `TERRAIN_GRAIN`.
- **Water:** deep-to-shallow gradient with a lighter coastal band.

### 5.1b Parchment style (default)

An old chart, chosen from mockups by the user: aged paper, a pale sea with engraved lines along the shore, and thin ink outlines. A "Classic map" button switches to the cel-shaded style (`?style=cel`); "Parchment map" switches back. The drawing layers are rebuilt in place and the address is updated without reloading, preserving history, player orders, settings, playback, and zoom. It only changes drawing, so history is the same in every style.

- **Terrain layer:** paper and sea (`terrainAtlas.ts`), then sailing lines over water only, a faint grid and the compass rose (`atlasChart.ts`).
- **Symbol layer:** rivers, mountains, hills, trees and desert dots (`atlasSymbols.ts`). They sit on their own layer above the nation colors, so tinting doesn't fade the ink.
- **Nation colors:** the same overlay, given `LOOK_ATLAS`: pale colors leaning toward sepia, a stronger band along borders, and one ink for every border. War borders stay red.
- **Labels and places:** IM Fell fonts (bundled, SIL Open Font License), no town dots. `atlasMarkers.ts` draws a castle flying the realm's color for capitals, a spire for cities and an ink picture on each resource.
- **Armies, alliances and effects:** the same layers, given the look: colors leaning toward sepia, ink outlines and lines, red-brown war borders and siege rings.
- **Frame and title panel:** drawn with the labels each year. The panel takes the corner with the least land and carries the year and heatmap name, replacing `hud.ts`.

`MapLook` in `palette.ts` holds what a style changes in the shared layers. A new style adds one more look.

### 5.2 Nation overlay (redrawn each year)
- Tint land pixels with the owner's color at `OVERLAY_ALPHA` so terrain shows through. Unowned land is not tinted.
- Implementation: write into `ImageData` using a *display-cell* map (`render/displayCells.ts`): like `pixelToCell`, but shifted by smooth waves so borders curve, and with coastal land pixels always mapped to a land cell.

The overlay keeps its pixels between years and repaints only the cells that changed, plus two rings of neighbors (their shared edges and thick war borders). Changing the tint or the highlight repaints everything. `tests/overlay.test.ts` checks the result matches a full paint, pixel for pixel. The occupied-land mask (§5.4g) works the same way.

### 5.3 Borders
- Draw a line wherever neighboring pixels have different owners: darker (`BORDER_DARKEN`) and more opaque (`BORDER_ALPHA`).
- Borders between nations at war are drawn in `WAR_FRONT_COLOR`, 2 px wider on each side.

### 5.4 Labels
- Nation name at the center of its territory, sized by area, letter-spaced.
- Hidden below `LABEL_MIN_AREA`. Bigger nations are labeled first; a label that would overlap one already drawn is skipped.
- Later: fade in and out when nations are born or die.

### 5.4b Race map
A layer toggle (**Races**) swaps the nation overlay for one colored by each cell's race (`RACE_COLORS`), with nation borders still drawn on top. Empty cells are not tinted. This shows subject peoples inside empires at a glance.

### 5.4c Alliances
A layer toggle (**Alliances**, key A, on by default) draws a dashed light line with a dark outline between the capitals of each pair of allies. Hovering a nation's land lists its allies and its worst rival (lowest opinion).

### 5.4d Heatmaps
Key **H** cycles through heatmap layers (none → unrest → control → devastation → development → none), drawn over the nation colors on owned land with `HEAT_RAMP` (pale = low, dark red = high) at `HEAT_ALPHA`. The heatmap's name is drawn under the year so it shows in videos.

### 5.4e Resources
A layer toggle (**Resources**, key M, off by default) draws a small lettered marker on every deposit (`RESOURCE_COLORS`, `RESOURCE_LETTERS`), larger when richer.

### 5.4f Towns and cities
A layer toggle (**Towns & cities**, key T, on by default): a small dot for each town, a light square and the city's name for each city. Villages aren't drawn.

### 5.4g War and unrest effects
A layer toggle (**Effects**, key E, on by default) adds animation on top of the map, so wars and trouble read at a glance. Effects only read the world (`WorldState.battles`, `occupier`, `siege`, devastation, unrest) and use no random numbers, so history stays exactly the same with effects on or off. Effects keep moving while paused.

| Effect | Where | Looks like |
|---|---|---|
| **Occupied land** | Cells an enemy holds in a war | Diagonal stripes in the occupier's color, sliding slowly (`OCCUPIED_HATCH_*`). War borders stay red (`WAR_FRONT_COLOR`) |
| **Siege** | Cells under siege | A small ring that closes as the siege nears its end (`SIEGE_RING_*`) |
| **Battle** | Each battle in `WorldState.battles` | A ring in the winner's color expanding, with crossed swords fading out (`BATTLE_*`) |
| **Smoke** | Owned cells with devastation ≥ `SMOKE_MIN_DEVASTATION` | Gray puffs rising and fading; thicker on worse damage (`SMOKE_*`) |
| **Embers** | Cells with unrest ≥ `EMBER_MIN_UNREST` in nations unstable enough to rebel this year (stability < `REBEL_THRESHOLD`, §4.6); only an `EMBER_DENSITY` share of them, so it stays readable | Flickering orange glows: realms close to breaking apart (`EMBER_*`) |
| **Event burst** | Capital of a nation that rebels, is founded, collapses or is annexed | A large ring in the nation's color (dark for collapse and annexation) (`EVENT_BURST_*`) |

- Battles and bursts last a fixed number of real seconds, whatever the speed. Each pair of warring nations has at most one battle marker: a new battle restarts it at the new spot, so fast playback doesn't pile up swords. At most `MAX_BURSTS` play at once; the oldest give way.
- The map underneath is drawn to an off-screen canvas only when the world changes; each screen frame copies it and draws the effects on top. Effects show up in recorded videos.

### 5.4h Armies

A layer toggle (**Armies**, key W, on by default) for banners and marches. Like effects, it only reads the world.

| What | Looks like |
|---|---|
| **Army** | A banner (shield shape) in the nation's color at the army's cell, with its size in men (*"12k"*). Banner size grows with the army (`ARMY_BANNER_*`). Routed armies don't show. |
| **March** | During playback the banner slides along this year's `trail`, so armies visibly walk instead of jumping once a year. A thin dashed line points to its target. |

Hovering over an army (or next to it, since banners are wider than a cell) shows its nation, size, morale and target. Hovering over land also says who occupies it and how far a siege has come. Occupied land and sieges are in the Effects layer (§5.4g).

### 5.4i Cultures and faiths

Two more tints like the Races layer (§5.4b), and only one of the three shows at a time. **Cultures** (key K) tints land by the color of the culture's founding realm, so a dead realm's people still show in its color. **Faiths** (key F) tints land by `FAITH_COLORS`. The hover info names both.

### 5.4j War Room (M16)

The side panel (Wars, Past wars, Log), following a war, its map marks and the war report: see [`systems/warroom.md`](systems/warroom.md). It reads the war records the simulation keeps (`WorldState.warRecords`, saved).

### 5.4j-b Sandbox (M17)

A fourth side-panel tab: god commands that start or end wars (logged and saved, so history = seed + settings + command log), and odds from 20 possible futures. See [`systems/sandbox.md`](systems/sandbox.md).

### 5.4k Ruler card

A portrait card floats at the map's top right (`src/ui/rulerCard.ts`), toggled with key P. Hovering over a nation shows its ruler; unowned land hides it. When a great ruler rises, the card shows them and stays up for `RULER_CARD_SECONDS`, ignoring hover meanwhile.

- **Portrait:** `public/portraits/{race}-{m|f}-{ordinary|conqueror|lawgiver|builder|prophet|schemer}.webp`, 48 files. Orcs and Dwarves have no women, so they always use `m`. `portraitPath()` in `src/ui/portraits.ts` picks the file, and a test checks every one exists.
- **Frame:** `public/frames/ordinary.png` or `great.png`, aged parchment to match the map, drawn as they are. Only the wax seal at the top takes the nation's color: `{kind}-seal.png` is the seal alone in light grey, multiplied by the color. Text is dark ink in the map's IM Fell fonts. The portrait is clipped to the frame's opening (`RULER_CARD_OPENINGS`). Name, then dynasty and nation, go on the nameplate (`RULER_CARD_PLATES`).
- **Making the files:** `scripts/portraits.py` turns the drafts in `assets/` (not committed) into these files (lifting each seal out by its red color) and prints the opening boxes. Prompts are in `docs/art/portrait-prompts.md`.
- The card is a page element, not drawn on the map, so it doesn't appear in recorded videos.

### 5.4l Zoom (M19)

Mouse wheel or trackpad pinch zooms toward the pointer, dragging moves the map, double-click zooms in (shift + double-click out), + / − zoom on the centre, and 0 or the **Whole map** button zooms back out. Zoom goes from 1 (the whole map) to `MAX_ZOOM`. Following a war (§5.4j) zooms to fit both capitals (up to `FOLLOW_ZOOM_MAX`); stopping leaves the view where it is.

- **Camera** (`render/camera.ts`): a zoom and the map point at the canvas's top-left corner; canvas pixel (px, py) shows map point (x + px / zoom, y + py / zoom). All the math (zoom about a point, pan, keep inside the map) is pure and tested. Hover and the ruler card read the map through it.
- **Two ways of drawing.** While the view moves, the whole-map pictures (terrain, nation colors, heatmap, terrain symbols) are stretched through the camera, which is quick. `ZOOM_SHARP_DELAY` after it stops, the part on screen is **redrawn sharp** at screen size, about 0.4 s:
  - which cell each screen pixel shows (`buildViewCells`): cells found from their true centres, with the same border wobble, and land from heights blended between map pixels, so borders and coasts stay smooth;
  - nation colors, borders and war fronts: a second nation overlay on that view grid, kept up to date each year like the main one;
  - the parchment terrain (`renderAtlasTerrain` with a view): paper, sea, waterlines and coast ink from blended coast distances; terrain symbols and rivers redrawn through the camera. The classic maps' terrain is stretched, not redrawn.
- **Everything drawn with lines and text** (names, castles, cities, resources, alliances, armies, war focus, effects, the frame) is drawn through the camera, so it's always sharp. Markers, names and inked lines grow on screen only as zoom ^ `MARK_ZOOM_GROWTH` (`render/marks.ts`), so close up they stay readable and the map shows more detail rather than bigger symbols. The title panel and year stay fixed on screen.
- War effects' occupied-land stripes are still a whole-map picture, stretched.

### 5.4m Play tab (M20)

A fifth side-panel tab (`src/ui/play.ts`). With no one playing it lists the living realms of a chosen race, largest first; clicking one takes it over (the "play" order) at the year shown. Then it shows **Your realm**: the ruler with their portrait, land, people, faith, soldiers and reserve, stability, war weariness, unrest, allies, worst rival, your wars (click to follow one), an **Orders** part (declare war on a neighbor with a goal, propose or break an alliance, sue for peace in a war you're losing, adopt the faith most of the realm holds; disallowed orders greyed with the rules' reasons, and clicking a realm on the map picks it as the war target), and a drop-down per policy, each change a "setPolicy" order. If your realm falls, the list comes back so you can pick another. On the map the played realm's border is drawn heavier (`playedBorderWidth`), sharp when zoomed. Opening the tab pauses only while choosing. **Dispatches:** after each year, what happened to your realm (wars on you or your allies, your first rout in each war, your capital besieged or taken, your wars ending, great rulers, crises and civil wars, revolts, alliances, faith, your fall) pauses playback and shows at the top of the tab, with **Carry on**; each kind can be switched off under "Pause for…", and "Every new ruler" starts off (`ui/dispatches.ts`). **When your realm falls** the tab lists realms of your people (else your race) to carry on as (`heirsOf`); **at year 1000** it shows what became of the realms you played and your people (`ui/summary.ts`). See [`systems/play.md`](systems/play.md).

### 5.5 Performance budget
- At 1600×900 with ~10k cells: overlay redraw under 8 ms, sim tick under 10 ms, smooth at 50 years per second. Measured after M13: overlay 1.4 ms, effects 0.2 ms, tick ~4.6 ms in the browser, a whole new-year frame ~21 ms.
- Run the sim on the main thread until M6; move it to a Web Worker only if it slows the screen.

---

## 6. UI and playback (`ui/`)

- Play / pause, step one year, speed options from `SPEEDS` (Space, →). Stops at `SIM_YEARS`.
- Year counter drawn on the map canvas itself (`render/hud.ts`) so it appears in videos.
- Event log: scrolling, newest first, filter checkboxes per type (Battles starts off, and battles are only kept while it's on, so they can't push everything else past `EVENT_LOG_MAX`), click an event to highlight its nations for `HIGHLIGHT_SECONDS` (others fade to `HIGHLIGHT_DIM`).
- Seed box + **New world** (Enter works too) and **Random**. Both reload the page with `?seed=`.
- **Settings** panel: every `SIM` parameter editable live (`ui/settings.ts`), layer toggles (nations, labels, cell outlines), reset to defaults. Generation numbers are not live; they need a new world.
- **Save** downloads a JSON snapshot (`sim/snapshot.ts`): seed, year, sim params, every per-cell array (owner, pop, race, unrest, devastation, development, settlement, ownership history), nations, wars, truces, events, race homelands, opinions, alliances and city names (format v9, which has each nation's soldier reserve, the armies, each cell's occupier and siege, war goals, and cultures). Saves made before races (v1), diplomacy (v2), land detail (v3), armies (v4), battles and war goals (v5), the war counter (v6), cultures (v7) or rulers (v8) are refused with a clear message. The map isn't stored; **Load** reloads the page with the save's seed (passing the file through `sessionStorage`), regenerates the map and restores the state. Continuing from a save gives exactly the same history as never stopping.
- **Record** captures the canvas as WebM (`canvas.captureStream()` + `MediaRecorder`) and downloads it on stop.
- Web Worker: not needed. A tick takes ~5–6 ms (M9, measured in Node; M8 was ~5 ms) and a redraw ~15 ms at 1600×900.

---

## 7. Determinism and testing

- Same seed + same parameters = identical history **in the same browser**. JavaScript's `Math.exp`, `Math.pow` and similar functions can differ very slightly between browsers, so cross-browser results may drift.
- **Key test:** run 1,000 years twice with the same seed; the event lists must be identical.
- **Golden history** (`tests/golden.test.ts`, M15): fingerprints of three long runs, recorded once. The key test only compares the code with itself; this one catches a change that was meant to leave history alone but didn't. If history is *meant* to change, record new fingerprints and say why in the decision log.
- Each sim step gets unit tests on a tiny hand-built map (e.g. 6 cells, 2 nations).
- No `Math.random()` anywhere in `gen/` or `sim/`.

---

## 8. Backlog systems

### Vassalage (v1 built 2026-11-09)

Holding the loser's capital at peace makes it a vassal instead of swallowing it; vassals serve and fight beside their overlord, and may declare independence when the overlord's crown passes. See [`systems/vassalage.md`](systems/vassalage.md), including what's left for later (levy share, annex-or-vassalize choice, breaking away after defeats, absorbing vassals).

### Later ideas

Not designed yet. When one is picked up, give it its own `docs/systems/` file (§9) and matching parameters in `PARAMS.md`.

- Schisms, holy wars and holy cities (§4.14)
- Red Orcs as a second orc race (disciplined empire-builders who rule Green Orcs easily)
- Trade routes and economy
- Deeper diplomacy: tribute deals, betrayal (an ally refusing to help), fear coalitions against a rising giant (the next lever on attacker wins, M18)
- Playing a nation, further: directing armies, fog of war, a score (left out of M20)
- Naval expansion across water (and fleets carrying armies, after M11)
- Golden ages that end in decline (designed in `systems/rulers.md`)
- Plagues (spreading by neighbor, carried by armies and through cities, burning out as survivors gain immunity) and famines (regional, 2–5 years, worst in war-torn land, eased by grain). Brainstormed in M13 and set aside by choice
- Azgaar map import

---

## 9. Adding a new system

1. Write the design in its own `docs/systems/<name>.md` (small changes: a subsection here). Say where it runs in the tick order, and link it from the matching section here.
2. Add its parameters to `PARAMS.md` under the **same heading**: value, range, and what happens when it goes up or down.
3. Add the values to the matching `params.ts`.
4. Write tests on a tiny hand-built map.
5. Log the decision in `CLAUDE.md`.

Latest campaign extension: [simple sieges, supply and repeatable tuning](systems/campaigns.md).

---

## 10. Open questions

- Map size and aspect ratio (default 1600×900)? Single continent vs archipelago presets?
- Hex cells as a style option? Placing cell centers on an offset grid with no jitter makes the Voronoi cells exact hexagons; `sim/` would not change.
- Should holding another nation's claimed land also lower its opinion of you (§4.12)? Claims only raise war chance today.
- Provinces and seas have no names yet. Name them (and show them on the map)?
