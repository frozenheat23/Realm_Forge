# Realm Forge — Project Guide for Claude

A browser-based fantasy world simulator. It generates a continent from a seed, then simulates nations rising, fighting, rebelling and collapsing over 1,000 years, played back as a timelapse. You can watch, play god in the Sandbox, or play one nation.

**Visual target:** an old printed chart: parchment, thin clear ink outlines, hand-drawn terrain and markers, pale nation colors. The older grand-strategy look stays as the "Classic map".

> Keep this file up to date. When a decision changes, update the relevant doc and add a short line to the **Decision log**.

---

## 1. Reference docs

| Doc | What's in it | When to read it |
|---|---|---|
| `CLAUDE.md` (this file) | Rules, learning mode, workflow, milestones, decisions | Every session |
| [`docs/SPEC.md`](docs/SPEC.md) | How it works: architecture, data model, generation, simulation rules, rendering | Before changing a system, read its section |
| [`docs/systems/`](docs/systems/) | One file per later system (rulers, controllers, War Room, start, sandbox, real war, play) | Before changing that system |
| [`docs/PARAMS.md`](docs/PARAMS.md) | Every tunable number: default, range, effect, tuning recipes | When adding, changing or tuning parameters |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md) | Plain-English definitions of coding concepts we've used | Update whenever a new concept comes up |

**Keeping docs in sync**
- SPEC.md and PARAMS.md use the **same section headings**.
- New parameter or changed default → update PARAMS.md in the same commit as the code.
- New system → its own `docs/systems/<name>.md`, linked from SPEC (SPEC §9).
- If docs and code disagree, flag it to me rather than guessing.

---

## 2. Who I am and how to work with me

I'm new to coding and learning TypeScript through this project. Every session is **build + teach**.

- **Explain as you go.** After creating or changing a file, give 2–3 plain-English sentences: what it does, how it connects to other files, and one new concept it uses.
- **Readable over clever.** Clear names, short functions, a one-line comment above anything non-obvious.
- **Explain errors first.** When something breaks, say what the error means in plain words, then fix it.
- **One small exercise per milestone.** Something safe for me to change myself (often a parameter from PARAMS.md), what should happen, and how to undo it. Review my change afterwards.
- **Keep a glossary** in `docs/GLOSSARY.md`: 1–2 lines per concept and where it appears in our code.
- **Keep it short.** I'll ask if I want more detail.

---

## 3. What we're building

**Goals**
- Generate a believable fantasy continent from a seed.
- Simulate nations year by year: expansion, war, diplomacy, rebellion, collapse, new states, races, cultures, faiths, rulers.
- Show it as a good-looking map with playback controls, an event log, a War Room, a Sandbox and a Play tab.
- Same seed + same settings + same commands = same history (in the same browser).

**Not now:** directing armies yourself, fog of war, a score, economy, trade, multiplayer, servers or accounts. (Ideas are parked in SPEC.md §8 and PARAMS.md "Candidate parameters".)

---

## 4. Tech stack

| What | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Dev server / build | Vite |
| Drawing | Canvas 2D; `three` only for the optional 3D relief view (`src/render3d/`) |
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
- **Every nation choice goes through a controller** (`sim/ai/`) and comes back as a command the rules apply. God and player orders are logged commands, so a save's log replays to the same history.
- `render3d/` follows the same rule as `render/`, and is the only place three.js is used.
- **No magic numbers.** Tunable values live only in `gen/params.ts`, `sim/params.ts`, `render/palette.ts` or `ui/config.ts`, and are documented in PARAMS.md.
- **The core loop to protect:** grow → get too big → become unstable → break apart. If history looks frozen or chaotic, check the tuning recipes in PARAMS.md first.
- **Measuring:** tune on one set of seeds and report numbers from seeds never tuned on; compare old and new code on the same seeds. 5–10 seeds can't separate small changes.
- **Golden history:** `tests/golden.test.ts` holds fingerprints of fixed runs. A change that shouldn't alter history must pass it; one that should is re-recorded on purpose and noted here.
- Long test runs go through `runYears()` (`tests/longRun.ts`), or CI times out.

Full folder layout and design are in SPEC.md §1.

---

## 6. Milestones

All built. Each one's design is in the SPEC section or system doc listed.

