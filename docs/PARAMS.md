# Realm Forge — Parameter Tuning Guide

What every tunable number does, a sensible range, and what happens when you change it. This is the **"what number"** doc; [`SPEC.md`](SPEC.md) explains how each system uses them. Section headings mirror SPEC.md.

**Source of truth:** the actual values live in code:

| Code file | Covers |
|---|---|
| `src/gen/params.ts` | World, Terrain, Climate, Biomes, Rivers, Starting nations, Races (`RACES` table and homelands) |
| `src/sim/params.ts` | Population through Armies (one `SIM` object, editable live in the Settings panel) |
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

Base capacity is relative (1.0 = grassland). Move cost affects expansion and control (higher = harder to reach). Defense multiplies a cell's defensibility in war (SPEC §4.11).

| Biome | Base capacity | Move cost | Defense | Notes |
|---|---|---|---|---|
| Grassland | 1.0 | 1.0 | 1.0 | Baseline; empires grow fastest here |
| Temperate forest | 0.8 | 1.5 | 1.2 | |
| Savanna | 0.7 | 1.2 | 1.0 | |
| Tropical forest | 0.6 | 2.5 | 1.3 | Rich but hard to move through |
| Shrubland | 0.5 | 1.3 | 1.0 | |
| Taiga | 0.4 | 2.0 | 1.2 | |
| Wetland | 0.4 | 2.5 | 1.3 | Natural barrier |
| Desert | 0.15 | 3.0 | 1.1 | Natural barrier |
| Tundra | 0.15 | 2.5 | 1.0 | |
| Ice | 0 | 10 | 1.0 | Effectively uninhabitable |

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
| `START_CORE_SIZE` | 12 | 1–30 | Cells a nation starts with (× its race's `startSize`) | Faster start | Slower start |
| `START_HOME_RANGE` | 4 | 0–8 | Steps a capital can shift at year 0 toward land its race likes | Races sit deep in their homelands | Capitals stay where they were placed (0) |
| `START_POP_FRACTION` | 0.3 | 0.1–0.8 | Starting pop as share of capacity | Strong from day one | Slow early growth |
| `START_STABILITY` | 0.8 | 0.3–1.0 | Stability every starting nation begins with | Long early calm | Early rebellions |
| `START_KINGDOMS` | 10 | 5–10 | Old kingdoms at year 0 in a settled start (picked in the toolbar; `MIN_KINGDOMS`–`MAX_KINGDOMS`) | Smaller realms, more of them | A few vast empires |
| `SETTLED_POP_FRACTION` | 0.9 | 0.5–1.0 | Settled start: people as share of capacity | Strong old realms from day one | Room to grow |
| `OLD_REALM_YEARS` | 200 | 0–500 | How long old kingdoms have held their land at year 0 (core land) | All of it core from the start | Land feels freshly conquered |
| `KINGDOM_SPACING` | 14 | 6–25 | Min cell-steps between old kingdoms' capitals | Even shares | Capitals crowd, some kingdoms boxed in |
| `KINGDOM_MIN_LAND` | 100 | 0–500 | Smallest body of land an old kingdom's capital may stand on | No island kingdoms | Kingdoms on small islands |
| `KINGDOM_ROOM` | 6 | 0–12 | Steps a capital may move toward open country | Fewer peninsula kingdoms | Capitals stay at their homelands |
| `SETTLED_DEV` | 0.85 | 0.3–1.0 | Settled start: development × control at year 0 | More towns and cities | Thinly settled old realms |
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
| `OVEREXT_K` | 0.00003 | 0.00001–0.001 | Stability lost per year per cell over the cap. A nation settles about `STAB_RECOVERY / OVEREXT_K` cells above its cap (at the old 0.002 any big nation hit stability 0 at once) | Big empires crack fast | Empires sprawl longer |
| `VIGOR_BONUS` | 120 | 0–200 | Extra land a brand-new nation can rule, as a multiple of its normal cap | Young conquerors hold huge realms | Age doesn't matter (0) |
| `VIGOR_YEARS` | 250 | 80–400 | Years for that extra to fade to ~37% | Empires last longer | Empires crack sooner |
| `WEARINESS_STAB_K` | 0.01 | 0–0.05 | Stability lost from war weariness | Long wars trigger rebellions | Wars don't destabilize |
| `CONTROL_RANGE` | 50 | 6–80 | Travel cost from the capital at which control falls to ~37% (× ruler's cohesion) | Bigger empires hold together (try for "no great empires form") | Empires fray close to home |
| `CONTROL_ISLAND` | 0.2 | 0–0.5 | Control of cells the capital can't reach over its own land | Overseas holdings are easy | Islands and cut-off land barely held |
| `CONTROL_FREE` | 0.5 | 0.2–0.8 | Average control below which stability suffers | Only compact nations stay stable | Sprawl is fine |
| `CONTROL_STAB_K` | 0.02 | 0.005–0.05 | Stability lost per year per point of control below `CONTROL_FREE` | Sprawling empires crack | Shape and terrain don't matter |
| `WEARINESS_GAIN` | 0.02 | 0.01–0.08 | Weariness gained per war year | Wars end sooner | Long grinding wars |
| `WEARINESS_DECAY` | 0.05 | 0.02–0.1 | Weariness lost per peace year | Quick return to war | Long peaceful periods |
| `FOREIGN_FREE` | 0.2 | 0–0.5 | Share of foreign-race population a nation can hold before it hurts stability | Multi-race empires hold together | Even small minorities cause trouble |
| `FOREIGN_K` | 0.02 | 0–0.05 | Stability lost per year at 100% foreign population (÷ ruler's `tolerance`) | Conquerors of other races break apart | Race barely matters to stability |

Race traits also change this section: `ADMIN_CAP_BASE` × `cohesion` (and × vigor, which fades with age), `WEARINESS_GAIN` ÷ `endurance` (see **Races**).

## Expansion

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `EXPANSION_RATE` | 0.1 | 0.02–0.3 | Base chance to claim neighboring empty land | Map fills in fast | Long frontier era |

Terrain effects come from the Biomes move-cost table and the river/mountain modifiers.

## War

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `INTEL_ERROR` | 0.7 | 0–1.5 | Each year a nation's estimate of its strength against a rival is off by up to × e^±this (×0.5 – ×2 at 0.7). Measured: 0.4 → 3% of wars started by a weaker or even side, 0.7 → 5%, 1.0 → 7%; each step adds wars | Weak realms attack often and lose | Nations judge exactly, as before M18 (0) |
| `INTEL_FOREIGN` | 1.5 | 1–3 | × `INTEL_ERROR` against a nation of another race | Wars between races are the gambles | Strangers judged as well as kin |
| `WAR_BASE_PROB` | 0.001 | 0.001–0.02 | Base yearly chance a neighbor pair goes to war (0.004 before M9's war motives, 0.003 before M11 manpower) | Constant warfare | Peaceful eras |
| `WAR_STRENGTH_EXP` | 2.25 | 0.5–3 | How much a power gap encourages war (1.0 before M11: soldier counts differ more between nations than the old `strength` did) | Strong prey on weak | Wars between equals too |
| `WAR_MAX_PROB` | 0.3 | 0.02–0.3 | Ceiling on a pair's yearly war chance, however lopsided | Bullies attack almost at once | Even giants hesitate |
| `MAX_WARS_PER_NATION` | 2 | 1–4 | Concurrent wars per nation | Multi-front collapses | Focused wars |
| `DEFENDER_BONUS` | 1.2 | 1.0–1.6 | Defender strength multiplier | Hard to conquer; stable borders | Snowballing conquests |
| `PEACE_SCORE` | 400 | 50–800 | Score needed to force peace | Bigger land grabs per war | Short border wars |
| `WIN_SCORE` | 30 | 10–100 | Score a war needs to have a winner when it ends some other way; below this it's a white peace | More white peace | Small wins still take land |
| `WEARINESS_PEACE` | 0.9 | 0.6–1.0 | Weariness that forces peace | Wars fought to exhaustion | Quick white peace |
| `HOLD_SCORE` | 10 | 0–20 | Score to the defender for each year (after the first) the attacker holds none of what it came for (M18) | Failed invasions become defeats sooner | Holding out counts for nothing (0, before M18) |
| `SUE_PROB` | 0.05 | 0–0.3 | Yearly chance a side losing by `WIN_SCORE`+ sues for peace (× 1 + weariness) (M18) | Many short wars ending on small terms | Wars only end by force (0) |
| `ACCEPT_PROB` | 0.2 | 0–1 | Chance the winner accepts terms (+ its weariness) (M18) | Winners settle for less | Winners fight on for everything |
| `PLAYER_WEARY` | 0.6 | 0–1 | War weariness at which the player's "when war-weary" policies (sue for peace, accept terms) take effect (M20) | The player's realm holds out longer before giving in | It gives in at the first losses |
| `DEFEND_WEARINESS` | 0.25 | 0.1–1 | × weariness gained (yearly and from losses) by a nation only defending (M18) | Defenders give in as fast as attackers (1) | Defenders hold on until the attacker tires |
| `MAX_WAR_YEARS` | 25 | 10–50 | Hard cap on war length | Generational wars | Short conflicts |
| `TRUCE_YEARS` | 10 | 0–30 | Years before the same pair can fight again | Calmer rivalries | Constant re-matches |
| `WAR_VALUE_K` | 0.5 | 0–3 | War chance × (1 + this × value of the best enemy border cell) | Wars chase rich land | Land value ignored (0) |
| `CLAIM_YEARS` | 100 | 30–300 | How long land lost to a nation can be claimed back | Old grudges drive wars for centuries | Lost land is soon forgotten |
| `CLAIM_WAR_BONUS` | 2.0 | 1–4 | × war chance against a nation holding your claimed land | Reconquest wars dominate; rebels get swallowed back | Claims don't matter (1) |

## Rebellion

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `REBEL_THRESHOLD` | 0.15 | 0.10–0.40 | Stability below which rebellions can start | Frequent breakups, more small nations | Empires last longer |
| `REBEL_PROB` | 0.03 | 0.01–0.10 | Yearly revolt chance of an unstable nation whose land adds up to `REBEL_RESTLESS_CELLS` of unrest | Fast fragmentation | Unstable empires limp on |
| `REBEL_RESTLESS_CELLS` | 300 | 40–500 | Total unrest at which the revolt chance equals `REBEL_PROB` | Revolts need more restless land | Even small unrest sets off revolts |
| `REBEL_SPREAD` | 0.3 | 0–0.7 | Chance each revolt sets off another in that nation the same year | Empires fall in one blow | Empires crumble slowly |
| `REBEL_MAX_SPREAD` | 5 | 1–10 | Most revolts one nation can have in a year | Bigger collapses | Gentler collapses |
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
| `assimilation` | Takes on rulers of its race fast (table in Culture and faith) | Keeps its old ways |
| `conversion` | Changes faith easily (table in Culture and faith) | Holds to its faith |
| `growth` | Fills land and recovers from war fast | Slow to recover; losses hurt for longer |
| `martial` | Wins more battles | Loses more battles |
| `defense` | Its land is hard to fight in | Easy to overrun |
| `aggression` | Declares war more often | Peaceful neighbor |
| `endurance` | Fights long wars | Sues for peace early |
| `cohesion` | Holds bigger empires | Overextends early |
| `unrest` | Rebels more often | Loyal even when unstable |
| `tolerance` | Rules other races easily | Foreign subjects destabilize it |
| `startSize` | Starts with more land (× `START_CORE_SIZE`): Humans 1, Light Elves 1.75, Dark Elves 1.25, Dwarves 1, Orcs 0.75 | Starts smaller; must stay above `MIN_AREA` |

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

## Land and cell detail

SPEC §4.11. Generation values (first table) are in `gen/params.ts` and need a new world; the rest are in `SIM` and live in the Settings panel ("Land"). Control is under Stability; `WAR_VALUE_K` and the claim values are under War.

### Resources, terrain and provinces (generation)

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RESOURCE_PROB` | 0.04 | 0.01–0.1 | Share of land cells with a deposit (~160 on a 10k-cell map) | Resources everywhere, less worth fighting over | Rare, fought-over deposits |
| `RICHNESS_SKEW` | 2 | 1–4 | Richness = random ^ this | Mostly poor deposits, a few rich ones | Evenly rich deposits |
| `HILL_H` | 0.4 | 0.2–0.55 | Land elevation where hills (and iron) start; hills end at `MOUNTAIN_H` | Less iron, high up | Iron in low hills too |
| `HIGH_MOUNTAIN_H` | 0.8 | 0.65–0.95 | Land elevation where mithril can appear | Mithril almost never | Mithril on most mountains |
| `MOUNTAIN_DEFENSE` | 1.5 | 1–2.5 | × defensibility of mountain cells | Mountain realms near-impregnable | Mountains don't help in war |
| `RIVER_DEFENSE` | 1.2 | 1–1.5 | × defensibility of river cells | Rivers become defensive lines | Rivers don't matter in war |
| `PROVINCE_SIZE` | 20 | 10–40 | Rough cells per province (comes out ~17 at 20) | Bigger regions; rebellions take whole large provinces | Smaller provinces |

The biome `defense` column is in the Biomes table above.

**`RESOURCES` table** (effect = multiplier at full access; owning none = 1.0):

| Resource | Multiplies | Full-access effect | Rarity weight | Favored by |
|---|---|---|---|---|
| Grain | Capacity of all the nation's cells | 1.10 | 1.0 | Humans |
| Timber | Move cost when expanding | 0.85 | 1.0 | Light Elves |
| Iron | `martial` (army strength) | 1.15 | 0.8 | Dwarves, Orcs |
| Gold | `STAB_RECOVERY` | 1.30 | 0.5 | Dwarves |
| Horses | `EXPANSION_RATE` | 1.15 | 0.8 | Humans, Orcs |
| Mithril | `defense` of armies in their own land | 1.20 | 0.15 | Dwarves, Dark Elves |

### Unrest, devastation, ownership

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `UNREST_CONQUEST` | 0.2 | 0.2–1 | Unrest a cell jumps to (at least) when captured | Conquests rebel soon | Conquered land settles quietly |
| `UNREST_CONTROL_K` | 0.05 | 0.02–0.1 | Unrest gained per year × (1 − control). Must beat `UNREST_DECAY` or weak control alone never builds unrest (at 0.05: builds where control < 0.6, or < 0.2 in core land) | Far provinces seethe | Only conquest and foreign rule cause unrest |
| `UNREST_FOREIGN_K` | 0.01 | 0–0.03 | Unrest gained per year under rulers of another race (÷ tolerance) | Subject peoples always restless | Race of the ruler doesn't matter |
| `UNREST_DEVASTATION_K` | 0.02 | 0–0.05 | Unrest gained per year × devastation | War-torn land rises | War damage doesn't anger people |
| `UNREST_CRISIS_K` | 0.04 | 0–0.1 | Unrest gained per year in a nation at stability 0 (fades to 0 at `REBEL_THRESHOLD`). Links national crisis to local unrest | A crisis ignites everything | Only weak land grows restless |
| `UNREST_DECAY` | 0.02 | 0.005–0.05 | Unrest lost per year (doubled in core land) | Grievances fade fast | Grievances linger |
| `CORE_YEARS` | 50 | 20–150 | Years of ownership before a cell is core land | Conquests stay restless longer | Conquests settle in fast |
| `DEVASTATION_CAPTURE` | 0.5 | 0.1–1 | Devastation added when a cell changes hands in war | Conquest wrecks land | Conquest is clean |
| `DEVASTATION_HEAL` | 0.05 | 0.01–0.2 | Share of devastation healed per year (half heals in ~14 years) | Quick recovery | Scars last generations |
| `DEVASTATION_CAP_LOSS` | 0.5 | 0.2–0.9 | Capacity lost at full devastation | War empties regions | War damage barely matters |

### Development and settlements

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `DEV_GROWTH` | 0.005 | 0.001–0.02 | Yearly development gain in ideal conditions (~200 years to full) | Cities spring up fast | Cities only in ancient heartlands |
| `DEV_DEVASTATION_LOSS` | 0.05 | 0.01–0.2 | Development lost per year × devastation | War razes cities | Cities survive wars |
| `SETTLE_VILLAGE` / `SETTLE_TOWN` / `SETTLE_CITY` | 0.15 / 0.4 / 0.7 | 0–1, rising | Development needed for each level | Fewer, older settlements | Settlements everywhere |
| `SETTLE_MIN_POP_FRACTION` | 0.6 | 0.3–0.9 | Pop / capacity a town or city also needs | Only crowded land urbanizes | Empty land can hold towns |
| `SETTLE_DOWN_FACTOR` | 0.8 | 0.5–1 | A level is lost only below threshold × this (stops flicker) | Settlements shrink quickly | Settlements cling on |
| `CITY_MIN_SPACING` | 6 | 3–12 | Fewest cell-steps between cities | Few, spread-out cities | Many cities |

### Resource use and cell value

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RESOURCE_SATURATION` | 2.0 | 0.5–5 | Total richness of one resource needed for its full bonus | Big empires keep gaining from more deposits (more snowball) | One deposit is enough |
| `FAVORED_RESOURCE_VALUE` | 2 | 1–4 | How much more a race values deposits it favors | Races fight hard for their resource | Races don't care which resource |

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
| `PACT_FADE` | 0.00005 | 0–0.0005 | Each ally's yearly chance to let a pact lapse grows by this for every year without a shared war (× race `fickleness`). At 0.00005 a quiet Human pact has about even odds of outlasting 120 years from fading alone | Pacts last only a generation or two | Pacts last until a member dies (0) |
| `NEW_RULER_BREAK` | 0.03 | 0–0.3 | Chance a ruler crowned last year breaks each pact (× race `fickleness`). Orcs, with short reigns, feel it most | Every new reign reshuffles alliances | Rulers honor their forebears' pacts (0) |
| `PACT_BROKEN_OPINION` | 0 | −0.5–0.15 | Opinion falls to at most this when a pact breaks. From 0, kin take about a generation to ally again | Old allies stay friendly and re-ally within a few years | Broken pacts leave enemies, and wars follow |
| `GREAT_SCHEMER_BREAK` | 2 | 1–5 | A great Schemer is this many times as likely to break a pact on taking the throne | Schemers tear up every pact | Schemers no worse than anyone |
| `ALLY_DEFEND_PROB` | 0.8 | 0–1 | Chance a bordering ally joins a defensive war | Allies reliably deter attacks | Unreliable allies |
| `ALLY_ATTACK_PROB` | 0.4 | 0–1 | Chance a bordering ally joins an attack | Allied blitzes, snowballing | Alliances purely defensive (0) |

---

## Armies

> Built in M11 (SPEC §4.13). In `src/sim/params.ts`, Settings → Armies. Soldiers are in the same units as `pop` (1 ≈ a fully settled grassland cell); a big realm has a cap of about 0.5–1.5.

Measured after step 1 (5 seeds × 1,000 years, vs before): ~100 wars per century (81), shorter and more decisive (~5 at once, was ~6); 49 nations alive at year 1000 (38); biggest 578 cells (681); nations sit at ~80% of their cap on average. Race balance: biggest race 40%, no takeovers.

Measured after step 3 (same 5 seeds, vs step 2): ~128 wars per century (103), ~20% white peace (13%), ~680 battles per century, 6.6 cells per war won, ~9 wars and ~10 armies at once; 51 nations alive (49); biggest 398 cells (578); soldiers at ~87% of cap; tick 8.1 ms (7.5). Rebellions ~21 and collapses ~18 per century, both about as before. Race balance: biggest race 40%, no takeovers. Tuned from the first guesses: `SIEGE_STEPS` 1 → 0.5, `BATTLE_SCORE` 10 → 4, `ROUT_SCORE` 10 → 6, because wars were ending on battles alone with about 3 cells moved.

Measured after step 4 (same 5 seeds, vs step 3): ~106 wars per century (128), 11% white peace (20%), ~710 battles per century (~680), 6 cells per war won (6.6), ~6 wars and ~7 armies at once (~9, ~10); 66 nations alive (51); biggest 338 cells (398); rebellions ~20 (~21), collapses ~16 (~18); tick 8.9 ms (8.1). Race balance: biggest race 40%, no takeovers. Tuned: `RAID_CHANCE` 0.25 → 0.15, `WAR_BASE_PROB` 0.002 → 0.0015, `PEACE_SCORE` 60 → 90 (goal cells score double, so at 60 wars stopped at about 10 cells, short of their goal).

Measured after step 5, the finished milestone (same 5 seeds, vs step 4): ~113 wars per century including ~8 to crush rebels (106), 13% white peace (11%), ~980 battles per century (~710), 5 cells per war won (6), ~6 wars and ~8 armies at once; 61 nations alive (66); biggest 341 cells (338); rebellions ~18 (~20), collapses ~15 (~16); both sides have an army in 26% of war-years (was 15%, because a lost army took decades to replace); 18% of wars end because a side died; tick 9.3 ms (8.9). 10-seed race balance: biggest race 40%, no takeovers. Tuned: `MORALE_LOSS` 0.35 → 0.25, `ROUT_RETURN` 0.5 → 0.75, `MIN_ARMY_SIZE` 0.05 → 0.03, `LEVY_REFILL` 0.1 → 0.15, `REBEL_LEVY` 0.15 → 0.1, `WAR_BASE_PROB` 0.0015 → 0.0014.

**Manpower**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `LEVY_SHARE` | 0.08 | 0.03–0.2 | Most soldiers a nation can have, as a share of `levyPop` (people × martial × control) | Huge armies; wars decided by numbers | Small armies; terrain and forts matter more |
| `LEVY_REFILL` | 0.25 | 0.03–0.3 | Share of the gap to the cap refilled per year (× 0.5 + stability) | Losers bounce back fast | A lost army means decades of weakness |
| `GENERAL_SPREAD` | 0.3 | 0–0.7 | A new general's skill is between e^-this and e^+this (M18) | Battles turn on who leads | Every general alike (0) |
| `GENERAL_WIN_BONUS` | 0.05 | 0–0.2 | × power per victory, up to `GENERAL_MAX_WINS` (10) | Veteran generals dominate | Experience doesn't count |
| `GENERAL_FAMOUS` | 30 | 5–100 | Victories that make a general famous (log only) | Few famous generals | The log fills with generals |
| `GENERAL_DEATH` / `GENERAL_DEATH_ROUT` | 0.05 / 0.3 | 0–1 | Chance a beaten general dies, and when the army is destroyed | Generals come and go | Generals last whole careers |
| `GENERAL_CAREER` | 30 | 10–60 | Years before a general retires | Marshals lead for generations | Short careers |
| `RALLY_REFILL` | 2 | 1–4 | × `LEVY_REFILL` while a nation is defending in a war (M18) | Invaded realms raise new armies fast | No rally (1, before M18) |
| `WEARINESS_LOSS_K` | 0.25 | 0–2 | War weariness gained per share of the cap lost | Bloody wars end quickly | Losses don't push toward peace (0) |

**Raising armies**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `MOBILIZE_SHARE` | 0.8 | 0.3–1 | Share of the reserve raised into a new army | Everything thrown in at once | Big reserve held back |
| `REINFORCE_RATE` | 0.3 | 0–1 | Share of the reserve sent each year to armies in supply | Armies refill quickly | Armies wear down |
| `MIN_ARMY_SIZE` | 0.03 | 0.01–0.2 | Smallest army worth raising; smaller ones rout | Weak nations can't field armies | Tiny armies wander the map |

**Campaign and movement**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `CAMPAIGN_STEPS` | 4 | 1–12 | War steps (seasons) per year | Faster wars, smoother marches, slower tick | Clunky, slow wars |
| `ARMY_MOVE` | 4 | 1–10 | Move points per step (grassland costs 1) | Armies cross realms in a season | Slow slogs |
| `ENGAGE_RANGE` | 6 | 2–15 | Steps within which an army goes after an enemy army | Wars are battle-hunts | Armies ignore each other; more sieges |
| `ENGAGE_RATIO` | 0.8 | 0.5–1.5 | Estimated own/enemy effective power needed to seek battle, including the enemy's ground advantage and the general's boldness | Cautious; defenders sit in cities | Reckless attacks |
| `ENGAGE_INTEL_ERROR` | 0.4 | 0–1 | Error in scouting enemy effective power, including defensive advantages: × e^±this (about ×0.67–1.49 at 0.4). Each army's report about a foe lasts the year; separate from war-declaration intelligence | More mistaken attacks and missed opportunities | More accurate scouting; general personality and random battle outcomes still apply at 0 |
| `RETREAT_MORALE` | 0.4 | 0.2–0.6 | Below this an army falls back to its own settlement | Armies retreat early | Fight to the end |
| `RAID_RANGE` | 5 | 2–10 | How far past the border armies look for rich targets | Deep raids | Border skirmishes |
| `ARMY_ATTRITION` | 0.03 | 0–0.1 | Size lost per step × food shortage (× 2 in desert, tundra, ice, mountains) | Long invasions bleed out | Armies roam freely |
| `SUPPLY_RANGE` | 6 | 1–12 | Maximum links through controlled land back to unoccupied home/allied land | Longer invasions can be fed | Occupied pockets are harder to supply |
| `FORAGE_SHARE` | 0.5 | 0–0.9 | Maximum food share found locally; scales down with devastation and army size relative to local population | Cut-off hosts last longer | Supply routes matter more |
| `SUPPLY_MORALE_LOSS` | 0.06 | 0–0.2 | Morale lost per season × food shortage | Hungry armies withdraw sooner | They keep campaigning longer |

**Battle**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `BATTLE_LOSS` | 0.25 | 0.1–0.5 | Base share of the loser's army lost (× power ratio) | Decisive, bloody battles | Long series of small fights |
| `BATTLE_MAX_LOSS` | 0.6 | 0.3–0.9 | Cap on losses in one battle | Armies wiped out in one day | Even defeats leave a core |
| `WINNER_LOSS_SHARE` | 0.4 | 0.1–1 | Winner's losses relative to the loser's (÷ ratio) | Pyrrhic victories | Cheap victories |
| `FORT_BONUS` | 0.15 | 0–0.5 | Defender power per settlement level (city = +45%) | Cities are fortresses | Cities don't help |
| `MORALE_LOSS` / `MORALE_GAIN` | 0.25 / 0.1 | 0.1–0.6 / 0–0.3 | Morale lost by the loser / gained by the winner | Swingy wars | Steady wars |
| `MORALE_RECOVERY` | 0.15 | 0.05–0.4 | Morale regained per step on supplied, unoccupied home/allied land | Beaten armies return fast | Defeats linger |
| `ROUT_MORALE` | 0.15 | 0–0.3 | Below this an army is destroyed | Armies shatter | Armies always limp home |
| `ROUT_RETURN` | 0.75 | 0–1 | Share of a routed army's soldiers who return to the reserve | Defeats are survivable | Routs are catastrophes |
| `BATTLE_POP_LOSS` / `DEVASTATION_BATTLE` | 0.1 / 0.3 | 0–0.3 / 0–0.6 | People lost and devastation at a battle site | Battlefields scar the land | Clean battles |
| `DEVASTATION_MARCH` | 0.05 | 0–0.2 | Devastation per enemy cell an army marches through | Invasion trails of ruin | Armies pass lightly |

`DEFENDER_BONUS` (War) also applies to the defending army in a battle.

**Siege and occupation**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `SIEGE_STEPS` | 0.5 | 0.25–4 | Steps to occupy an empty cell (× defensibility) | Slow conquest | Armies sweep through |
| `SIEGE_SETTLEMENT_K` | 1.5 | 0–4 | Extra siege time per settlement level (city = 5.5 × base) | Cities hold out for years | Cities fall like villages |
| `CAPITAL_SIEGE_MULT` | 2 | 1–4 | Capitals take this much longer | Capitals almost never fall | Capitals fall quickly |
| `SIEGE_GARRISON_SHARE` | 0.1 | 0.02–0.3 | Population share representing local resistance, multiplied by walls, terrain and capital status | Small hosts struggle, assaults are riskier | Strongholds fall more easily |
| `SIEGE_RECOVERY` | 0.2 | 0–1 | Siege progress repaired each season without an unopposed, fit besieger | Relief and withdrawal erase progress quickly | Earlier siege work persists |
| `SIEGE_ASSAULT_RATIO` | 3 | 1–10 | Estimated advantage needed to choose an assault | Generals wait more often | More costly gambles |
| `SIEGE_ASSAULT_LOSS` | 0.12 | 0–0.5 | Attacking soldiers lost in every assault, including victories | Storming walls is expensive | Quick conquest is cheaper |
| `UNREST_OCCUPIED` | 0.05 | 0–0.2 | Unrest gained per year while occupied | Occupied land turns on its owner | Occupation stays calm |

**War goals, score and peace**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RAID_CHANCE` | 0.15 | 0–0.6 | Chance a war without a claim is a raid (× ruling race `aggression`) | Lots of plundering, few border changes | Every war is for land |
| `BATTLE_SCORE` / `ROUT_SCORE` | 4 / 6 | 0–30 | Score for winning a battle / destroying an army | Battles decide wars | Sieges decide wars |
| `SCORE_PER_OCCUPIED` | 3 | 1–10 | Score per occupied enemy cell | Wars end sooner | Wars drag on |
| `GOAL_SCORE_MULT` | 2 | 1–4 | Goal cells count this much more | Wars focus on their goal | Any occupation will do |
| `CAPITAL_SCORE` | 20 | 0–60 | Score for holding the enemy capital | Taking the capital wins the war | Capitals don't matter |
| `CONQUEST_MAX_PROVINCES` | 8 | 1–12 | Most provinces one conquest aims for. A war aims for one per whole time the attacker outmatches the defender | Strong nations swallow neighbors whole | Every war is over one province (1) |
| `SUBJUGATE_RATIO` | 1 | 1–3 | How many times stronger an attacker must be to also march on the enemy capital. Holding it at peace makes the loser a vassal (docs/systems/vassalage.md) | Only crushing wars make vassals | Every war goes for the throne (1) |
| `PEACE_EXTRA_CELLS` | 40 | 0–80 | Occupied non-goal cells a winner may also keep, if they touch its land | Wars grab more land | Wars only take the goal (0) |
| `RAID_TRIBUTE` | 0.1 | 0–0.3 | Stability moved from loser to winner after a raid | Raids break nations | Raids only burn land |

`PEACE_SCORE`, `WIN_SCORE`, `WEARINESS_PEACE`, `MAX_WAR_YEARS` and `TRUCE_YEARS` (War) still apply.

**Rebels**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `REBEL_LEVY` | 0.1 | 0.05–0.4 | Rebel army size as a share of the region's people × martial (the old nation loses the same share of its reserve) | Rebels win their freedom | Rebels get crushed |
| `REBEL_WAR_PROB` | 0.5 | 0–1 | Chance the old nation fights at once to take the rebels back | Every rebellion is a civil war | Peaceful breakaways; claims may bring war later |

**Log**

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `BATTLE_NAME_RANGE` | 3 | 0–6 | Steps from a battle to a city it can be named after (log text only) | More named battles | More "in the hills of…" |

## Culture and faith

SPEC §4.14. `FAITHS` and the race traits are in `gen/params.ts`; the rest are in `SIM`, in the Settings panel (under "Culture and faith", except `UNREST_KIN_K` and `UNREST_FAITH_K` under Land and `FAITH_OPINION` under Diplomacy).

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `CULTURE_RATE` | 0.05 | 0–0.2 | Yearly chance a cell copies the ruler's culture from a neighbor (× assimilation × control) | Empires absorb their kin in a few generations; fewer realms return | Old peoples last forever |
| `ASSIMILATE_MAX_UNREST` | 0.3 | 0–1 | Cells more restless than this keep their culture | Even angry land assimilates | Only calm land does |
| `FAITH_RATE` | 0.03 | 0–0.2 | Yearly chance a cell copies a neighbor's faith (× reach × conversion) | Faiths sweep the map | Faith maps barely move |
| `FAITH_FOREIGN_SPREAD` | 0.6 | 0–1 | × that chance when the faith isn't the owner's | Faiths ignore borders | Faith borders match nation borders |
| `OLD_GODS_MIN_UNREST` | 0.8 | 0.3–1 | Unrest at which land can turn to the Old Gods | Only the worst land | Cults everywhere |
| `OLD_GODS_SPARK` | 0.0005 | 0–0.01 | Yearly chance of that, per cell | Cults everywhere | Rarely seen |
| `OLD_GODS_UNREST_REACH` | 3 | 0–10 | Old Gods reach × (1 + this × the cell's unrest) | Spread fast through troubled land | Same speed everywhere |
| `OLD_GODS_ELF_SPREAD` | 0.2 | 0–1 | × Old Gods spread into elf cells | Elves worship them too | Elves never do |
| `UNREST_KIN_K` | 0.004 | 0–0.02 | Unrest gained per year by the ruler's race of another culture (÷ tolerance) | Conquered kin stay restless | Kin settle at once |
| `UNREST_FAITH_K` | 0.004 | 0–0.02 | Unrest gained per year × fervor by people of another faith (÷ tolerance) | Religious borders burn | Faith doesn't anger anyone |
| `FAITH_MAJORITY` | 0.35 | 0.2–0.9 | Share of the people a realm's biggest rival faith needs before it may be adopted | Realms keep their faith | Realms convert easily |
| `FAITH_ADOPT` | 0.05 | 0–0.2 | Yearly chance of adopting it | Realms convert at once | Rulers hold out for centuries |
| `FAITH_OPINION` | 0.1 | 0–0.3 | Opinion ± between nations of one or different faiths (× average fervor) | Faith blocs | Faith ignored in diplomacy |

### Faith table

| Faith | Reach | Fervor | Blessing | Effect |
|---|---|---|---|---|
| The Old Gods | 0.4 | 0.5 | Whispers | 0.01: unrest a year on each cell next to a shrine in a realm of another faith |
| The Radiant Covenant | 1.5 | 1.3 | Order | 1.1 × `STAB_RECOVERY`. Strong: at 1.3 rebellions fell by a quarter, so keep it low |
| The Evergreen Vow | 0.5 | 1.0 | Sanctuary | 1.15 × power of armies on their own land |
| The Silver Choir | 0.5 | 1.0 | Remembrance | 0.5 × assimilation of its believers |
| The Hollow Mother | 1.0 | 1.6 | Devotion | 1.3 × `LEVY_REFILL` |
| The Deep Ancestors | 0.3 | 0.5 | Grudges | 2 × `CLAIM_YEARS` |
| The Anvil Oath | 0.6 | 1.0 | Forge | 1.4 × `DEV_GROWTH` |
| The Red Hunger | 1.4 | 1.3 | Warpath | 1.3 × war chance |
| The Bone Drums | 1.3 | 0.5 | Kinship | 2 × assimilation in its nations |

### Race traits

| Race | `assimilation` (how fast they take on rulers of their race) | `conversion` (how fast they change faith) |
|---|---|---|
| Humans | 1.0 | 1.0 |
| Light Elves | 0.35 | 0.4 |
| Dark Elves | 0.6 | 0.8 |
| Dwarves | 0.45 | 0.2 |
| Orcs | 1.5 | 1.3 |

---

## Rulers and dynasties

SPEC §4.15 and `docs/systems/rulers.md`. Race tables are in `gen/params.ts`; the rest are in `SIM`, in the Settings panel under "Rulers and dynasties".

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `GREAT_RULER_CHANCE` | 0.05 | 0–0.3 | Chance a new ruler is great (× the race's number for the type × size) | Great rulers everywhere, none feel special | Rare legends |
| `GREAT_AREA` | 200 | 50–1000 | A realm this big is twice as likely to get one | Size matters less | Empires always have legends |
| `GREAT_CONQUEROR_POWER` | 1.5 | 1–2 | × army power | Stronger conquerors, more rebellions (it also raises the strength ratio in war chance) | Barely noticed |
| `GREAT_CONQUEROR_WAR` | 2 | 1–3 | × chance of starting wars | Constant war | Conquerors sit at home |
| `GREAT_LAWGIVER_CAP` | 2 | 1–4 | × `adminCap` | Old realms hold more land | No help to big realms |
| `GREAT_LAWGIVER_CALM` | 1.5 | 1–3 | × `UNREST_DECAY` on its land | Quiet realms | Unrest ignores them |
| `GREAT_BUILDER_DEV` | 2 | 1–4 | × `DEV_GROWTH` | Cities spring up | Little effect |
| `GREAT_PROPHET_SPREAD` | 3 | 1–6 | × spread of the nation's faith, everywhere | Faith sweeps the map | Prophets go unheard |
| `GREAT_SCHEMER_STAB` | 0.01 | 0–0.05 | Stability its most hated neighbor loses each year | Rivals crumble from afar | Harmless |
| `HEIR_CHANCE` | 0.75 | 0–1 | Chance the same dynasty continues | Dynasties last centuries | A new house each generation |
| `DYNASTY_STAB_HIT` | 0.05 | 0–0.3 | Stability lost when a dynasty ends | Dynasty changes hurt | Pass unnoticed |
| `CRISIS_BASE` | 0.01 | 0–0.1 | Crisis chance at a succession (× race `succession` × size). Very sensitive: 0.05 meant 53 civil wars a run and empires a quarter smaller | Constant turmoil | Peaceful handovers |
| `CRISIS_AREA` | 400 | 100–2000 | A realm this big has twice the crisis chance | Size matters less | Big realms always break |
| `CRISIS_GREAT` | 3 | 1–10 | × crisis chance after a great ruler | Every legend ends in ruin | Their realms carry on |
| `CRISIS_STAB_HIT` | 0.3 | 0–1 | Stability lost in a crisis | Crises turn into collapse | Mild |
| `CIVIL_WAR_MIN_AREA` | 100 | 10–300 | Cells needed for a crisis to become civil war | Only great realms split | Small realms split too |
| `CIVIL_WAR_CELLS_PER_SPLIT` | 150 | 30–500 | One pretender per this many cells | Fewer successors | More successors |
| `CIVIL_WAR_MAX_SPLITS` | 4 | 1–8 | Most pretenders in one crisis | Empires shatter | Clean two-way splits |
| `CIVIL_WAR_SHARE` | 0.25 | 0.05–0.5 | Largest share of the land one pretender can take (only land of the ruling people, as far from the capital as `REBEL_MIN_CAPITAL_DIST`) | Big successors | Small breakaways |

`REIGN_SPREAD` (0.5, `gen/params.ts`): a reign lasts the race's `reign`, give or take this share.

### Vassals

`docs/systems/vassalage.md`. In the Settings panel under "Rulers and dynasties".

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `INDEPENDENCE_CHANCE` | 4 | 0–8 | × the AI vassal's chance to declare independence when its overlord's ruler is crowned. The chance is also × (1 − opinion) / 2 × min(1, its power / the overlord's) | Crowns break up at every succession | Vassals serve until their overlord falls (0) |
| `ANNEX_CHANCE` | 0.25 | 0–1 | Chance the AI takes a whole realm whose capital it holds instead of making it a vassal, × the race's aggression² (Light Elves ~6%, Humans 25%, Orcs ~64%) | More conquest, fewer vassals | Every held capital makes a vassal |
| `VASSAL_DEMAND_RATIO` | 3 | 1.5–5 | How many times stronger (with vassals) a winner must be to demand submission when it doesn't hold the capital | Only crushing wins make vassals | Many more vassals; crowns grow fast |
| `VASSAL_DEMAND_CHANCE` | 0.15 | 0–0.5 | Chance the AI then demands it, ÷ the race's aggression | Huge crowns (0.5: 40% crowns in ~80% of worlds) | Crowns stay ~30% (0) |

### Great ruler table

The race's number for each type, × `GREAT_RULER_CHANCE`.

| Race | Conqueror | Lawgiver | Builder | Prophet | Schemer |
|---|---|---|---|---|---|
| Humans | 1 | 3 | 1 | 1 | 1 |
| Orcs | 3 | 0.5 | 0.5 | 1 | 0.5 |
| Dwarves | 0.5 | 1 | 3 | 0.5 | 0.5 |
| Light Elves | 0.5 | 1 | 1 | 3 | 1 |
| Dark Elves | 1 | 0.5 | 0.5 | 1 | 3 |

### Race traits

| Race | `reign` (average years) | `succession` (× crisis chance) | `femaleChance` | `fickleness` (× `PACT_FADE`, `NEW_RULER_BREAK`) | `confidence` (× war estimate) | `temper` (rulers' and generals' boldness e^±this) |
|---|---|---|---|---|---|---|
| Humans | 25 | 1.0 | 0.5 | 1.0 | 1.0 | 0.6 (×0.55 – ×1.8: some warmongers, some timid) |
| Light Elves | 120 | 0.5 | 0.5 | 0.6 (long memories) | 0.9 | 0.25 (steady) |
| Dark Elves | 80 | 1.2 | 0.8 | 1.6 (treacherous) | 1.15 | 0.5 (unpredictable) |
| Dwarves | 60 | 0.4 | 0 | 0.5 (oaths are kept) | 0.9 | 0.2 (steady) |
| Orcs | 15 | 2.0 | 0 | 1.5 (loyal to strength, not to pacts) | 1.25 (overrate themselves) | 0.3 |

`confidence` and `temper` (M18 misjudgment) change only how a nation judges a war, not how it fights: a race that overrates itself starts more wars and loses more of them. Fighting appetite is `aggression` (race traits table). A wide `temper` turned out to help a race slightly (bold kings mostly pick on weaker realms, timid ones lose little), so widen it with a balance check.

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

### Parchment style (default)

An old chart: aged paper, pale sea, thin ink outlines, drawn terrain symbols. Colors and sizes are the `ATLAS_*` values in `render/palette.ts`; how it changes realms, names and towns is the `LOOK_ATLAS` object below them.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `LOOK_ATLAS.overlayAlpha` | 0.38 | 0.1–0.7 | Strength of realm color | Bolder, paper fades | Paler, more paper shows |
| `LOOK_ATLAS.overlayEdgeAlpha` | 0.54 | 0.2–0.9 | Strength of the color band along borders | Hand-tinted edges stand out | Flat color |
| `LOOK_ATLAS.overlayEdgeWidth` | 3 | 0–5 | Width of that band in pixels (keep ≤ 5, or redraws can miss it) | Wider band | 0 = no band |
| `LOOK_ATLAS.tintShare` | 0.32 | 0–0.7 | How far realm colors lean toward sepia | Calmer, realms look alike | Brighter colors |
| `LOOK_ATLAS.borderAlpha` | 0.88 | 0.3–1 | Darkness of border lines | Crisper | Softer |
| `playedBorderWidth`, `playedBorder` | 3, ink (gold `#f3dd90` on the classic maps) | 1–5 | The played realm's border (M20): width in pixels and color, in `LOOK_ATLAS` and `LOOK_STANDARD`. Keep ≤ 5, or redraws can miss it | Bolder outline | Like any other border |
| `ATLAS_HILL_CHANCE` | 0.3 | 0–1 | Share of hill cells with a symbol | Busier | Calmer |
| `ATLAS_FOREST_CHANCE` | 0.3 | 0–1 | Share of forest cells with trees | Busier | Calmer |
| `ATLAS_PEAK_SIZE` | 13 | 8–20 | Mountain symbol size in pixels | Taller peaks | Smaller peaks |
| `ATLAS_WATERLINES` | see code | — | Lines along the coast: distance and strength | — | — |
| `ATLAS_COAST_WIDTH` | 1.7 | 1–4 | Coastline thickness in pixels | Heavier | Finer |
| `ATLAS_STAIN` | 0.07 | 0–0.15 | Paper stains | Older paper | Clean paper |
| `ATLAS_EDGE_DARKEN` | 0.2 | 0–0.4 | Darkening at the sheet's edge | Stronger | None |
| `ATLAS_CASTLE_SCALE` | 1 | 0.6–1.6 | Size of capital castles | Bigger castles, can cover names | Smaller castles |
| `ATLAS_CITY_SCALE` | 1 | 0.6–1.6 | Size of city spires | Cities stand out | Quieter cities |
| `ATLAS_RESOURCE_GROWTH` | 1.6 | 1–2.5 | Resource disc size, as a multiple of the classic marker | Icons easier to read | Less clutter |
| `ATLAS_RESOURCE_PAPER` | 0.55 | 0–1 | How far resource discs lean toward paper | Paler discs | Stronger colors |
| `ATLAS_SAILING_RAYS` | 16 | 8–32 | Sailing lines from each hub | Denser net | Sparser |

### Cel-shaded style (Classic map, `?style=cel`)

Flat biome colors on the low bands, rock/snow colors on high bands, 3-tone shading and ink lines. Kept light and muted so nation colors read on top. Pick it with the Classic map button, or `?style=painted` for the painted style.

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
| `VASSAL_BAND_WIDTH` | 3 | 0–6 | Width in pixels of the band inside a vassal's borders, in its overlord's color | Crowns read as blocks | Vassals look independent (0) |
| `VASSAL_BAND_ALPHA` | 0.8 | 0.3–1 | How solid that band is | Bold | Faint |
| `CAPITAL_RADIUS` | 3 | 2–6 | Capital dot size (pixels) | Bigger dots | Smaller dots |
| `RACE_COLORS` | Humans #d9a441, Light Elves #9fd8e8, Dark Elves #6a4c93, Dwarves #a0522d, Orcs #6b8e23 | — | Tint per race in the **Races** map layer | — | — |
| `ALLIANCE_COLOR` / `ALLIANCE_OUTLINE` | light cream / dark brown, see code | — | Dashed line between allied capitals and its outline | — | — |
| `ALLIANCE_WIDTH` | 2 | 1–4 | Alliance line width (pixels) | Bolder lines | Subtler lines |
| `ALLIANCE_DASH` | [6, 4] | — | Dash and gap length (pixels) | — | — |
| `HEAT_RAMP` / `HEAT_ALPHA` | pale yellow → orange → dark red / 0.75 | — / 0.4–1 | Heatmap colors (low → high) and opacity | Heatmap hides the map | Faint heatmap |
| `RESOURCE_COLORS` / `RESOURCE_LETTERS` | see code | — | Marker color and letter per resource (G grain, T timber, I iron, $ gold, H horses, M mithril) | — | — |
| `RESOURCE_RADIUS` / `RESOURCE_RICH_GROWTH` | 4 / 2 | 2–6 / 0–4 | Marker size, and extra size for the richest deposits | Bigger markers | Smaller markers |
| `TOWN_RADIUS`, `CITY_SIZE`, `CITY_FONT` | 1.8, 5, italic 10px | — | Town dot, city square and city name | — | — |

### War and unrest effects

Animated layer (key E). Visual only: changing these never changes history. Times are real seconds, not years.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `OCCUPIED_HATCH_ALPHA` | 0.45 | 0–0.8 | Opacity of the occupier's stripes on occupied land | Occupations glare | Faint stripes (0 = off) |
| `OCCUPIED_HATCH_SPACING` / `OCCUPIED_HATCH_WIDTH` | 8 / 2.5 | 4–16 / 1–5 | Gap between stripes and their thickness (pixels) | Sparser / bolder stripes | Denser / finer stripes |
| `OCCUPIED_HATCH_SPEED` | 10 | 0–40 | How fast stripes slide (pixels per second) | Busy, urgent land | Still stripes (0) |
| `SIEGE_RING_RADIUS` / `SIEGE_RING_WIDTH` | 7 / 2 | 4–14 / 1–4 | Size and thickness of the siege ring (pixels) | Sieges stand out | Discreet rings |
| `SIEGE_RING_COLOR` | `#fbf6e9` | any color | Color of the siege ring | — | — |
| `BATTLE_SECONDS` | 1.4 | 0.5–4 | How long a battle flash lasts | Battles linger (and pile up at high speed) | Quick sparks |
| `BATTLE_RADIUS` | 16 | 8–30 | How far the battle ring spreads (pixels) | Big flashes | Small flashes |
| `BATTLE_SWORD_SIZE` | 7 | 4–12 | Half-length of the crossed swords (pixels) | Bigger swords | Smaller swords |
| `EVENT_BURST_SECONDS` | 2.5 | 1–6 | How long rebellion / founding / collapse rings last | Lingering rings | Brief rings |
| `EVENT_BURST_RADIUS` | 45 | 20–80 | How far event rings spread (pixels) | Dramatic | Subtle |
| `COLLAPSE_COLOR` | #2b2620 | — | Ring color when a nation collapses or is annexed | — | — |
| `MAX_BURSTS` | 80 | 20–200 | Most battle and event flashes at once (oldest give way) | Busier at high speed | Calmer at high speed |
| `SMOKE_MIN_DEVASTATION` | 0.25 | 0.1–0.6 | Devastation a cell needs before it smokes | Only the worst ruins smoke | Smoke everywhere after a war |
| `SMOKE_ALPHA` / `SMOKE_SIZE` / `SMOKE_RISE` | 0.8 / 7 / 14 | 0.3–1 / 4–12 / 6–30 | Puff opacity (× the cell's devastation), size and how high it drifts (pixels) | Heavy smoke | Light haze |
| `SMOKE_SECONDS` | 3 | 1–6 | Time for one puff to rise and fade | Slow, lazy smoke | Fast, busy smoke |
| `SMOKE_COLOR` | 70, 62, 56 | — | Smoke color (R, G, B) | — | — |
| `EMBER_MIN_UNREST` | 0.9 | 0.6–0.99 | Unrest a cell needs before it glows. Only cells in nations with stability < `REBEL_THRESHOLD` count (they could rebel this year). Measured: ~40% of owned land sits at ≥ 0.9, so the stability rule does most of the picking | Only the angriest land glows | More glow in unstable realms |
| `EMBER_DENSITY` | 0.3 | 0.1–1 | Share of qualifying cells that glow | Unstable realms blaze | A few scattered sparks |
| `EMBER_SIZE` / `EMBER_FLICKER` | 5 / 5 | 3–9 / 1–12 | Glow size (pixels) and flicker speed | Bigger, faster flames | Small, slow glow |
| `EMBER_COLOR` | 255, 122, 26 | — | Ember color (R, G, B) | — | — |

### Armies

> Layer key W. Occupied land and sieges are in "War and unrest effects" above (key E). In `src/render/palette.ts`, except `ARMY_MEN_PER_UNIT`, which is in `src/sim/params.ts` because the event log uses it too. Visual only.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `ARMY_MEN_PER_UNIT` | 20000 | 5000–50000 | Men shown per soldier unit (the label only) | Bigger numbers on banners | Smaller numbers |
| `ARMY_BANNER_MIN` / `ARMY_BANNER_MAX` | 7 / 16 | 4–12 / 10–24 | Banner half-height for the smallest / largest armies (pixels) | Armies dominate the map | Discreet markers |
| `ARMY_BANNER_FULL` | 1 | 0.3–3 | Soldiers at which a banner reaches full size | Only giant hosts look big | Most armies look big |
| `ARMY_TARGET_ALPHA` | 0.5 | 0–1 | Opacity of the dashed line to the army's target | Clear war plans | Hidden (0) |

### Ruler card

> Key P. In `src/render/palette.ts`. Boxes are fractions of the frame image (left, top, right, bottom), measured by `scripts/portraits.py`; re-run it if a frame changes. Visual only.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RULER_CARD_WIDTH` | 180 | 120–300 | Card width on screen (pixels) | Big, covers more map | Small, harder to see the face |
| `RULER_CARD_OPENINGS` | see file | — | Where the portrait shows inside each frame | — | — |
| `RULER_CARD_PLATES` | see file | — | Where the name is written on each frame's nameplate | — | — |
| `RULER_CARD_NAME_FONT` / `RULER_CARD_SUB_FONT` | 28px IM Fell English SC / italic 20px IM Fell English | — | Name and dynasty fonts (shrunk to fit if too long) | — | — |
| `RULER_CARD_TEXT` | #1d150d | — | Ink color on the nameplate | — | — |
| `RULER_CARD_BURN_REACH` | 0.42 | 0.2–0.8 | How far into a fallen ruler's card the fire eats | Little left, the face goes | Only the rim is singed |
| `RULER_CARD_BURN_BOTTOM` | 6 | 1–10 | How much harder the nameplate edge is to burn | Name always readable | Name burns away with the rest |
| `RULER_CARD_BURN_SCORCH` | 0.45 | 0–0.8 | How brown the surviving card turns | Dark, smoked | Colors stay fresh |
| `RULER_CARD_BURN_EMBER` / `RULER_CARD_BURN_CHAR` | #ff8a2a / #120b07 | — | The glowing front and the black behind it | — | — |
| `RULER_CARD_BURN_SECONDS` | 2.2 | 1–5 | How long the burning takes (`src/ui/config.ts`) | Slow, solemn | Quick flash |
| `RULER_CARD_FALL_SECONDS` | 4 | ≥ burn seconds | How long the fallen card stays up in all (`src/ui/config.ts`) | Lingers, blocks hover longer | Gone as soon as it's burned |

### 3D relief view

> Key V, the **3D map** button, or `?view=3d`. In `src/render/palette.ts`. Visual only: the simulation never sees these. Design in SPEC §5.4n.

| Parameter | Default | Range | What it controls | Up ↑ | Down ↓ |
|---|---|---|---|---|---|
| `RELIEF_HEIGHT` | 120 | 40–250 | Height of the tallest peak, in map pixels (the map is 1600 wide) | Towering mountains that hide land behind them | A nearly flat sheet |
| `RELIEF_CURVE` | 1.5 | 1–3 | How height grows with elevation (height = elevation ^ curve) | Flat lowlands, sudden peaks | Everything rises evenly, hilly plains |
| `RELIEF_STEP` | 4 | 2–10 | Map pixels between points of the 3D surface | Smoother, blockier hills; faster | Finer ground; slower to build and draw |
| `RELIEF_SKIN_SCALE` | 1 | 1–2 (whole number) | How many times larger than the flat map the picture laid over the terrain is drawn | Sharper close up; about four times the memory and a ~1.5 s wait when switching to 3D | 1 = soft close up, instant switch, lightest (the default while the 3D lag is open) |
| `RELIEF_NAME_SCALE` | 1 | 0.5–2 | Size of the standing realm names in 3D, compared with the flat map's names | Bigger names, more overlap | Smaller, harder to read from afar |
| `RELIEF_NAME_LIFT` | 0.4 | 0–2 | How far a name floats above the ground, × its letter height | Names hover high, harder to tell whose land they mark | Names sit on the ground |
| `RELIEF_NAME_PIXELS` | 96 | 48–160 | Letter height of each name's picture, in pixels | Sharper names close up, more memory | Soft names close up |
| `RELIEF_AMBIENT` | 2.1 | 1–3.5 | Even light from everywhere | Brighter, flatter-looking | Darker, moodier |
| `RELIEF_SUN` | 1.5 | 0–3 | Light from the north-west that shades slopes | Stronger light and dark on hills | Slopes hard to read |
| `RELIEF_BACKGROUND` | #17120c | — | Color around the map | — | — |
| `RELIEF_FOV` | 40 | 25–60 | Camera's angle of view (degrees) | Wide-angle, stretched edges | Flatter, telescope-like |
| `RELIEF_NEAR_FAR` | 0.12, 1.6 | — | Closest and farthest the camera may go, × map width | — | — |

---

# Playback

| Parameter | Default | Range | What it controls |
|---|---|---|---|
| `SPEEDS` | [1, 5, 20, 50, 100] | — | Years per second options |
| `DEFAULT_SPEED` | 5 | — | Speed on load |
| `SIM_YEARS` | 1000 | 200–5000 | Default length of a run |
| `EVENT_LOG_MAX` | 300 | 50–2000 | Most lines kept in the on-screen event log |
| `HIGHLIGHT_SECONDS` | 4 | 1–15 | How long nations stay highlighted after clicking an event |
| `FOLLOW_SPEED` | 5 | 1–20 | While following a war, playback goes no faster than this; the old speed comes back when you stop |
| `FOCUS_GOAL_COLOR`, `FOCUS_GOAL_RADIUS` | #e0b84a, 4 | — | Gold ring on goal land the attacker hasn't taken yet (`render/palette.ts`) |
| `FOCUS_HELD_SIZE`, `FOCUS_EDGE` | 5, dark brown | — | Diamond in the occupier's color on occupied land (`render/palette.ts`) |
| `RULER_CARD_SECONDS` | 5 | 2–15 | How long the ruler card stays up when a great ruler rises (`src/ui/config.ts`) |
| `MAX_ZOOM` | 4 | 2–8 | Closest zoom (M19): 4 = a quarter of the map across (`src/ui/config.ts`) |
| `ZOOM_WHEEL_K` | 0.002 | 0.0005–0.01 | How fast the mouse wheel zooms: one wheel step of 100 zooms by e^(100 × this) |
| `ZOOM_STEP` | 2 | 1.25–4 | Zoom per double-click or + / − key |
| `ZOOM_SHARP_DELAY` | 150 | 0–1000 | Milliseconds after the view stops moving before it's redrawn sharp (the redraw takes ~0.4 s) |
| `FOLLOW_ZOOM_MAX` | 3 | 1–4 | Following a war zooms to fit its two capitals, but no closer than this |
| `MARK_ZOOM_GROWTH` | 0.5 | 0–1 | Zoomed in, markers, names, rivers, terrain symbols and inked lines grow on screen as zoom ^ this (×2 at 4×). 1 = they grow with the map; 0 = they stay the same size (`render/palette.ts`) |
| `PLAYER_MOBILIZE_CHOICES` | [0.25, 0.5, 0.8, 1] | — | The Play tab's "Raise for a new war" choices, as shares of the reserve (`src/ui/config.ts`); the current policy is listed too if it isn't one of them |
| `MAP_BESIDE_WIDTH` | 900 | 700–1600 | From this window width (px) up, the side panel sits beside the map and the map shrinks to fit the window's height, so it's all one page. Must match the `@media` rule in `index.html` |
| `CLICK_SLOP` | 4 | 2–10 | A press on the map that moves further than this (screen pixels) is a drag, not a click picking a war target |
| `PLAY_LIST_MAX` | 40 | 10–200 | Most realms listed when choosing a nation to play, largest first |
| `ODDS_RUNS` | 20 | 5–100 | Futures the Sandbox's odds run (`src/sim/params.ts`, not in Settings or saves). More = finer percentages, but slower (~1.5 s each in the browser) |
| `ODDS_YEARS` | 50 | 1–500 | Years each future runs by default; the tab's Years box can change it per run |

---

# Tuning recipes

Common problems and which knobs to try first.

| Symptom | Try |
|---|---|
| History looks frozen; one giant empire forever | ↓ `VIGOR_YEARS`, ↑ `UNREST_CRISIS_K`, ↑ `REBEL_SPREAD`, ↑ `OVEREXT_K` |
| No great empires form | ↑ `CONTROL_RANGE`, ↑ `VIGOR_BONUS`, ↓ `SUBJUGATE_RATIO`, ↑ `WAR_STRENGTH_EXP`, ↑ `CONQUEST_MAX_PROVINCES`, ↑ `PEACE_EXTRA_CELLS`, ↓ `WIN_SCORE` |
| Winners take almost nothing | Check white peace share; ↓ `WIN_SCORE`, ↑ `PEACE_EXTRA_CELLS` |
| Total chaos; nothing lasts | ↑ `STAB_RECOVERY`, ↓ `REBEL_THRESHOLD`, ↑ `DEFENDER_BONUS` |
| Map fills too fast, wars start too early | ↓ `EXPANSION_RATE`, ↓ `START_NATIONS` |
| Wars never end | ↑ `WEARINESS_GAIN`, ↓ `PEACE_SCORE`, ↓ `MAX_WAR_YEARS` |
| Wars change nothing | ↓ `SIEGE_STEPS`, ↓ `BATTLE_SCORE`, ↓ `DEFENDER_BONUS` |
| Borders ignore geography | ↑ `MOUNTAIN_COST_MULT`, ↑ desert/wetland move cost |
| Too many tiny nations | ↑ `MIN_AREA`, ↑ `REBEL_MAX_CELLS`, ↓ `EMERGENCE_PROB` |
| Map hard to read | ↓ `OVERLAY_ALPHA`, ↑ `BORDER_ALPHA`, ↑ `LABEL_MIN_AREA` |
| One race takes over most seeds | ↓ that race's `growth` or `martial` first; then ↑ `FOREIGN_K` so big multi-race empires crack |
| A race dies out early | ↑ its `defense` or its homeland affinity; check `RACE_HOMES_PER_RACE` |
| Race makes no difference | ↑ `FOREIGN_K`, ↓ `FOREIGN_FREE`; widen the trait spread a little |
| Alliances never change | ↑ `PACT_FADE`, ↑ `NEW_RULER_BREAK`, ↑ `ALLIANCE_BREAK_OPINION` |
| Allied blocs snowball | ↓ `ALLY_ATTACK_PROB`, ↓ `MAX_ALLIES` |
| Racial feuds don't show | ↑ `OPINION_WAR_K`, ↑ `WAR_OPINION_HIT` |
| Rebels are always swallowed back | ↓ `CLAIM_WAR_BONUS`, ↓ `CLAIM_YEARS`, ↑ `REBEL_START_STABILITY` |
| Rebellions start in random places | ↑ `UNREST_CONTROL_K` (check the unrest heatmap, key H) |
| No cities / cities everywhere | ↑ / ↓ `DEV_GROWTH`, ↓ / ↑ `SETTLE_CITY`, `CITY_MIN_SPACING` |
| Armies: wars end without battles | ↑ `ENGAGE_RANGE`, ↓ `ENGAGE_RATIO` |
| Armies: rebels always crushed | ↑ `REBEL_LEVY`, ↓ `REBEL_WAR_PROB` |
| Armies: one lost battle ends a nation | ↓ `BATTLE_MAX_LOSS`, ↑ `ROUT_RETURN`, ↑ `LEVY_REFILL` |
| Wars too frequent since M9 | ↓ `WAR_VALUE_K`, ↓ `CLAIM_WAR_BONUS` before touching `WAR_BASE_PROB` |

---

# Candidate parameters (not in code yet)

Ideas for future rules. When one is adopted, design it in SPEC.md, move it into the right section above, and add it to code.

| Idea | Parameter(s) | Effect |
|---|---|---|
| River crossings | `RIVER_CROSSING_PENALTY` | Attacks across rivers slower |
| Naval expansion | `NAVAL_RANGE`, `NAVAL_EXPANSION_RATE` | Coastal nations claim islands across water |
| Culture affinity | `CULTURE_REBEL_BONUS`, `CULTURE_WAR_PENALTY` | Foreign-culture provinces rebel more; kin nations fight less |
| Golden age | `GOLDEN_*`, `DECLINE_*` | Earned by long peace, ending in decline (`docs/systems/rulers.md`) |
| Plague | `PLAGUE_PROB`, `PLAGUE_DEATH_RATE`, `PLAGUE_SPREAD` | Population crashes that spread through neighbors |
| Trade | `TRADE_ROUTE_BONUS` | Connected coastal/river cells gain capacity |
| Time slowdown | `SLOWDOWN_ON_EVENTS`, `SLOWDOWN_FACTOR` | Playback slows for major wars and collapses |

### Repeatable campaign checks

Run `npm run balance -- tuning`, then `npm run balance -- validation` after choosing values. Each reports ten different fixed settled worlds, 320×180, over 500 years: war duration, attacker victories, wars, casualties, battles, territory changes, peak empires and surviving realms. These are small-map smoke measurements; use more seeds and full-size worlds before claiming small balance improvements. Compare the same seeds before and after code changes. Details and initial measurements: [simple campaigns](systems/campaigns.md).
