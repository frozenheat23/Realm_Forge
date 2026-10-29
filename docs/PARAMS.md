# Realm Forge — Parameter Tuning Guide

What every tunable number does, a sensible range, and what happens when you change it. This is the **"what number"** doc; [`SPEC.md`](SPEC.md) explains how each system uses them. Section headings mirror SPEC.md.

**Source of truth:** the actual values live in code:

| Code file | Covers |
|---|---|
| `src/gen/params.ts` | World, Terrain, Climate, Biomes, Rivers, Starting nations, Races (`RACES` table and homelands) |
| `src/sim/params.ts` | Population through Emergence (one `SIM` object, editable live in the Settings panel) |
| `src/render/palette.ts` | Rendering |
| `src/ui/config.ts` | Playback |

The values below are the **starting defaults**. Most are educated guesses meant to be tuned. If you change a default in code, update this table. Ranges are rough guides, not hard limits.

---

## How to tune

Quickest way: open **Settings** under the map and change numbers while it runs (changed values turn gold; *Reset to defaults* undoes everything). To keep a change, copy it into `src/sim/params.ts`.

1. Pick a seed you know well and keep it fixed.
2. Change **one** parameter at a time.
3. Predict what will happen, then run 500–1,000 years and compare.
4. Undo with git if it gets worse (`git checkout -- src/sim/params.ts`).

---

# Generation

## World

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `MAP_WIDTH` | 1600 | 800–2400 | Map width in pixels | Bigger world, slower redraw | Smaller, faster |
| `MAP_HEIGHT` | 900 | 450–1350 | Map height in pixels | Same as above | Same as above |
| `CELL_COUNT` | 10000 | 3000–20000 | Number of cells | Finer borders, slower sim | Blockier borders, faster |

## Terrain

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `NOISE_SCALE` | 0.0016 | 0.001–0.004 | Size of landforms | Smaller, busier features | Larger, smoother continents |
| `NOISE_OCTAVES` | 6 | 3–8 | Layers of detail | Rougher, more detailed coasts | Smoother, simpler shapes |
| `NOISE_PERSISTENCE` | 0.5 | 0.3–0.7 | Strength of fine detail | Jagged terrain | Soft, rolling terrain |
| `NOISE_LACUNARITY` | 2.0 | 1.8–2.5 | Detail spacing between layers | Finer small detail | Coarser detail |
| `EDGE_FALLOFF` | 0.9 | 0–1.5 | Pushes land away from map edges | One central continent | Land reaches edges; more islands |
| `DOMAIN_WARP` | 0.3 | 0–0.8 | Twistiness of coastlines (only bends the 3 biggest noise layers) | Swirly, organic coasts | Blobby, rounder coasts |
| `RIDGE_STRENGTH` | 0.35 | 0–0.7 | How much ridged noise builds mountain ranges on high ground | Long, sharp mountain chains | Rounded hills, few ranges |
| `LAND_RATIO` | 0.40 | 0.25–0.60 | Share of map that's land | More land, more nations fit | More ocean, island feel |
| `MOUNTAIN_H` | 0.6 | 0.45–0.8 | Land elevation (0 = coast, 1 = peak) where mountains start | Fewer mountains | More mountains, more natural borders |

## Cells

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `CELL_JITTER` | 0.8 | 0–1 | How far cell centers wander from a perfect grid | Organic, irregular cells | Visible grid pattern |

## Climate

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `EQUATOR_TEMP` | 28 | 20–35 | Temperature at the warmest latitude (°C) | More desert and jungle | Cooler world |
| `POLE_TEMP` | -6 | -30–5 | Temperature at top/bottom edges | Less tundra and ice | More frozen north/south |
| `LAPSE_RATE` | 22 | 10–40 | Cooling from lowest to highest elevation | Snowier peaks | Milder highlands |
| `COAST_MOISTURE_BONUS` | 0.2 | 0–0.4 | Extra moisture near coasts | Greener coasts | Drier coasts |
| `COAST_MOISTURE_RANGE` | 8 | 2–20 | Cell steps inland over which the coast bonus fades | Wet interiors | Only the shoreline is wet |
| `MOISTURE_NOISE_SCALE` | 0.0025 | 0.001–0.006 | Size of wet/dry regions | Small, patchy regions | Huge wet/dry zones |

**Biome thresholds** (Whittaker-style chart in `gen/biomes.ts`): `ICE_TEMP` −10, `TUNDRA_TEMP` 0, `TAIGA_TEMP` 7, `HOT_TEMP` 19 (°C); `DRY_MOISTURE` 0.3, `SEMI_DRY_MOISTURE` 0.42, `FOREST_MOISTURE` 0.58, `WETLAND_MOISTURE` 0.8; wetlands only below land elevation `WETLAND_MAX_ELEVATION` 0.12. Raise a temperature threshold → that biome spreads toward the equator; raise a moisture threshold → drier biomes take over.

