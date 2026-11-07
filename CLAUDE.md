# Realm Forge — Project Guide for Claude

A browser-based fantasy world simulator. It generates a continent from a seed, then simulates nations rising, fighting, rebelling and collapsing over 1,000+ years, played back as a timelapse.

**Visual target:** an old printed chart: parchment, thin clear ink outlines, hand-drawn terrain and markers, with pale nation colors. The older grand-strategy look stays available as the "Classic map".

> Keep this file up to date. When a decision changes, update the relevant doc and add a line to the **Decision log** below.

---

## 1. Reference docs

| Doc | What's in it | When to read it |
|---|---|---|
| `CLAUDE.md` (this file) | Rules, learning mode, workflow, milestones, decisions | Every session |
| [`docs/SPEC.md`](docs/SPEC.md) | How it works: architecture, data model, generation, simulation rules, rendering | **Before starting a milestone**, read the sections it touches |
| [`docs/PARAMS.md`](docs/PARAMS.md) | Every tunable number: default, range, effect of changing it, tuning recipes | When adding, changing or tuning parameters |
| `docs/GLOSSARY.md` | Plain-English definitions of coding concepts we've used | Update whenever a new concept comes up |

**Keeping docs in sync**
- SPEC.md and PARAMS.md use the **same section headings** (e.g. "War" in both).
- New parameter or changed default → update PARAMS.md in the same commit as the code.
- New system or rule → follow "Adding a new system" in SPEC.md (§9).
- If docs and code disagree, flag it to me rather than guessing.

---

## 2. Who I am and how to work with me

I'm new to coding and learning TypeScript through this project. Every session is **build + teach**.

- **Explain as you go.** After creating or changing a file, give 2–3 plain-English sentences: what it does, how it connects to other files, and one new concept it uses.
- **Readable over clever.** Clear names, short functions, a one-line comment above anything non-obvious.
- **Explain errors first.** When something breaks, say what the error means in plain words, then fix it.
- **One small exercise per milestone.** Something safe for me to change myself (often a parameter from PARAMS.md), what should happen, and how to undo it. Review my change afterwards.
- **Keep a glossary.** Add each new concept to `docs/GLOSSARY.md` with a 1–2 line definition and where it appears in our code.
- **Keep it short.** I'll ask if I want more detail.

---

## 3. What we're building

**Goals**
- Generate a believable fantasy continent from a seed.
- Simulate nations year by year: expansion, war, peace, rebellion, collapse, new states.
- Show it as a good-looking map with play / pause / speed controls, a year counter and an event log.
- Same seed + same settings = same history (in the same browser).

**Not now:** player control (planned for M20; M15–M19 prepare for it), economy, trade, multiplayer, servers or accounts. (Ideas are parked in SPEC.md §8 and PARAMS.md "Candidate parameters".)

---

## 4. Tech stack

| What | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Dev server / build | Vite |
| Drawing | Canvas 2D |
| Terrain noise | `simplex-noise` |
| Map cells | `d3-delaunay` (Voronoi) |
| Randomness | Our own seeded random number generator. **Never use `Math.random()`.** |
| Tests | Vitest |

Pin exact versions in `package.json` (no `^` or `~`).

---

## 5. Key rules

- `gen/` and `sim/` never touch the screen (no DOM or Canvas code). They only work with data.
- `render/` only reads the world. It never changes it.
- All randomness comes from one seeded generator, split into named streams (e.g. `rng.fork("war")`).
- **No magic numbers.** Tunable values live only in `gen/params.ts`, `sim/params.ts` or `render/palette.ts`, and are documented in PARAMS.md.
- **The core loop to protect:** grow → get too big → become unstable → break apart. If history looks frozen or chaotic, check the tuning recipes in PARAMS.md first.

Full folder layout and design are in SPEC.md §1.

---

## 6. Milestones

Work one at a time. At the end of each: run tests, take a screenshot, give me my exercise, and update the Decision log.

