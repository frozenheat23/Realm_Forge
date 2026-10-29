# Realm Forge — Project Guide for Claude

A browser-based fantasy world simulator. It generates a continent from a seed, then simulates nations rising, fighting, rebelling and collapsing over 1,000+ years, played back as a timelapse.

**Visual target:** a grand-strategy game look (shaded terrain with translucent nation colors on top), in the spirit of *Fantasy Map Simulator* on Steam. Not a flat atlas look.

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

**Not now:** player control, economy, trade, religion, multiplayer, servers or accounts. (Ideas are parked in SPEC.md §8 and PARAMS.md "Candidate parameters".)

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
| M8 | Diplomacy (planned) | Opinion between nations from race attitudes, borders and past wars; alliances join defensive wars | §8 |
| M9 | Land and cell detail (planned) | Cells hold resources, unrest, devastation, development, settlements and ownership history; control replaces capital distance; rebellions start where unrest is high; wars fought over resources and claims; cities grow; 10-seed balance check still passes | §4.11 |
| Later | Backlog | See SPEC.md §8 | §8 |

---

## 7. Environment and workflow

- **Two PCs**, synced through a private GitHub repo (my personal account, not work).
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