## Biomes

Base capacity is relative (1.0 = grassland). Move cost affects expansion and war (higher = harder to take).

| Biome | Base capacity | Move cost | Notes |
|---|---|---|---|
| Grassland | 1.0 | 1.0 | Baseline; empires grow fastest here |
| Temperate forest | 0.8 | 1.5 | |
| Savanna | 0.7 | 1.2 | |
| Tropical forest | 0.6 | 2.5 | Rich but hard to move through |
| Shrubland | 0.5 | 1.3 | |
| Taiga | 0.4 | 2.0 | |
| Wetland | 0.4 | 2.5 | Natural barrier |
| Desert | 0.15 | 3.0 | Natural barrier |
| Tundra | 0.15 | 2.5 | |
| Ice | 0 | 10 | Effectively uninhabitable |

**Modifiers:**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RIVER_CAP_MULT` | 1.5 | 1.0–2.5 | Capacity bonus on rivers | Population clusters on rivers | Rivers matter less |
| `COAST_CAP_MULT` | 1.2 | 1.0–2.0 | Capacity bonus on coasts | Coastal heartlands | Coasts matter less |
| `MOUNTAIN_CAP_MULT` | 0.3 | 0.1–0.6 | Capacity on mountains | Mountain nations viable | Mountains nearly empty |
| `MOUNTAIN_COST_MULT` | 3.0 | 1.5–6.0 | Move cost on mountains | Mountains become hard borders | Mountains barely slow anyone |
| `RIVER_COST_MULT` | 0.7 | 0.4–1.5 | Move cost on rivers (below 1 = easier) | Rivers become barriers | Rivers become highways |

## Rivers

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RIVER_SOURCE_MOISTURE` | 0.6 | 0.4–0.8 | Moisture needed to start a river | Fewer rivers | More rivers |
| `RIVER_SOURCE_MIN_H` | 0.35 | 0.15–0.7 | Land elevation (0 = coast, 1 = peak) needed to start a river | Rivers only from high ground | Rivers start from lowlands too |
| `RIVER_MIN_LENGTH` | 6 | 3–15 | Shortest river kept (cells) | Fewer, longer rivers | Many short streams |
| `RIVER_SOURCE_PROB` | 0.08 | 0.02–0.3 | Chance each eligible cell starts a river | Dense river network | A few big rivers |

## Starting nations

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `START_NATIONS` | 24 | 8–50 | Nations at year 0 | Crowded, early wars | Open land, long expansion phase |
| `START_MIN_SPACING` | 12 | 6–25 | Min cell-steps between capitals | Evenly spread | Clustered rivals |
| `START_CORE_SIZE` | 12 | 1–30 | Cells each nation starts with | Faster start | Slower start |
| `START_POP_FRACTION` | 0.3 | 0.1–0.8 | Starting pop as share of capacity | Strong from day one | Slow early growth |
| `START_STABILITY` | 0.8 | 0.3–1.0 | Stability every starting nation begins with | Long early calm | Early rebellions |
| `NATION_SATURATION` | 0.7 | 0.3–0.9 | How vivid nation colors are | Bold, game-like colors | Muted, pastel colors |
| `NATION_LIGHTNESS` | 0.52 | 0.35–0.7 | How light nation colors are | Pastel | Dark, heavy |

## Names

Example names per culture live in `src/gen/nameCorpus.ts` (all invented). Edit them to change how a culture sounds.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `NAME_ORDER` | 2 | 1–3 | Letters of context the Markov chain uses | Names closer to the examples (3 often copies them) | Wilder, less pronounceable names |
| `NAME_MIN_LENGTH` / `NAME_MAX_LENGTH` | 4 / 9 | 3–12 | Allowed name length in letters | — | — |

---

# Simulation

## Population

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `POP_GROWTH` | 0.02 | 0.005–0.05 | Yearly growth rate toward capacity | Fast recovery after wars | Wars scar for longer |
| `WAR_ATTRITION` | 0.05 | 0–0.2 | Pop lost yearly on war fronts | Wars devastate border regions | Wars are cheap |
| `NEW_CELL_POP_FRACTION` | 0.05 | 0.01–0.3 | Population a newly claimed cell starts with (share of capacity) | New land is productive at once | Frontier stays empty for decades |

## Totals

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `STRENGTH_POP_EXP` | 0.8 | 0.6–1.0 | How much size turns into military strength | Big nations dominate | Small nations can hold out |