| # | Milestone | Done when | SPEC sections |
|---|---|---|---|
| M0 ✅ | Setup | Vite + TypeScript + Vitest run; seeded random generator has a test proving same seed = same numbers | §1, §7 |
| M1 ✅ | Terrain | Seeded map with hillshading and water shows on screen and looks good | §3.1–3.2, §5.1 |
| M2 ✅ | Cells & biomes | Cells with climate, biomes and rivers; debug view of cells | §3.3–3.7 |
| M3 ✅ | Starting nations | Capitals and starting borders drawn with colors, borders and names | §3.8–3.9, §5.2–5.4 |
| M4a ✅ | Growth | Population and expansion work; nations spread across the map | §4.1–4.4 |
| M4b ✅ | Instability | Stability, rebellion, collapse and emergence; empires break apart; event log | §4.3, §4.6–4.9, §6 |
| M5 ✅ | War | Wars start, play out and end; a 1,000-year run tells a believable story | §4.5 |
| M6 ✅ | Polish | Speed controls, settings panel, video export, save/load. Web Worker only if needed. | §5.5, §6 |
| M7 ✅ | Races | Five races (Humans, Light Elves, Dark Elves, Dwarves, Orcs) live in cells and rule nations; traits change growth, war, stability and rebellion; ethnic rebellions happen; Races map layer; no race takes over most of 10 test seeds | §2, §3.8–3.9, §4.1–4.10, §5.4b, §6 |
| M8 ✅ | Diplomacy | Opinion between nations from race attitudes, borders, wars and shared enemies; alliances form and break; bordering allies join defensive and offensive wars; Alliances map layer; race balance still holds | §2, §4.5, §4.6, §4.12, §5.4c, §6 |
| M9 ✅ | Land and cell detail | Cells hold resources, unrest, devastation, development, settlements and ownership history; control replaces capital distance; rebellions start where unrest is high; wars fought over resources and claims; cities grow; 10-seed balance check still passes | §2, §3.7b, §4.1–4.9, §4.11, §5.4d–f, §6 |
| M10 ✅ | War and unrest effects | Animated layer (key E): sliding hatch on war fronts, battle flashes with crossed swords, smoke over devastated land, embers in realms close to rebellion, rings when nations rise or fall; history unchanged with effects on or off | §5.4g |
| M11 ✅ | Armies | Nations have a soldier reserve that refills slowly; one army per side per war marches across the map (4 seasons a year), fights battles and besieges towns; occupied land changes hands at peace by war goal (reclaim, conquer, raid); rebels raise armies; Armies layer (key W); tick < 10 ms; 10-seed balance check still passes | §4.5, §4.13, §5.4h, §6 |
| M12 ✅ | Culture and faith | Cells hold a culture (inside a race) and a faith (across races); both spread by neighbor rule; conquered people assimilate; rebels are one culture and dead realms return; nine faiths with reach, fervor and a blessing; realms can convert; Cultures and Faiths layers; checks in SPEC §4.14 pass on unseen seeds | §2, §4.14, §5.4i, §6 |
| M13 ✅ | Rulers and dynasties | Every nation has a named ruler and dynasty; five types of great ruler, with each race leaning toward one; titles with female variants; succession crises and civil wars, worst after a great ruler; crowns on the map; checks in `docs/systems/rulers.md` measured on unseen seeds | §4.15, `docs/systems/rulers.md` |
| M14 ✅ | Parchment map | Default old-chart style: paper, ink outlines, terrain symbols, compass, frame and title panel; capitals, cities, resources, armies and effects drawn to match; history unchanged | §5.1b |
| M15 ✅ | Controllers | Every nation choice goes through a controller and comes back as a command the rules apply; history identical through step 4; per-decision dice in step 5 with balance numbers within noise; tick ≤ 10% slower | §4.16, `docs/systems/controllers.md` |
| M16 ✅ | War Room | Every war keeps a saved record; side panel with Wars, Past wars and Log; following a war dims the rest, marks goal and occupied land, slows time and pauses on routs, fallen capitals and the end; war report; one log line per year's battles; honest "no land changes hands" peace text | §5.4j, `docs/systems/warroom.md` |
| M16b ✅ | Settled start | Pick Open land or 5–10 old kingdoms at the start; kingdoms share all reachable land with subject peoples, core land, towns and cities; open start and golden history unchanged | §3.8b, `docs/systems/start.md` |
| M17 ✅ | Sandbox | God commands start and end wars; command log in saves (replay gives the same history); odds from 20 futures for a war and a nation; Sandbox tab | `docs/systems/sandbox.md` |
| M18 ✅ | Real war | Nations go to war on estimates (race confidence, ruler boldness, yearly error); defenders who hold out can win; generals lead armies; a losing side can sue for peace; tuned with sandbox odds | `docs/systems/realwar.md` |
| M19 ✅ | Map zoom | Zoom (up to 4×) and pan the map, redrawn sharp when it settles; labels, markers and effects included; following a war zooms to it | §5.4l |
| M20 | Play as a nation (planned) | Pick a race and nation, play 1,000 years with orders and standing policies, paused on what matters; when your realm falls you choose a realm of your people to carry on as | `docs/systems/play.md` |
| Later | Backlog | See SPEC.md §8 | §8 |

---

## 7. Environment and workflow

- **Play it:** https://frozenheat23.github.io/Realm_Forge/. Every push to `main` tests, builds and publishes the game (`.github/workflows/publish.yml`). If a test fails, the live site stays as it was.
- **Two PCs**, synced through a public GitHub repo (my personal account, not work). Never commit anything private.
- **Start of session:** `git pull`. **End of session:** commit and push. Nothing unpushed is safe.
- **Work PC (Windows, managed):**
  - Do **not** change PowerShell execution policy or any system or security settings.
  - Run commands in Command Prompt (`cmd`). In PowerShell, use `npm.cmd` / `npx.cmd`.
  - Don't install global tools or anything needing admin rights without asking me.
- **Cloud sessions** (e.g. Codespaces) are fine. Same rule: push before closing.
- Commit after each milestone or meaningful step, with a clear message.

---

## Decision log

