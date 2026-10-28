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
| M4a | Growth | Population and expansion work; nations spread across the map | §4.1–4.4 |
| M4b | Instability | Stability, rebellion, collapse and emergence; empires break apart; event log | §4.3, §4.6–4.9, §6 |
| M5 | War | Wars start, play out and end; a 1,000-year run tells a believable story | §4.5 |
| M6 | Polish | Speed controls, settings panel, video export, save/load. Web Worker only if needed. | §5.5, §6 |
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