## Stability

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `STAB_RECOVERY` | 0.01 | 0.002–0.03 | Stability regained per year | Empires recover; fewer breakups | Instability lingers |
| `ADMIN_CAP_BASE` | 120 | 60–300 | Cells before overextension starts | Bigger stable empires | Many mid-sized nations |
| `OVEREXT_K` | 0.002 | 0.0005–0.005 | Stability lost per cell over the cap | Big empires crack fast | Empires sprawl longer |
| `WEARINESS_STAB_K` | 0.02 | 0–0.05 | Stability lost from war weariness | Long wars trigger rebellions | Wars don't destabilize |
| `CONTROL_RANGE` | 12 | 6–30 | Travel cost from the capital at which control falls to ~37% (× ruler's cohesion) | Bigger empires hold together (try for "no great empires form") | Empires fray close to home |
| `CONTROL_ISLAND` | 0.2 | 0–0.5 | Control of cells the capital can't reach over its own land | Overseas holdings are easy | Islands and cut-off land barely held |
| `CONTROL_FREE` | 0.5 | 0.2–0.8 | Average control below which stability suffers | Only compact nations stay stable | Sprawl is fine |
| `CONTROL_STAB_K` | 0.02 | 0.005–0.05 | Stability lost per year per point of control below `CONTROL_FREE` | Sprawling empires crack | Shape and terrain don't matter |
| `WEARINESS_GAIN` | 0.03 | 0.01–0.08 | Weariness gained per war year | Wars end sooner | Long grinding wars |
| `WEARINESS_DECAY` | 0.05 | 0.02–0.1 | Weariness lost per peace year | Quick return to war | Long peaceful periods |
| `FOREIGN_FREE` | 0.2 | 0–0.5 | Share of foreign-race population a nation can hold before it hurts stability | Multi-race empires hold together | Even small minorities cause trouble |
| `FOREIGN_K` | 0.02 | 0–0.05 | Stability lost per year at 100% foreign population (÷ ruler's `tolerance`) | Conquerors of other races break apart | Race barely matters to stability |

Race traits also change this section: `ADMIN_CAP_BASE` × `cohesion`, `WEARINESS_GAIN` ÷ `endurance` (see **Races**).

## Expansion

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `EXPANSION_RATE` | 0.1 | 0.02–0.3 | Base chance to claim neighboring empty land | Map fills in fast | Long frontier era |

Terrain effects come from the Biomes move-cost table and the river/mountain modifiers.

## War

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `WAR_BASE_PROB` | 0.004 | 0.001–0.02 | Base yearly chance a neighbor pair goes to war | Constant warfare | Peaceful eras |
| `WAR_STRENGTH_EXP` | 1.0 | 0.5–2.0 | How much a power gap encourages war | Strong prey on weak | Wars between equals too |
| `WAR_MAX_PROB` | 0.1 | 0.02–0.3 | Ceiling on a pair's yearly war chance, however lopsided | Bullies attack almost at once | Even giants hesitate |
| `MAX_WARS_PER_NATION` | 2 | 1–4 | Concurrent wars per nation | Multi-front collapses | Focused wars |
| `DEFENDER_BONUS` | 1.2 | 1.0–1.6 | Defender strength multiplier | Hard to conquer; stable borders | Snowballing conquests |
| `FRONT_FLIPS_PER_YEAR` | 3 | 1–8 | Max cells captured per war per year | Fast, decisive wars | Slow, grinding fronts |
| `SCORE_PER_FLIP` | 5 | 2–15 | War score per captured cell | Wars end sooner | Wars drag on |
| `PEACE_SCORE` | 60 | 30–150 | Score needed to force peace | Bigger land grabs per war | Short border wars |
| `WEARINESS_PEACE` | 0.9 | 0.6–1.0 | Weariness that forces peace | Wars fought to exhaustion | Quick white peace |
| `MAX_WAR_YEARS` | 25 | 10–50 | Hard cap on war length | Generational wars | Short conflicts |
| `TRUCE_YEARS` | 10 | 0–30 | Years before the same pair can fight again | Calmer rivalries | Constant re-matches |

## Rebellion

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `REBEL_THRESHOLD` | 0.25 | 0.10–0.40 | Stability below which rebellions can start | Frequent breakups, more small nations | Empires last longer |
| `REBEL_PROB` | 0.03 | 0.01–0.10 | Yearly rebellion chance when unstable | Fast fragmentation | Unstable empires limp on |
| `REBEL_MIN_CAPITAL_DIST` | 5 | 3–15 | Min steps from capital for a rebel seed | Only far provinces rebel | Rebellions near the core |
| `REBEL_MAX_CELLS` | 40 | 10–100 | Max size of a breakaway nation | Big, dramatic splits | Many small splinters |
| `REBEL_START_STABILITY` | 0.6 | 0.3–0.9 | New rebel nation's starting stability | Rebels survive | Rebels often collapse |

## Collapse

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `MIN_AREA` | 6 | 2–15 | Cells below which a nation dissolves | Fewer tiny states | City-states can survive |
| `CAPITAL_LOSS_STAB_HIT` | 0.3 | 0–0.5 | Stability lost when the capital falls | Losing the capital is fatal | Capitals barely matter |

## Emergence

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `EMERGENCE_PROB` | 0.01 | 0.002–0.05 | Yearly chance empty land spawns a nation | Empty land refills quickly | Wastelands stay empty |
| `EMERGENCE_MIN_REGION` | 30 | 10–80 | Empty cells needed to spawn a nation | Only big voids refill | Small gaps fill too |
| `EMERGENCE_CORE_SIZE` | 8 | `MIN_AREA`–20 | Cells a newly emerged nation starts with (keep ≥ `MIN_AREA`) | Stronger newcomers | Fragile newcomers |

## Races

The race table is `RACES` in `src/gen/params.ts` (not editable in the Settings panel; change it in code). Check balance after changing it: in Command Prompt, `set RACE_BALANCE=1 && npx vitest run tests/raceBalance.test.ts` prints each race's share of the land on 10 worlds after 1,000 years. Every trait is a **multiplier**: 1.0 = Human, the baseline. SPEC §4.10 says which step uses each one.

**Rule of thumb:** keep traits between about 0.5 and 1.6, and give each race one clear strength paired with one weakness. Effects stack: a race 1.3× better at three things is about 2× stronger overall.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RACE_HOMES_PER_RACE` | 2 | 1–4 (in `gen/params.ts`) | Homeland points per race | Each race spread over more regions | Each race in one heartland |
| `RACE_HOME_FOCUS` | 3 | 1–6 (in `gen/params.ts`) | How strongly homelands favor land the race likes | Dwarves almost always start in mountains, Orcs in deserts | Homelands land almost anywhere |

### Traits

| Race | Family | growth | martial | defense | aggression | endurance | cohesion | unrest | tolerance | Plays as |
|---|---|---|---|---|---|---|---|---|---|---|
| Humans | human | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | Baseline; adaptable everywhere |
| Light Elves | elf | 0.6 | 1.1 | 1.4 | 0.5 | 0.8 | 0.9 | 0.6 | 0.6 | Defensive and isolationist; rarely attack, very hard to conquer |
| Dark Elves | elf | 0.7 | 1.3 | 1.1 | 1.4 | 0.9 | 0.7 | 1.2 | 0.5 | Raiders; strong and aggressive but can't hold conquests |
| Dwarves | dwarf | 0.7 | 1.2 | 1.5 | 0.7 | 1.3 | 0.9 | 0.6 | 0.7 | Mountain fortresses; stubborn, slow-growing, hard to dig out |
| Orcs | orc | 1.5 | 1.1 | 0.8 | 1.6 | 1.1 | 0.6 | 1.5 | 1.1 | Hordes; breed fast and love war, but their realms splinter |

| Trait | Up ↑ | Down ↓ |
|---|---|---|
| `growth` | Fills land and recovers from war fast | Slow to recover; losses hurt for longer |
| `martial` | Wins more battles | Loses more battles |
| `defense` | Front cells hard to take | Easy to overrun |
| `aggression` | Declares war more often | Peaceful neighbor |
| `endurance` | Fights long wars | Sues for peace early |
| `cohesion` | Holds bigger empires | Overextends early |
| `unrest` | Rebels more often | Loyal even when unstable |
| `tolerance` | Rules other races easily | Foreign subjects destabilize it |

### Homeland, capacity and movement

Affinity multiplies a cell's capacity for that race; terrain cost multiplies move cost when that race's nation expands. Anything not listed is 1.0.

| Race | Affinity (capacity ×) | Terrain cost (move cost ×) |
|---|---|---|
| Humans | — (baseline, so a human-only world matches pre-M7) | — |
| Light Elves | Temperate forest 1.5, Tropical forest 1.4, Grassland 0.8, Desert 0.5 | Temperate forest 0.5, Tropical forest 0.5 |
| Dark Elves | Taiga 1.6, Wetland 1.4, Mountains 1.5, Grassland 0.8 | Taiga 0.6, Wetland 0.6, Mountains 0.6 |
| Dwarves | Mountains 2.5, Taiga 1.3, Grassland 0.8, Tropical forest 0.5 | Mountains 0.4, Taiga 0.7, Temperate forest 1.3, Tropical forest 1.3 |
| Orcs | Desert 2.5, Shrubland 1.5, Savanna 1.3, Temperate forest 0.8 | Desert 0.5, Shrubland 0.7, Savanna 0.7 |

"Mountains" means the `mountainAffinity` / `mountainCost` fields (mountain is a cell flag, not a biome). Dark Elves and Dwarves both want mountains and taiga on purpose: a built-in frontier rivalry.

### Attitudes

`RACE_ATTITUDES` in `gen/params.ts`: how one race feels about another, −1 (hatred) .. 1 (kinship). Symmetric. It's the base of every opinion between two nations (see Diplomacy below), so the diagonal decides which races' kin ally readily.

|  | Humans | Light Elves | Dark Elves | Dwarves | Orcs |
|---|---|---|---|---|---|
| **Humans** | 0.2 | 0 | −0.2 | 0 | −0.3 |
| **Light Elves** | 0 | 0.3 | −0.8 | −0.1 | −0.6 |
| **Dark Elves** | −0.2 | −0.8 | 0.1 | −0.6 | −0.3 |
| **Dwarves** | 0 | −0.1 | −0.6 | 0.3 | −0.6 |
| **Orcs** | −0.3 | −0.6 | −0.3 | −0.6 | 0.1 |

## Diplomacy

Opinion between two nations moves `OPINION_DRIFT` of the way toward a target each year (race attitude, border friction, war, shared enemies; SPEC §4.12). Useful sums with the defaults: neighboring kin of Humans settle at 0.1, Light Elves and Dwarves at 0.2, Dark Elves and Orcs at 0.0. So only Light Elf and Dwarf kin reach `ALLIANCE_MIN_OPINION` (0.15) in peacetime; everyone else needs a shared enemy.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `OPINION_DRIFT` | 0.05 | 0.01–0.2 | Share of the gap to the target closed each year | Grudges and friendships change fast | Long memories; slow to ally |
| `BORDER_FRICTION` | 0.1 | 0–0.3 | Opinion lost for sharing a border | Neighbors distrust each other; fewer kin pacts | Neighbors as friendly as their races allow |
| `SHARED_ENEMY_BONUS` | 0.5 | 0–0.8 | Opinion gained while both fight the same nation | Wartime coalitions form quickly | Only kin ally |
| `WAR_OPINION_PENALTY` | 0.5 | 0–1 | Opinion lost while at war with each other | Bitter wars, revenge wars after | Wars barely leave hate |
| `WAR_OPINION_HIT` | 0.3 | 0–0.6 | Instant opinion drop when war is declared or joined | Lasting grudges | Wars forgotten fast |
| `REBEL_OPINION` | −0.6 | −1–0 | Opinion between rebels and their old rulers | (closer to 0) Peaceful breakups | Wars of reconquest |
| `OPINION_WAR_K` | 1.0 | 0–2 | How much opinion changes war chance (× 1 − opinion × K) | Hatred drives history; friends never fight | Opinion ignored (0) |
| `ALLIANCE_MIN_OPINION` | 0.15 | 0–0.5 | Opinion needed to ally | Few, solid alliances | Alliances everywhere |
| `ALLIANCE_BREAK_OPINION` | 0.05 | −0.3–0.15 | Alliance breaks below this | Coalitions dissolve soon after peace | Alliances last forever |
| `ALLIANCE_PROB` | 0.05 | 0.01–0.3 | Yearly chance an eligible pair allies | Alliances form at once | Slow to ally |
| `MAX_ALLIES` | 2 | 0–5 | Allies per nation | Huge blocs, world wars | Lone nations (0 = no alliances) |
| `ALLY_DEFEND_PROB` | 0.8 | 0–1 | Chance a bordering ally joins a defensive war | Allies reliably deter attacks | Unreliable allies |
| `ALLY_ATTACK_PROB` | 0.4 | 0–1 | Chance a bordering ally joins an attack | Allied blitzes, snowballing | Alliances purely defensive (0) |

---

# Rendering

All in `render/palette.ts`.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `HILLSHADE_AZIMUTH` | 315 | 0–360 | Light direction in degrees (315 = from top-left) | — | — |
| `HILLSHADE_ALTITUDE` | 45 | 20–70 | Light angle above the horizon | Flatter, softer shading | Dramatic long shadows |
| `HILLSHADE_STRENGTH` | 0.6 | 0.3–1.0 | How strong shading is | Punchy 3D relief | Flatter map |
| `HILLSHADE_EXAGGERATION` | 60 | 20–150 | Stretches heights before shading | Steep, dramatic slopes (too high = plastic look) | Soft, subtle relief |
| `TERRAIN_GRAIN` | 0.03 | 0–0.08 | Texture noise on terrain | Gritty, painted feel | Clean, smooth |
| `COAST_LINE_ALPHA` | 0.55 | 0–1 | Darkness of the inked coastline | Crisp, drawn coasts | Soft coasts |
| `COAST_GLOW_WIDTH` | 0.012 | 0–0.04 | Width of the pale shallow-water band | Wide glowing shallows | Hard coast edge |
| `SEA_GRID_SPACING` | 100 | 50–200 | Pixels between faint grid lines on water | Sparser grid | Denser grid |
| `SEA_GRID_ALPHA` | 0.08 | 0–0.2 | Visibility of the sea grid | Obvious grid | Invisible (0) |
| `LAND_RAMP` / `WATER_RAMP` | see code | — | Height → color stops (`?style=painted` only) | — | — |

### Cel-shaded style (default)

Flat biome colors on the low bands, rock/snow colors on high bands, 3-tone shading and ink lines. Kept light and muted so nation colors read on top. Pick the other style with `?style=painted`.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `CEL_LAND_BANDS` | 5 bands, see code | — | Flat colors and the height where each band ends | — | — |
| `CEL_SMOOTH_RADIUS` | 6 | 2–12 | Blur before banding/shading (pixels) | Rounder, simpler shapes | Busier, spottier detail |
| `CEL_SHADE_THRESHOLD` | 0.3 | 0.1–0.5 | How steep a slope must be to get the light/shadow tone | Only big slopes shaded | Shading everywhere |
| `CEL_FIRST_SHADED_BAND` | 1 | 0–3 | Lowest band that gets shading (0 = lowlands) | Flatter map | More relief on plains |
| `CEL_HIGHLIGHT` / `CEL_SHADOW` | 1.08 / 0.8 | 1.0–1.2 / 0.6–0.95 | Brightness of lit and shadowed slopes | Stronger contrast | Softer contrast |
| `CEL_BAND_LINE_ALPHA` | 0.3 | 0–0.7 | Darkness of lines between bands | Contour-map look | No contour lines |
| `CEL_COAST_WIDTH` | 2 | 1–4 | Inked coastline thickness (pixels) | Bold, cartoon coast | Fine coast |
| `CEL_SHALLOW_WIDTH` | 12 | 0–30 | Shallow-water strip width (pixels) | Wide shallows | Hard edge |
| `CEL_FIRST_ROCK_BAND` | 3 | 2–5 | First band that ignores biome and uses rock/snow color | More biome color on hills | More rocky highlands |
| `CEL_BAND_DARKEN` | 0.06 | 0–0.15 | How much each higher band darkens the biome color | Height reads more | Flatter, biome-only look |
| `CEL_BIOME_EDGE_WOBBLE` | 5 | 0–10 | Wave size (pixels) on biome edges | Wavier, hand-drawn edges | Straight cell edges (0) |
| `BIOME_COLORS` | see code | — | Flat color per biome | — | — |
| `RIVER_COLOR`, `RIVER_MIN_WIDTH`, `RIVER_WIDTH_PER_FLOW` | #3d7db3, 1.2, 0.6 | — | River color and how width grows with flow | Wider rivers | Thinner rivers |
| `CEL_RIPPLES` | [20, 32] | — | Distances (pixels) of ripple lines around coasts | Rings further out | Rings hug the coast |
| `OVERLAY_ALPHA` | 0.5 | 0.25–0.70 | Nation color opacity | Bold colors, less terrain | Terrain dominates |
| `BORDER_ALPHA` | 0.85 | 0.5–1.0 | Border line opacity | Crisp borders | Subtle borders |
| `BORDER_DARKEN` | 0.4 | 0.2–0.7 | How much darker borders are than fill | High contrast | Soft borders |
| `WAR_FRONT_COLOR` | #c8312b | — | Border color between nations at war (drawn 2 px thicker) | — | — |
| `LABEL_MIN_AREA` | 10 | 5–40 | Smallest nation that gets a label | Cleaner map | More names shown |
| `LABEL_MIN_SIZE` / `LABEL_MAX_SIZE` | 11 / 40 | — | Label font size limits (pixels) | — | — |
| `LABEL_SIZE_PER_SQRT_AREA` | 2.2 | 1–4 | How fast labels grow with nation size | Big nations shout | All labels similar size |
| `LABEL_LETTER_SPACING` | 0.18 | 0–0.5 | Gap between letters (share of font size) | Airy, map-style lettering | Tight text |
| `HIGHLIGHT_DIM` | 0.2 | 0–0.6 | How faded other nations get when you click an event | Others stay visible | Only the highlighted nations show |
| `CAPITAL_RADIUS` | 3 | 2–6 | Capital dot size (pixels) | Bigger dots | Smaller dots |
| `RACE_COLORS` | Humans #d9a441, Light Elves #9fd8e8, Dark Elves #6a4c93, Dwarves #a0522d, Orcs #6b8e23 | — | Tint per race in the **Races** map layer | — | — |
| `ALLIANCE_COLOR` / `ALLIANCE_OUTLINE` | light cream / dark brown, see code | — | Dashed line between allied capitals and its outline | — | — |
| `ALLIANCE_WIDTH` | 2 | 1–4 | Alliance line width (pixels) | Bolder lines | Subtler lines |
| `ALLIANCE_DASH` | [6, 4] | — | Dash and gap length (pixels) | — | — |

---

# Playback

| Parameter | Default | Range | What it controls |
|---|---|---|---|
| `SPEEDS` | [1, 5, 20, 50] | — | Years per second options |
| `DEFAULT_SPEED` | 5 | — | Speed on load |
| `SIM_YEARS` | 1000 | 200–5000 | Default length of a run |
| `EVENT_LOG_MAX` | 300 | 50–2000 | Most lines kept in the on-screen event log |
| `HIGHLIGHT_SECONDS` | 4 | 1–15 | How long nations stay highlighted after clicking an event |

---

# Tuning recipes

Common problems and which knobs to try first.

| Symptom | Try |
|---|---|
| History looks frozen; one giant empire forever | ↓ `ADMIN_CAP_BASE`, ↑ `OVEREXT_K`, ↑ `REBEL_PROB` |
| Total chaos; nothing lasts | ↑ `STAB_RECOVERY`, ↓ `REBEL_THRESHOLD`, ↑ `DEFENDER_BONUS` |
| Map fills too fast, wars start too early | ↓ `EXPANSION_RATE`, ↓ `START_NATIONS` |
| Wars never end | ↑ `WEARINESS_GAIN`, ↓ `PEACE_SCORE`, ↓ `MAX_WAR_YEARS` |
| Wars change nothing | ↑ `FRONT_FLIPS_PER_YEAR`, ↑ `PEACE_SCORE`, ↓ `DEFENDER_BONUS` |
| Borders ignore geography | ↑ `MOUNTAIN_COST_MULT`, ↑ desert/wetland move cost |
| Too many tiny nations | ↑ `MIN_AREA`, ↑ `REBEL_MAX_CELLS`, ↓ `EMERGENCE_PROB` |
| Map hard to read | ↓ `OVERLAY_ALPHA`, ↑ `BORDER_ALPHA`, ↑ `LABEL_MIN_AREA` |
| One race takes over most seeds | ↓ that race's `growth` or `martial` first; then ↑ `FOREIGN_K` so big multi-race empires crack |
| A race dies out early | ↑ its `defense` or its homeland affinity; check `RACE_HOMES_PER_RACE` |
| Race makes no difference | ↑ `FOREIGN_K`, ↓ `FOREIGN_FREE`; widen the trait spread a little |
| Alliances never change | ↑ `ALLIANCE_BREAK_OPINION`, ↑ `BORDER_FRICTION` |
| Allied blocs snowball | ↓ `ALLY_ATTACK_PROB`, ↓ `MAX_ALLIES` |
| Racial feuds don't show | ↑ `OPINION_WAR_K`, ↑ `WAR_OPINION_HIT` |

---

# Candidate parameters (not in code yet)

Ideas for future rules. When one is adopted, design it in SPEC.md, move it into the right section above, and add it to code.

| Idea | Parameter(s) | Effect |
|---|---|---|
| Terrain defense | see "Land and cell detail" below | Mountain/forest front cells harder to capture |
| River crossings | `RIVER_CROSSING_PENALTY` | Attacks across rivers slower |
| Naval expansion | `NAVAL_RANGE`, `NAVAL_EXPANSION_RATE` | Coastal nations claim islands across water |
| Alliances | `ALLIANCE_PROB`, `ALLY_JOIN_PROB` | Wars pull in allies; bigger conflicts |
| Culture affinity | `CULTURE_REBEL_BONUS`, `CULTURE_WAR_PENALTY` | Foreign-culture provinces rebel more; kin nations fight less |
| Dynasties | `SUCCESSION_CRISIS_PROB` | Random stability shocks on ruler death |
| Plague | `PLAGUE_PROB`, `PLAGUE_DEATH_RATE`, `PLAGUE_SPREAD` | Population crashes that spread through neighbors |
| Golden age | `GOLDEN_AGE_PROB`, `GOLDEN_AGE_BONUS` | Temporary stability and strength boost |
| Trade | `TRADE_ROUTE_BONUS` | Connected coastal/river cells gain capacity |
| Time slowdown | `SLOWDOWN_ON_EVENTS`, `SLOWDOWN_FACTOR` | Playback slows for major wars and collapses |

## Land and cell detail (planned, M9)

Design in SPEC.md §4.11. All values are first guesses. Generation values would go in `gen/params.ts`, the rest in `SIM`.

**Being built.** In code so far: control (moved up to Stability), and "Unrest, devastation, ownership" plus `CLAIM_YEARS` / `CLAIM_WAR_BONUS` (live in the Settings panel under "Land" and "War"). This section moves into the main Simulation part when M9 is done.

### Resources and terrain (generation)

| Parameter | Default | Range | Effect |
|---|---|---|---|
| `RESOURCE_PROB` | 0.04 | 0.01–0.1 | Share of land cells with a deposit (~160 on a 10k-cell map). ↑ = resources everywhere, less worth fighting over |
| `RICHNESS_SKEW` | 2 | 1–4 | ↑ = more poor deposits, rarer rich ones |
| `PROVINCE_SIZE` | 20 | 10–40 | Cells per province. ↓ = smaller rebellions and more named regions |
| `MOUNTAIN_DEFENSE` | 1.5 | 1–2.5 | × defensibility of mountain cells |
| `RIVER_DEFENSE` | 1.2 | 1–1.5 | × defensibility of river cells |
| Biome `defense` column | 1.0; forests 1.2, tropical forest and wetland 1.3, desert 1.1 | 0.8–1.5 | × defensibility by biome |

**`RESOURCES` table** (effect = multiplier at full access; owning none = 1.0, so a world without resources behaves as before):

| Resource | Multiplies | Full-access effect | Rarity weight |
|---|---|---|---|
| Grain | Cell capacity (all cells) | 1.10 | 1.0 |
| Timber | Expansion move cost | 0.85 | 1.0 |
| Iron | `martial` | 1.15 | 0.8 |
| Gold | `STAB_RECOVERY` | 1.30 | 0.5 |
| Horses | `EXPANSION_RATE` | 1.15 | 0.8 |
| Mithril | Front-line `defense` | 1.20 | 0.15 |

### Resource use and cell value

| Parameter | Default | Range | Effect |
|---|---|---|---|
| `RESOURCE_SATURATION` | 2.0 | 0.5–5 | Total richness needed for the full bonus. ↑ = big empires keep gaining from more deposits (more snowball) |
| `FAVORED_RESOURCE_VALUE` | 2 | 1–4 | How much more a race values its favored resources when picking war targets |

### Unrest, devastation, ownership

| Parameter | Default | Range | Effect |
|---|---|---|---|
| `UNREST_CONQUEST` | 0.6 | 0.2–1 | Unrest a cell jumps to when captured |
| `UNREST_CONTROL_K` | 0.05 | 0.02–0.1 | Unrest gained per year × (1 − control). Must beat `UNREST_DECAY`, or weak control alone never builds unrest (at 0.05 it builds where control < 0.6, or < 0.2 in core land) |
| `UNREST_FOREIGN_K` | 0.01 | 0–0.03 | Unrest gained per year when the ruler is another race (÷ tolerance) |
| `UNREST_DEVASTATION_K` | 0.02 | 0–0.05 | Unrest gained per year × devastation |
| `UNREST_DECAY` | 0.02 | 0.005–0.05 | Unrest lost per year (doubled in core land) |
| `CORE_YEARS` | 50 | 20–150 | Years of ownership before a cell counts as core |
| `DEVASTATION_FRONT` | 0.1 | 0.02–0.3 | Devastation gained per year on a war front |
| `DEVASTATION_CAPTURE` | 0.5 | 0.1–1 | Devastation added when a cell changes hands |
| `DEVASTATION_HEAL` | 0.05 | 0.01–0.2 | Share of devastation healed per year (at 0.05, half heals in ~14 years) |
| `DEVASTATION_CAP_LOSS` | 0.5 | 0.2–0.9 | Capacity lost at full devastation |

### Development and settlements

| Parameter | Default | Range | Effect |
|---|---|---|---|
| `DEV_GROWTH` | 0.005 | 0.001–0.02 | Yearly development gain in ideal conditions (~200 years to full) |
| `DEV_DEVASTATION_LOSS` | 0.05 | 0.01–0.2 | Development lost per year × devastation |
| `SETTLE_THRESHOLDS` | [0.15, 0.4, 0.7] | — | Development for village, town, city |
| `SETTLE_MIN_POP_FRACTION` | 0.6 | 0.3–0.9 | Pop / capacity a town or city also needs |
| `SETTLE_DOWN_FACTOR` | 0.8 | 0.5–1 | A level is lost only below threshold × this (stops flicker) |
| `CITY_MIN_SPACING` | 6 | 3–12 | Cell-steps between cities. ↓ = more cities |

### War motives

| Parameter | Default | Range | Effect |
|---|---|---|---|
| `WAR_VALUE_K` | 1.0 | 0–3 | How much a valuable border cell raises the chance of war |
| `CLAIM_YEARS` | 100 | 30–300 | How long lost land can be claimed |
| `CLAIM_WAR_BONUS` | 2.0 | 1–4 | × war chance against a nation holding your claimed land |