| # | Milestone | Where |
|---|---|---|
| M0–M6 ✅ | Setup, terrain, cells & biomes, starting nations, growth, instability, war, polish (speed, settings, video, save/load) | SPEC §3–§6 |
| M7 ✅ | Races (Humans, Light Elves, Dark Elves, Dwarves, Orcs) | SPEC §4.10 |
| M8 ✅ | Diplomacy: opinion, alliances | SPEC §4.12 |
| M9 ✅ | Land and cell detail: resources, unrest, devastation, settlements, claims | SPEC §4.11 |
| M10 ✅ | War and unrest effects (key E) | SPEC §5.4g |
| M11 ✅ | Armies, battles, sieges, war goals | SPEC §4.13 |
| M12 ✅ | Culture and faith | SPEC §4.14 |
| M13 ✅ | Rulers and dynasties | `docs/systems/rulers.md` |
| M14 ✅ | Parchment map (default style) | SPEC §5.1b |
| M15 ✅ | Controllers and commands | `docs/systems/controllers.md` |
| M16 ✅ | War Room | `docs/systems/warroom.md` |
| M16b ✅ | Settled start (old kingdoms) | `docs/systems/start.md` |
| M17 ✅ | Sandbox: god commands and odds | `docs/systems/sandbox.md` |
| M18 ✅ | Real war: misjudgment, underdog defense, generals, suing for peace | `docs/systems/realwar.md` |
| M19 ✅ | Map zoom | SPEC §5.4l |
| M20 ✅ | Play as a nation | `docs/systems/play.md` |
| M21 ✅ | Vassalage v1: submission at peace, duties, independence at a new overlord ruler | `docs/systems/vassalage.md` |
| M22 ✅ | 3D relief view (switch beside the flat map) | SPEC §5.4n |

At the end of each milestone: run tests, take a screenshot, give me my exercise, update the Decision log.

---

## 7. Environment and workflow

- **Play it:** https://frozenheat23.github.io/Realm_Forge/. Every push to `main` tests, builds and publishes the game (`.github/workflows/publish.yml`). If a test fails, the live site stays as it was.
- **Two PCs**, synced through a **public** GitHub repo (my personal account, not work). Never commit anything private.
- **Start of session:** `git pull`. **End of session:** commit and push. Nothing unpushed is safe.
- **Work PC (Windows, managed):**
  - Do **not** change PowerShell execution policy or any system or security settings.
  - Run commands in Command Prompt (`cmd`). In PowerShell, use `npm.cmd` / `npx.cmd`.
  - Don't install global tools or anything needing admin rights without asking me.
- **Cloud sessions** (e.g. Codespaces) are fine. Same rule: push before closing.
- Commit after each milestone or meaningful step, with a clear message.
- Art drafts live in `assets/` (not in git, ~100 MB); `scripts/portraits.py` makes the small files in `public/`. Prompts: `docs/art/portrait-prompts.md`.

---

## Decision log

Short and current. Earlier detail (tuning runs, measurements) is in git history and each system doc's "As built" notes.

**Foundations (M0–M6)**
- Own generator and renderer; browser + TypeScript + Canvas 2D; sim on the main thread (no Web Worker needed; a year takes about 12 ms).
- Determinism guaranteed within the same browser only. `?seed=` picks the world, `?style=` the look, `?start=` the start.
- `tick()` changes the state in place and returns the year's events. `generateWorld()` returns the fixed map plus the year-0 state.
- Sim params are one mutable `SIM` object (with `SIM_DEFAULTS`) so Settings edits them live.
- Saves are JSON snapshots without the map (rebuilt from the seed). Current format v13; older versions say so when refused.

**Simulation design**
- Race traits are multipliers with Humans = 1.0. Cell people supply growth and fighting; the ruling race supplies aggression, cohesion and tolerance (M7).
- Diplomacy: one shared opinion per pair; alliances are defensive and offensive; only bordering allies join. Pacts fade without shared wars and new rulers may break them (`fickleness` race trait).
- Land: cells store causes (unrest, devastation, development, settlements, ownership); chances are worked out each year. `control` replaces distance from the capital. Every owner change goes through `setOwner`.
- Borders: a peace straightens the line between the two realms, and small pockets cut off from their realm join the realm around them (SPEC §4.17). The map has 7,000 cells.
- Armies: one per side per war, four seasons a year; land is occupied in war and changes owner only at peace, by war goal (conquer, reclaim, raid). Holding the enemy capital at peace makes the loser a vassal (M21).
- Campaigns: strength, morale and supply shape sieges; generals choose costly assaults and judge fights on imperfect scouting (`docs/systems/campaigns.md`).
- Vassals: a winner holding the loser's capital annexes it or makes it a vassal; far stronger winners demand submission. Vassals start no wars, join their overlord's, and may declare independence when a new overlord is crowned. Crowns count their vassals when weighing war (`docs/systems/vassalage.md`).
- Culture stays inside a race, faith crosses races; nine faiths. Rebels are one culture; dead realms can return. Pretenders come only from the ruling people.
- Rulers: five great types, each race leaning to one; succession crises and civil wars. Golden ages left out (backlog).
- War is decided on estimates (race confidence × ruler boldness × yearly error); defenders who hold out score and can win; generals lead armies; losers can sue for peace.
- Tuning target: great empires can reach 25–50% of the land and still break apart; attackers win 55–75% of decided wars. Measure with `npm run report` (24 worlds × 1,000 years per set, `docs/measurements/README.md`). Now (2026-11-15, validation, 7,000 cells and tidy borders): every world reaches a 25% crown, 79% reach 40%, 50% reach 50%; 47% of giants break below 12.5% (target half); attackers win 74%.