| Date | Decision |
|---|---|
| 2026-10-28 | Build our own generator and renderer for a game-like look; Azgaar only as a future import option |
| 2026-10-28 | Browser + TypeScript + Canvas 2D; seeded random generator for repeatable results |
| 2026-10-28 | Stay in TypeScript as a beginner; learning mode on; possible Rust port of `sim/` after M5 |
| 2026-10-28 | Private GitHub repo `Realm_Forge` to sync two PCs and cloud sessions |
| 2026-10-28 | Sim runs on the main thread until M6; move to a Web Worker only if needed (simpler for learning) |
| 2026-10-28 | Split old M4 into M4a (growth) and M4b (instability) |
| 2026-10-28 | Determinism guaranteed within the same browser only |
| 2026-10-28 | Docs split into CLAUDE.md (rules), docs/SPEC.md (design) and docs/PARAMS.md (tuning guide) with mirrored headings; original spec retired |
| 2026-10-28 | Generation params in `gen/params.ts`, sim params in `sim/params.ts`, visuals in `render/palette.ts` |
| 2026-10-28 | Defined war resolution (front cells, flips per year, defender bonus), truces, and capital-loss handling |
| 2026-10-28 | M1 terrain look = "painted strategy" (Fantasy Map Simulator's green/tan style, a bit richer). Parchment can be a palette preset later |
| 2026-10-28 | Heightmap: domain warp bends only the 3 biggest octaves (warping fine detail made streaks); detail grows with elevation so plains stay smooth; ridged noise adds mountain ranges |
| 2026-10-28 | `?seed=...` in the page URL picks the world |
| 2026-10-28 | Switched default terrain to **cel-shaded illustration** (flat bands, 3-tone shading, ink coast, ripple lines) so kingdoms stay readable; painted kept as `?style=painted` |
| 2026-10-28 | M2: elevation thresholds (`MOUNTAIN_H`, `RIVER_SOURCE_MIN_H`) are now *land elevation* (0 = coast, 1 = peak) so they mean the same on every seed |
| 2026-10-28 | Rivers use priority-flood drainage + random sources (`RIVER_SOURCE_PROB`); cells gain `elevation`, `downstream`, `riverFlow` |
| 2026-10-28 | Milder climate defaults (`POLE_TEMP` −6) because one continent spans almost pole to pole; biome edges wobble so cells don't look polygonal |
| 2026-10-28 | M3: `START_CORE_SIZE` 5 → 12 and `LABEL_MIN_AREA` 15 → 10, so starting nations are visible and named at year 0 |
| 2026-10-28 | `generateWorld()` returns `{ world, state }`: the fixed map plus the year-0 `WorldState` the sim will advance |
| 2026-10-28 | Nation names: order-2 Markov chain over 4 invented culture lists; culture picked by nearest random home point |
| 2026-10-28 | `OVERLAY_ALPHA` 0.5 and more vivid nation colors so kingdoms read over colorful biomes |
| 2026-10-28 | M4a: `tick()` changes the state in place and returns the year's events (simpler and faster than copying) |
| 2026-10-28 | New cells start at `NEW_CELL_POP_FRACTION` of capacity (logistic growth can't start from 0) |
| 2026-10-28 | `WorldState` stores `cultureHomes` and `colorHue` so nations born mid-game get fitting names and colors |
| 2026-10-28 | Nation overlay writes whole pixels via a `Uint32Array` view; labels skip when they'd overlap a bigger one |
| 2026-10-28 | M4b: `REBEL_MIN_CAPITAL_DIST` 10 → 5. With our ~12 px cells a 160-cell empire is only ~7 steps across, so at 10 big empires could never rebel |
| 2026-10-28 | Known: without war, history freezes ~year 300 once every nation is ≤ `ADMIN_CAP_BASE` and the land is full. M5 (war) is expected to fix this; retune then |
| 2026-10-28 | Collapse hands cells out using a pre-collapse snapshot (order-independent, no chaining) |
| 2026-10-28 | Later idea: pick nation colors that avoid neighbors' colors (with ~75 nations some neighbors look alike) |
| 2026-10-29 | M5: war added per SPEC §4.5. History no longer freezes: ~100–120 wars, ~20–30 rebellions per century; 55–75 nations alive; biggest ~150–180 cells |
| 2026-10-29 | `WAR_MAX_PROB` cap on declaring war (ratio^exp had no ceiling); capitals are taken last on a front (capital losses fell from ~100 to ~12 per century) |
| 2026-10-29 | Tuning still open: no great empires form (biggest ~180 cells). Try ↑ `ADMIN_CAP_BASE` or ↓ `DEFENDER_BONUS` during "further testing" |
| 2026-10-29 | M6: sim params are one mutable `SIM` object (with `SIM_DEFAULTS`) so the Settings panel edits them live |
| 2026-10-29 | Save = JSON snapshot without the map (rebuilt from seed); Load passes the file through `sessionStorage` and reloads with that seed |
| 2026-10-29 | Year counter drawn on the canvas so videos include it; no Web Worker (tick ~4 ms) |
| 2026-10-29 | Not done in M6: label fade in/out, neighbor-aware nation colors, hatching on war fronts |
| 2026-10-29 | Next direction: deeper civilization sim. Order: M7 Races → M8 Diplomacy → armies & war goals → economy & eras |
| 2026-10-29 | M7 design: 5 races (Humans, Light Elves, Dark Elves, Dwarves, Orcs). Orcs are one race using Green Orc values; Red Orcs parked in backlog. No Halflings |
| 2026-10-29 | Race traits are multipliers on existing params with Humans = 1.0, so a human-only world matches pre-M7 behavior. Table `RACES` lives in `gen/params.ts` (like `BIOME_STATS`: generation needs it and `gen/` can't import `sim/`); lookups in `gen/races.ts` |
| 2026-10-29 | Cell people supply growth/capacity/martial/defense/unrest; the ruling race supplies aggression/endurance/cohesion/tolerance/terrain cost |
| 2026-10-29 | A cell's race only changes when an empty cell is settled or a cell is left empty; conquest keeps the people. Cultural blending is a later milestone |
| 2026-10-29 | Race attitudes are stored in M7 but only used from M8 diplomacy |
| 2026-10-29 | M7 built. Humans got no grassland bonus after all (it broke the "Humans = old behavior" promise). Homelands weighted by `capacity × affinity ^ RACE_HOME_FOCUS` (3) |
| 2026-10-29 | Save format v2 (adds per-cell race and race homelands); v1 saves are refused with a message |
| 2026-10-29 | Balance check (`RACE_BALANCE=1`, 10 seeds × 1,000 years): biggest race share 41%, no takeovers. Orcs and Light Elves tend to come out on top; Dark Elves smallest (8–27%) |
| 2026-10-29 | M9 designed (SPEC §4.11, design only): cells store causes (unrest, devastation, development, settlement, ownedSince, prevOwner, resource), chances are calculated each year. Six light resources (access-based bonuses, capped; no stockpiles or trade, which stay in the economy milestone). `control` replaces capital-distance penalty. Order vs M8 still open |
| 2026-10-29 | M8 built before M9. Diplomacy = one shared opinion per pair (−1..1) drifting toward race attitude − border friction − war + shared enemy; new tick step 4b (SPEC §4.12) |
| 2026-10-29 | Alliances are defensive **and** offensive (user's choice); only allies bordering the enemy fight, each in its own `War` linked by `joined`, ending with the main war. Allies' expected strength counts when deciding to attack (deterrence) |
| 2026-10-29 | Alliances shown as dashed lines between capitals (key A); hover lists allies and worst rival |
| 2026-10-29 | Tuning: dropped an "allied" opinion bonus (alliances never broke); `OPINION_DRIFT` 0.03 → 0.05 and `SHARED_ENEMY_BONUS` 0.3 → 0.5 so wartime coalitions can form within one war. Result: ~4–8 alliances and ~5–12 allies joining wars per century; kin pacts (Light Elves, Dwarves, Humans) last centuries. Balance check: biggest race 40%, no takeovers |
| 2026-10-29 | Save format v3 (opinions, alliances); M9 plan moves to v4. `pairKey` / `neighborPairs` moved to `sim/helpers.ts` (still re-exported from `war.ts`) |
| 2026-10-29 | M9 built in the 5 planned sub-steps, one commit each. §4.11 stays as the full system description (like §4.10 Races) instead of being split up; each step's section says what changed |
| 2026-10-29 | M9: land updates (unrest, devastation, development, settlements) run right after Totals (`sim/land.ts`), not in Population, because they need this year's control. Every owner change goes through `setOwner` (records `prevOwner`, `ownedSince`) |
| 2026-10-29 | M9 changes from the design guesses: `UNREST_CONTROL_K` 0.02 → 0.05 (at 0.02 weak control could never beat `UNREST_DECAY`); `SETTLE_THRESHOLDS` split into `SETTLE_VILLAGE/TOWN/CITY` (Settings panel only edits single numbers); new `HILL_H` 0.4 and `HIGH_MOUNTAIN_H` 0.8 for iron and mithril; province seeds √`PROVINCE_SIZE` steps apart (measured) |
| 2026-10-29 | M9 extras: rebels' unrest resets to 0 and their capital is their biggest settlement; rebel land gives the old nation a claim (reconquest wars); war events say why ("to reclaim its lost lands", ", coveting its iron"); peace names a captured resource |
| 2026-10-29 | M9 tuning: war motives raised wars to ~70–110/century, so `WAR_VALUE_K` 1.0 → 0.5 and `WAR_BASE_PROB` 0.004 → 0.003 (back to ~60–85). Balance check: biggest race 41%, no takeovers. ~1/3 of wars are claim wars; 40–55 cities by year 1000 |
| 2026-10-29 | M9 performance: tick went 4.8 → 18 ms; fixed with one-pass war fronts, per-pass grain lookup tables and no per-cell allocations → ~5.5 ms. Keys: H heatmaps, M resources, T towns |
| 2026-10-29 | M10 war and unrest effects (SPEC §5.4g): the renderer works out battles by comparing last year's owners with this year's, so `sim/` is untouched and history is identical with effects on or off |
| 2026-10-29 | Drawing split in two: the still map goes to an off-screen `base` canvas when the world changes; every screen frame copies it and draws effects on top (~3 ms). Every redraw also shows at once, without waiting for the next frame |
| 2026-10-29 | One battle marker per pair of warring nations (restarts each year) so fast playback doesn't pile up swords. Embers only in realms below `REBEL_THRESHOLD`, sparse (`EMBER_DENSITY`) |
| 2026-10-29 | Found while tuning effects: ~40% of owned land sits at unrest ≥ 0.9 by year 300 (unrest gains outpace `UNREST_DECAY`). Not changed; worth a sim tuning pass |
| 2026-10-29 | M11 = armies (before the unrest tuning pass). Design in SPEC §4.13 and PARAMS "Armies", marked planned until built. User chose armies as units that move on the map (not abstract per-front shares); navies stay in the backlog; Raid goal included |
| 2026-10-29 | M11 design: one army per side per war; `CAMPAIGN_STEPS` (4 seasons) of target → march → battle → siege inside each yearly tick; occupation ≠ ownership (cells change hands only at peace, by war goal); soldiers in `pop` units, men shown via `ARMY_MEN_PER_UNIT`; rebels raise armies and may face an independence war (`REBEL_WAR_PROB`) |
| 2026-10-29 | M11 build order, one commit each: 1 manpower → 2 armies raised and marching + Armies layer → 3 battles, sieges, occupation replace the front contest → 4 war goals and peace terms → 5 rebel armies, ally marching, battle events, tuning and balance check |
| 2026-10-29 | M11 step 1 (manpower) built. Changes from the design: the soldier cap uses `levyPop` (people × martial × **control**), and fighting power = soldiers × (0.5 + stability). A plain cap made empires snowball (18 nations left, biggest 1,344 cells). Save format v5 from this step |
| 2026-10-29 | Step 1 tuning: `WAR_BASE_PROB` 0.003 → 0.002, `WAR_STRENGTH_EXP` 1.0 → 0.7, `WEARINESS_LOSS_K` 0.5 → 0.25. Result (5 seeds): ~100 wars/century, shorter and more decisive; 49 nations alive, biggest 578 cells (before: 81, 38, 681). Race balance: biggest race 40%. `ARMY_MEN_PER_UNIT` 20,000 (display only) |
| 2026-10-30 | M11 step 2 (armies raised, reinforced, marching, disbanded; Armies layer, key W) built. Armies only hold soldiers so far: the yearly front roll still decides wars, so history is identical to step 1 (same 5-seed numbers). Tick 6.4 → 7.5 ms. Rule used for now: march to the enemy's most valuable cell within `RAID_RANGE` of the border and camp there until it falls |
| 2026-10-30 | Found in step 2: ~1/3 of war sides have no army (median reserve 9% of cap): drained by the yearly roll's losses, which are harsher than real battles will be. Recheck in step 3. Also: `soldiers()` now needs `state` because it adds up armies (a derived value, never stored) |
| 2026-10-30 | M11 step 3 built: seasons of target → march → battle → siege → attrition (`campaign`) replace the yearly front roll; land is occupied in war and only changes owner at peace (`endWars`). `FRONT_FLIPS_PER_YEAR`, `SCORE_PER_FLIP`, `WAR_ATTRITION`, `DEVASTATION_FRONT` retired. Until step 4, a winner keeps everything it occupies |
| 2026-10-30 | M11 step 3 changes from the design: target rules fall through when a target is unreachable, and an outmatched army heads home before anything else (no separate Defend rule); armies muster by searching out from the front through own land, so they don't start on cut-off patches; supply doesn't check that occupied land connects home; army power includes stability; new `UNREST_OCCUPIED` |
| 2026-10-30 | M11 step 3 tuning: `SIEGE_STEPS` 1 → 0.5, `BATTLE_SCORE` 10 → 4, `ROUT_SCORE` 10 → 6, because wars ended on battles with ~3 cells moved. Result (5 seeds): ~128 wars/century, 20% white peace, ~680 battles/century, 6.6 cells per war won, 51 nations alive, biggest 398 cells, tick 8.1 ms. Race balance: biggest race 40% |
| 2026-10-30 | Effects: battles now come from `WorldState.battles` (the M10 owner comparison is gone) and the front hatch became occupied-land stripes in the occupier's color, plus siege rings |
| 2026-10-30 | Open for step 5 tuning: at year end usually only one side has an army (armies die fast), 21% of wars end because a side died (was ~11%), ~128 wars/century is above the ~100 target, and the biggest empires are smaller than before |
| 2026-10-30 | M11 step 4 built (`sim/warGoals.ts`): each war gets a goal (conquer, reclaim, raid; joined allies `support`). Reaching the goal ends the war with the attacker winning; winners take their goal cells plus up to `PEACE_EXTRA_CELLS` touching ones; won raids take stability instead of land. Save format v6 (v5 saves from earlier M11 steps had no occupation or goals) |
| 2026-10-30 | M11 step 4 additions to the design: a separate Support target rule for allies; a defender who beats a raid still keeps what it occupies; extra cells chain, so each one taken can make the next touch; `goalAchieved` needs at least one goal cell still held, so rebels can't hand a war its win |
| 2026-10-30 | M11 step 4 tuning: `RAID_CHANCE` 0.25 → 0.15, `WAR_BASE_PROB` 0.002 → 0.0015, `PEACE_SCORE` 60 → 90. Result (5 seeds): ~106 wars/century, 11% white peace, 6 cells per war won, 66 nations alive, biggest 338 cells, tick 8.9 ms. Race balance: biggest race 40%. Fewer wars alone shrank empires and rebellions, so peace had to come later too. Still open for step 5: empires are smaller than before armies (biggest 681 before M11) |
| 2026-10-31 | M11 step 5 built, M11 done: rebellions make part of the old nation's soldiers defect, and with `REBEL_WAR_PROB` it fights at once (goal reclaim) and the rebels raise an army; allies may join if they border the enemy or the ally they help; `battle` events (log filter off by default, kept only while on, so they don't crowd out the log). Save format v7 |
| 2026-10-31 | M11 step 5 small changes: war ids now come from `nextWarId` (year-based ids could repeat once rebels started wars after peace in the same year); `ARMY_MEN_PER_UNIT` moved to `sim/params.ts` because the log needs it and `sim/` can't import `render/` |
| 2026-10-31 | Found by measuring: both sides had an army in only 15% of war-years, because a beaten army routed within a year and the reserve took decades to refill. Tuned `MORALE_LOSS` 0.35 → 0.25, `ROUT_RETURN` 0.5 → 0.75, `MIN_ARMY_SIZE` 0.05 → 0.03, `LEVY_REFILL` 0.1 → 0.15, `REBEL_LEVY` 0.15 → 0.1, `WAR_BASE_PROB` 0.0015 → 0.0014. Result (5 seeds): 26% both armed, ~113 wars/century, ~18 rebellions, 61 nations alive, biggest 341 cells, tick 9.3 ms. Race balance: biggest race 40% |
| 2026-10-31 | Open after M11: great empires are rarer than before armies (biggest 341 cells, was 681); only a quarter of war-years have both armies in the field; tick 9.3 ms is close to the 10 ms limit; the unrest tuning pass from M10 is still waiting |
| 2026-10-31 | Tuning pass. Measuring empire lifespans showed history was frozen, not just small: the same nations sat on top for 1,000 years at stability 0. Bug found (there since M7): if any far cell was foreign the revolt had to start there, so a few foreign cells too few to form a nation blocked every rebellion. Fixed: foreign cells are tried first, then everyone |
| 2026-10-31 | New rules from the tuning pass: revolt chance scales with the total unrest of a nation's land; a revolt can spread (`REBEL_SPREAD`); national crisis feeds local unrest (`UNREST_CRISIS_K`); young nations can rule more land and that vigor fades (`VIGOR_BONUS`, `VIGOR_YEARS`); conquests aim for more provinces the more one-sided they are (`CONQUEST_MAX_PROVINCES`); `WIN_SCORE` splits "who won" from `PEACE_SCORE`, whose old `/ 3` link turned won wars into white peace when raised |
| 2026-10-31 | Tried and removed: new dynasties renewing a nation's vigor after a crisis. Only ~5 per 1,000 years, barely changed results, and needed two saved fields, so it stays in the backlog. Save format stays v7 |
| 2026-10-31 | Tuning: `OVEREXT_K` 0.002 → 0.0001, `CONTROL_RANGE` 12 → 18, `PEACE_SCORE` 90 → 200, `PEACE_EXTRA_CELLS` 10 → 40, `LEVY_REFILL` 0.15 → 0.25, `WAR_BASE_PROB` 0.0014 → 0.0016. Result (5 seeds): ~9 great empires (250+ cells) per run lasting ~220 years (was ~3 lasting ~610, some 870+); peaks ~420 cells; ~98 wars/century, ~13 rebellions, 49 nations on average; unrest ≥ 0.9 on 14.5% of land (was 19.6%); both armies 30% (26%). Race balance: biggest race 40% |
| 2026-10-31 | Tick 9.3 → 7.8 ms: every rich cell blocked by a nearby city ran its own search each year; now one yearly map (`cityAreas`). Side effect: a city that shrinks keeps blocking until year end, a tiny history change |
| 2026-10-31 | User wants great empires able to reach 40–70% of the land (~4,000 cells on the map). Even extreme numbers stopped at ~15%: 30 equal powers trade single provinces. New rule: the attacker also marches on the enemy capital (`SUBJUGATE_RATIO`), and holding it at peace wins the whole nation |
| 2026-10-31 | Giants tuning: `WAR_STRENGTH_EXP` 0.7 → 1.75 (the strong pick fights, equals stay wary; the top nation was idle in only 0.34 wars), `WAR_BASE_PROB` 0.0016 → 0.0012, `WAR_MAX_PROB` 0.1 → 0.3, `VIGOR_BONUS` 5 → 80 and `VIGOR_YEARS` 200 → 250 (the cap was what stalled them near 35%), `CONTROL_RANGE` 18 → 50, `OVEREXT_K` 0.0001 → 0.00005, `PEACE_SCORE` 200 → 400, `WEARINESS_GAIN` 0.03 → 0.02, `WEARINESS_STAB_K` 0.02 → 0.01, `SIEGE_STEPS` 0.5 → 0.3, `REBEL_RESTLESS_CELLS` 40 → 200, `UNREST_CONQUEST` 0.6 → 0.2, `REBEL_THRESHOLD` 0.25 → 0.15. Extra wars per nation (`MAX_WARS_PER_NATION` 3–4) only added noise, so it stays 2 |
| 2026-10-31 | Giants result (10 seeds × 1,000 years): peaks 60, 49, 46, 44, 37, 36, 31, 29, 24, 19% of the land; 8 of 10 worlds reach 25%, 4 reach 40%; a giant stays over 25% for ~210 years (longest ~630); ~74 wars/century, ~9 rebellions, 23 nations on average; both armies 37% of war-years; tick 7.7 ms. Race balance: biggest race 42%, no takeovers. Costs: unrest ≥ 0.9 back up to 21% of land; fewer wars and nations than the ~100 / ~60 targets; a few giants last 500+ years |
| 2026-10-31 | Race start sizes: new trait `startSize` × `START_CORE_SIZE`: Humans and Dwarves 12 cells, Light Elves 21, Dark Elves 15, Orcs 9. Capitals shift up to `START_HOME_RANGE` steps toward land their race likes, and first land is claimed cheapest-terrain-first, so elves start in forest. Elves at 30 and Orcs at 8 tested no better than this |
| 2026-10-31 | Correction: the giants result above was overfitted. It was tuned on the same 10 seeds it was measured on; on 20 fresh seeds those settings reached 40% in only 5% of worlds. From now on: tune on one set of seeds and report numbers from a set never tuned on. Any small change reshuffles every history, so 5–10 seeds can't separate settings |
| 2026-10-31 | Retune: `WAR_STRENGTH_EXP` 1.75 → 2.25, `WAR_BASE_PROB` 0.0012 → 0.001, `VIGOR_BONUS` 80 → 120, `OVEREXT_K` 0.00005 → 0.00003, `REBEL_RESTLESS_CELLS` 200 → 300. Held-out result (20 unseen seeds × 1,000 years): average peak 33% of the land, 75% of worlds reach 25%, 15% reach 40%, 5% reach 50%; a giant stays over 25% for ~270 years; ~77 wars/century, ~7 rebellions, 20 nations on average; tick 8.4 ms |
| 2026-10-31 | Still open (written before the giants work, later figures above): after the early empires fall (~year 500) later ones peak lower (~250 cells), because old mid-size nations settle comfortably just above their cap. Biggest ever is ~420, below the 681 before armies. Also seen: a nation whose capital ends up cut off from its main land keeps 0.2 control for centuries |
| 2026-10-31 | M12 = culture and faith, planned by two debating agents plus user edits. Core rule: culture stays inside a race, faith crosses races. Design in SPEC §4.14, marked planned until built. Nine named faiths (Reach, Fervor, Blessing). Old Gods are the underground cult that can spark anywhere; Dark Elves have one faith (the Hollow Mother) |
| 2026-10-31 | M12 build order, one commit each: 1 culture tags and layer (no history change, save v8) → 2 assimilation and new cultures → 3 culture-line revolts, realms reborn, retune → 4 faith tags, spreading, layer → 5 faith unrest, opinion, realm conversion → 6 blessings, race numbers, full check |
| 2026-10-31 | M12 cuts: schisms, holy wars, holy cities, morale bonus, claims by culture, registries of cultures or faiths' state. A culture's name and color are its founding nation's. A revolt of a culture some living nation already rules makes a sister state with a fresh name, rather than joining it (simpler; nothing to merge) |
| 2026-10-31 | M12 step 1 built: cells and nations hold a culture, Cultures layer (key K), save format v8. Nothing reads it yet, so history is unchanged (same event hash over 400 years) |
| 2026-11-01 | M12 steps 2–3 built: assimilation (`sim/culture.ts`), `UNREST_KIN_K`, revolts along culture lines, dead realms return. Measured on 20 tuning seeds: 19 realms reborn per run; rebellions 5.7/century (was 5.4), peak 31% (was 31%), tick 7.5 ms (was 7.3), so no retuning needed |
| 2026-11-01 | M12 steps 4–5 built together: nine faiths, `sim/faith.ts`, Faiths layer (key F), `faith` events, `UNREST_FAITH_K`, opinion, realm conversion. The conversion test was changed: a rival must be a realm's biggest faith and hold `FAITH_MAJORITY` (0.35), because almost no realm ever went past 50% against its own rulers |
| 2026-11-01 | M12 step 6: `blessing(nation, faith)` in `gen/faiths.ts`. Whispers changed from "land at war with an Old Gods realm" (almost never happened) to "land next to a hidden shrine". Order 1.3 → 1.1 after leave-one-out runs showed it alone cut rebellions by a quarter |
| 2026-11-01 | M12 done. On 20 unseen seeds, against the same seeds before M12: 17 realms reborn and 4.8 realm conversions per run; rebellions 4.5/century (4.6), wars 56 (54), peak empire 31% (30%), 65% of worlds reach 25% (60%), tick 8.3 ms (6.9). Race balance: biggest race 42%. Conversions missed the ≥ 10 target but stay; SPEC §4.14 says why |
| 2026-11-01 | Guardrails from earlier runs (7 rebellions, 33% peak) were one seed set's numbers. Always compare old and new code on the same seeds: seed sets differ by more than most changes |
| 2026-11-01 | M13 = rulers and dynasties, designed in `docs/systems/rulers.md` (planned until built), the first system with its own file, since SPEC.md is past the ~700-line limit. Great rulers are five shared types and each race leans toward one (user's choice: orcs make great warlords more often, dwarves great builders). Gender changes titles and names only; Humans and both elf races have female variants. Plague and famine stay in the backlog; golden ages stay in M13 and must end in decline |
| 2026-11-01 | Measured in the browser (M1 Pro, year 300–600): tick 4.7 ms, nation overlay 16.5 ms, effects refresh 3.5 ms, each new year's frame ~44 ms in all. The sim is only about a tenth of a frame, so playback stutter comes from drawing. A Rust port of `sim/` wouldn't fix it. Overlay is over its 8 ms budget (SPEC §5.5) |
| 2026-11-01 | Golden ages left out of M13 for now (user's choice); the design stays in `docs/systems/rulers.md`, and they're back in the backlog |
| 2026-11-01 | M13 built in 4 steps, one commit each. Step 1 changed no history (same event hash). Changes from the design: crisis chance uses `1 + area / CRISIS_AREA`, not distance over `adminCap` (young nations' caps are too large for anyone to be over); great chance also grows with size (`GREAT_AREA`), or great rulers rarely sat on giants' thrones; founders and year-0 rulers are always ordinary |
| 2026-11-01 | M13 tuning: `CRISIS_BASE` 0.05 → 0.01 (53 civil wars a run, peak 21%), `CIVIL_WAR_MIN_AREA` 40 → 100, `CRISIS_AREA` 400, `CRISIS_GREAT` 4 → 3, `GREAT_CONQUEROR_POWER` 1.25 → 1.5, `GREAT_CONQUEROR_WAR` 1.5 → 2. A Conqueror rule for going after capitals was tried and removed: `SUBJUGATE_RATIO` is already 1, so it did nothing |
| 2026-11-01 | M13 done. On 20 unseen seeds, against the same seeds before: 69 great rulers and 10.9 civil wars per run; rebellions 5.5/century (4.0), wars 66 (55), reborn realms 25 (13), conversions 5.8 (3.8), peak empire 27% (28%), worlds reaching 40% still 5%, tick 8.6 ms (8.3), biggest race 41%. Missed: no more giants, a giant's time over 25% fell from ~200 to ~130 years, about 1 in 5 giants' falls follow a great ruler's death (target 1 in 3), rebellions +37%. Even power × 2 didn't make giants: reigns are too short. Prophets showed no measured rise in conversions |
| 2026-11-01 | Playback: the overlay and the occupied mask now repaint only changed cells, using a per-cell pixel list (`groupPixelsByCell`). Overlay 16.5 → 1.4 ms, effects 3.5 → 0.2 ms, a new-year frame ~44 → ~21 ms. New top speed 100×. Art and appearance polish comes later (user's plan) |
| 2026-11-01 | CLAUDE.md "Not now" still listed religion after M12 built faith; removed |
| 2026-11-01 | Parchment map (`?style=atlas`) built from mockups: the user picked parchment over stained glass, woodblock and board game, wanting thin clear outlines, and the "Balanced" version of four. Kept optional, with a toolbar button, and the default stays cel-shaded until the user has played it. If it becomes the default, change the "Not a flat atlas look" visual target above |
| 2026-11-01 | `MapLook` (`render/palette.ts`) carries a style's choices into the shared overlay, labels and settlements. Rivers and symbols sit on a layer above nation colors. Title panel replaces the year counter on this style. IM Fell fonts bundled through Fontsource (OFL), credited in the README. Sea names and a scale bar left out; seas have no names yet |
| 2026-11-01 | Parchment is now the default (user's choice), which replaces the grand-strategy visual target above; `?style=cel` or the Classic map button gives the old look. Markers redrawn to match (`render/atlasMarkers.ts`): castles flying the realm's color on capitals, spires on cities, ink icons on resources, sepia-leaning armies and effects, ink alliance lines. Towns stay hidden, as in the Balanced mockup |
| 2026-11-01 | "Easier to play" meant easier to open, not faster, so no Rust. Repo made public (user's choice, Gmail left visible in old commits) and the game hosted on GitHub Pages, published on every push to `main` once tests pass. Vite `base` is `./` so it works from `/Realm_Forge/` |
| 2026-11-02 | Review after M14 (5 seeds × 1,000 years): ~35 wars a century, ~2 at a time, median 4 years, attacker wins 77%, 83% of log events are battles, 7% of wars end "taking 0 provinces". Good history generator, thin war simulator: wars are short, predictable and can't be followed or steered |
| 2026-11-02 | Direction: focus on the simulator now, with playing one nation through 1,000 years later. Roadmap M15 Controllers → M16 War Room → M17 Sandbox → M18 Real war → M19 Play as a nation |
| 2026-11-02 | Agreed principles for player-ready design (`docs/systems/controllers.md`): every nation choice goes through a controller; choices become commands (history = seed + non-AI commands); only rules change the world; strategic decisions only; same rules and information for player and AI; the player plays a people, not just a state (half of starting nations die by year 1000, but 71% still have their culture ruling somewhere) |
| 2026-11-02 | M15 specced first, as a pure refactor: history identical through step 4 (checked against a golden fingerprint recorded before the refactor), then per-decision dice in step 5 so one nation's choice can't shift another's rolls |
| 2026-11-02 | M15 built. Ten nation choices go through `Controller` (`sim/ai/controller.ts`); the AI (`sim/ai/default.ts`) is the old logic, moved. Each rule file applies and validates its own commands; `applyCommand` (`sim/commands.ts`) is the door for outside callers. Golden history identical through step 4 |
| 2026-11-02 | M15 departures from the spec: `mobilize` returns soldiers per war (not a share); alliances are propose + accept; peace is a yes/no inside step 6b with no command (terms need the year's final score); controllers are a required parameter of the rule steps (tick defaults to the AI) so rule files never import the AI; map queries moved to `sim/marching.ts`, `frontCells` to `helpers.ts`, `warChance` and `chooseGoal` to the AI |
| 2026-11-02 | M15 step 5: war, join, alliance and faith choices roll from their own named streams. History changed once (golden re-recorded). Numbers within noise: on one set of 5 seeds wars/century went 26.7 → 36.7, but renaming the old code's stream alone gave 36–38, so 5-seed averages swing ~±10 from chaos, not from changed odds. Rule dice (battles, expansion, culture/faith spread) still share streams; isolate them in M17 if sandbox odds need it |
| 2026-11-02 | M16 War Room, decided with the user: war history kept by the simulation and saved (save v10), not collected by the screen; zoom left for its own milestone (M19, before playing becomes M20); following slows to `FOLLOW_SPEED` and pauses on routs, fallen capitals and the war's end; side panel with tabs beside the map on wide screens. Past wars list added (sortable) |
| 2026-11-02 | M16 built. Records are written by the rules (`sim/warRecords.ts`) and never read by them, so history is unchanged (golden test passed); the golden fingerprints were re-recorded once for the new peace text "X defeats Y, but no land changes hands" (it was "taking 0 provinces"). Battles in the log fold to one line per pair per year |
| 2026-11-02 | Settled start (M16b), decided with the user: history opens on 5–10 old kingdoms (default 10, picked in the toolbar, `?start=`) sharing all the land, one per race at least; old realms (core land, towns and cities, settled people, low unrest); mixed peoples by homeland, so subject peoples exist from year 0; the old open start kept as an option. `createWorld` (`sim/start.ts`) wraps `generateWorld`, so the open start and the golden history are untouched |
| 2026-11-02 | Settled start as built: race terrain costs made Dwarf realms sweep the mountains and left some kingdoms 1–76 cells, so borders grow by plain travel cost, one cell per kingdom per round; homelands chosen farthest-first; capitals spaced (`KINGDOM_SPACING`), off small islands (`KINGDOM_MIN_LAND`) and toward open country (`KINGDOM_ROOM`). Measured (5 seeds × 1,000 years): first breakup median year 238, 8 of 50 never break; 3–6 of 10 kingdoms alive at 1000; wars 87–129/century (open start 44–86); biggest race 46%, no takeovers |
| 2026-11-01 | Ruler portraits: half-body crop, shortlist of painted and Octopath-style pixel art (user's choice; bold ink dropped). Reusable prompts for other image services are in `docs/art/portrait-prompts.md` |
| 2026-11-04 | Ruler card (SPEC §5.4k, key P): hover a nation to see its ruler; a great ruler's rise holds the card up 5 s. Placeholder set = 48 Octopath-style portraits (5 races × 2 genders × ordinary + 5 great types; Orcs and Dwarves men only), parchment frames to match the map, untinted, with only the wax seal in the nation's color and the name in black ink (user's choice over grey metal and forged steel). Drafts in `assets/` stay out of git (public repo, ~100 MB); `scripts/portraits.py` makes the small WebP files in `public/` |
| 2026-11-04 | CI publish kept failing with Vitest's "Timeout calling onTaskUpdate" although every test passed: 1,000-year test runs blocked their worker for up to a minute. Long runs now go through `runYears()` (`tests/longRun.ts`), which pauses every 50 years; history unchanged (golden test passes) |
| 2026-11-06 | Civil wars fixed: pretenders rise only from the ruling people (`UprisingKind` "pretender" in `sim/rebellion.ts`) and keep its culture, as sister states with a new name and dynasty; subject peoples rise only by the revolt rule. Found by measuring: before, 71–79% of pretenders were another race. Same 10 worlds, old → new: pretenders of the rulers' race 99%, rebellions and wars within noise. Golden history re-recorded. Also fixed "Not now", which still said player control was M19 |
| 2026-11-06 | Alliances can end while both allies live (user's choice of two ideas): a pact fades the longer it goes without a shared war (`PACT_FADE`, renewed by fighting together, stored as `Alliance.renewed`; old saves load with `since`), and a ruler crowned last year may break it (`NEW_RULER_BREAK`, × `GREAT_SCHEMER_BREAK` for Schemers). New race trait `fickleness` scales both: Dwarves 0.5, Light Elves 0.6, Humans 1, Orcs 1.5, Dark Elves 1.6. A plain decay on opinion was ruled out: opinion always drifts back to its resting point. A broken pact drops the pair's opinion to `PACT_BROKEN_OPINION` (0), added after a pact broken by a new king was sworn again the next year. Tuned on 6 worlds, checked on 10 unseen worlds per start, old → new: broken while both alive 4% → 37% (settled) and 7% → 53% (open); median pact 115 → 78 and 136 → 81 years; re-allied within 10 years of a break 0–1 per 10 worlds; allies joining wars 26 → 22 and 26 → 20 a century; wars, rebellions and peak empire within noise. Golden history re-recorded |
| 2026-11-06 | M17 Sandbox, decided with the user: wars first as god powers (start a war, end one with a winner or white peace), odds for one war and one nation. God commands go through the rules like nation commands, are logged with their year and saved (save v11, v10 loads with an empty log); replaying the log gives the same history (tested). Golden history unchanged |
| 2026-11-06 | M17 built in 4 steps. Odds run futures from a copy of a save; future 0 uses the real dice, the others `"<seed>/future-k"`. Rule dice stay on shared streams: each future is meant to roll everything differently. 20 futures × 50 years take ~11 s in Node and ~30 s in the browser; no Web Worker for now |
| 2026-11-06 | First odds (5 real wars, unseen seeds): 4 of 5 ended the same way in all 20 futures, even 425 vs 457 cells, because defenders start wars with almost no reserve. Wars are decided at declaration: the main target for M18 |
| 2026-11-07 | M18 part 1, misjudgment (user's idea: nations aren't that calculated and information is never perfect). War is weighed on an estimate: true ratio × race `confidence` × ruler `boldness` (rolled at coronation from race `temper`) × a yearly error (`INTEL_ERROR` 0.7, × `INTEL_FOREIGN` against another race). Only the decision is fooled. Appetite stays `aggression`. User's race picks: Orcs most confident, Dark Elves bold and erratic, Humans' rulers vary most (some warmongers), elves and Dwarves steady. Save v12 |
| 2026-11-07 | Part 1 result (3 sets of 10 seeds): weak or even attackers 1% → 5% of wars, and they now lose about half; but 82% of wars are 3×+ against weaker realms, so attackers still win 95% of decided wars (97%). Wars +20–25% a century (new pairings; `WAR_BASE_PROB` doesn't move it). One world in 30 had Humans at 68% of the land; other sets show no human edge. Next: part 2, underdog defense (a defender who holds out should be able to win) |
| 2026-11-07 | M18 part 2, underdog defense. Measuring showed 95% of wars end by exhaustion, usually the defender's, and a defender could only score by battles and occupation. Four rules: each year the attacker holds nothing it came for gives the defender `HOLD_SCORE` (10); a nation only defending tires at `DEFEND_WEARINESS` (0.25) the rate; defenders refill soldiers `RALLY_REFILL` (2) times as fast; a beaten attacker pays tribute ("X drives off Y"). `War.heldOff` is optional, so the save format stays v12. Golden history re-recorded |
| 2026-11-07 | Part 2 result (2 unseen sets of 10 seeds, part 1 → part 2): attackers win 94% → 80% of decided wars (target 55–75% missed: 7 wars in 10 are still 3×+ mismatches); defenders win 3–4% → 14% of all wars; white peace 40% → 26%; wars 103 → 70 a century (longer wars, so fewer start); peak empire −2 points; rebellions and race balance within noise; tick +4% |
| 2026-11-07 | M18 part 3, decided with the user: generals and peace offers (fear coalitions and army stances left out). Every army has a general (skill, victories, death in defeat, the realm's marshal leads its next war, famous at `GENERAL_FAMOUS` wins); a side losing by `WIN_SCORE`+ may sue for peace (`suePeace` command, controller choices `suePeace` and `acceptTerms`), giving only the goal land the winner holds. Both new fields are optional, so saves stay v12. Also fixed: the log's Rulers filter never hid anything (its CSS rule was missing) |
| 2026-11-07 | Part 3 result (same unseen seeds, part 2 → part 3): attacker wins unchanged at 80% of decided wars; 18% of wars end on terms; wars 70 → 74 a century; ~17 famous generals a century; Sandbox odds split in 3 of 4 real wars; tick +6%. M18 done; the 55–75% attacker-win target was not reached, since who picks fights is unchanged (fear coalitions would be the next lever) |
| 2026-11-07 | M19 map zoom, decided with the user: redrawn sharp (not a stretched picture), up to 4×. While moving, the whole-map pictures are stretched; 150 ms after it stops, the view is redrawn at screen size from the map data (cells from their true centres, coasts from blended heights), about 0.4 s. Lines, markers and text are drawn through a canvas transform; markers, names and terrain symbols grow only as zoom^0.5 (`MARK_ZOOM_GROWTH`), since growing with the map made 4× mountains swamp the view. Following a war zooms to its capitals. The classic maps' terrain and the occupied-land stripes are stretched, not redrawn. History unchanged |
| 2026-11-07 | M20 planned with the user (`docs/systems/play.md`): orders while paused plus standing policies for mid-year questions (a year can't stop to wait for a click); strategy only, armies march on their own; when your realm falls you choose which realm of your people to follow; no score |
| 2026-11-07 | M20 step 1 built: the player's controller (`sim/ai/player.ts`) answers by policies with no dice and never declares war, proposes alliances, breaks pacts or converts by itself; orders (`sim/play.ts`) go through `giveCommand` and the command log (`by: "player"`); `WorldState.player` saved in save format v13. `tick` now defaults to `controllersOf(state)`, which is the AI for everyone when no one plays, so the golden history is unchanged. New `PLAYER_WEARY` (0.6) |