**Known gaps and what is next**
- Attacker wins are high by design of the rules (only the confident attack; no alliances from fear of a giant), and vassal land adds no overextension, so under half of giants break. The user left these for the empire cycle.
- Next planned: the empire cycle (`docs/systems/empire-cycle.md`). Scope agreed 2026-11-11: large empires that conquer and break, vassals that rebel, broken empires may reunite, Dwarves stay the stable survivors. Nothing built yet.
- Navies left out: on full-size worlds 95–99% of the land is one continent. A small "sea crossings" version is the candidate if wanted.
- Year-1000 saves are about 5.5 MB and Load passes them through `sessionStorage` (untested in Safari and Firefox).

**Look and screen**
- Parchment is the default style (M14); Classic map keeps the cel-shaded look. `MapLook` carries a style's choices to the overlay, labels and markers.
- Drawing: a still base canvas plus per-frame effects; overlays repaint only changed cells. Zoom redraws sharp 150 ms after it settles; markers grow as zoom^0.5.
- Side panel beside the map from 900 px, on one page (Wars, Past wars, Log, Sandbox, Play).
- Ruler portraits: 48 Octopath-style placeholders on parchment frames; only the seal takes the nation's color.
- Realm colors follow the ruling race: Humans blue, Light Elves green, Dark Elves violet, Dwarves amber, Orcs red (`RACE_HUES`). Families are narrow and far apart because parchment washes colors toward brown.
- Telling the story (SPEC §5.4o–q): a headline on the map for each year's biggest news (kind weight × size of the biggest realm involved); a versus screen for conquered realms only; fallen rulers' cards burn; a band below the map with the five greatest crowns and a chronicle, taking only leftover height; ruler faces on wars going on now. Still open: marks where news happened, a timeline, director mode, an end chronicle, a calmer log.
- 3D relief view (M22): optional, three.js loaded on demand, the 2D canvas is the terrain's texture, names stand as signs. Paused 2026-11-13 because it lags; parked plan: draw 3D and 2D separately. `RELIEF_SKIN_SCALE` is 1 meanwhile (2 gives a sharp skin).

**Playing (M15–M20)**
- Controllers: the AI and the player answer the same questions under the same rules and information. History = seed + non-AI commands.
- Per-decision dice streams so one nation's choice can't shift another's rolls.
- War records are written by the rules and never read by them (history unchanged).
- Settled start (default, 10 kingdoms) wraps generation in `createWorld`; the open start is unchanged.
- The player plays by orders while paused plus standing policies; armies march on their own. When your realm falls you carry on as a realm of your people. No score.
- Dispatches pause on what happens to your realm; "Pause for…" switches are kept in the browser, not in saves. Only your first rout per war pauses, and ordinary successions are off by default.
- A realm on default policies never starts wars, so playing well means giving orders.

| Date | Recent decisions |
|---|---|
| 2026-11-15 | Messy endgame fixed (user's observation, confirmed on five worlds): `CELL_COUNT` 10000 → 7000 (other numbers not rescaled) and tidy borders (SPEC §4.17; `BORDER_ROUNDS` 3, `POCKET_MAX_CELLS` 12, `POCKET_YEARS` 10). Fewer cells alone tidied nothing; the rules did: stray pieces at year 1000 went from 147–208 to 3–7 per world, land on a border from 51–58% to 20–27%. Side effects on the validation set, mostly from the cell count: crowns peak at 50% of the land (was 38%), wars a century 69 → 42, rebellions 9 → 5, attacker wins 81% → 74%, giants breaking 38% → 47%. Golden histories re-recorded |
| 2026-11-15 | Notes cleaned up: this log condensed to current decisions (dated rows from 2026-11-07 to 2026-11-14 folded into the lists above; full history in git); seven superseded measurement files removed, keeping `world-*-tidy7000.json` (current) and `world-*-cycle-baseline.json` (before); the report's time corrected to about 1 minute per set. Fixed: the band's standings showed 0% before the first year |
