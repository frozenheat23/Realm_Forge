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
- **Every nation choice goes through a controller** (`sim/ai/`) and comes back as a command the rules apply. God and player orders are logged commands, so a save's log replays to the same history.
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
- Own generator and renderer; browser + TypeScript + Canvas 2D; sim on the main thread (no Web Worker needed, tick ~5–9 ms).
- Determinism guaranteed within the same browser only. `?seed=` picks the world, `?style=` the look, `?start=` the start.
- `tick()` changes the state in place and returns the year's events. `generateWorld()` returns the fixed map plus the year-0 state.
- Sim params are one mutable `SIM` object (with `SIM_DEFAULTS`) so Settings edits them live.
- Saves are JSON snapshots without the map (rebuilt from the seed). Current format v13; older versions say so when refused.

**Simulation design**
- Race traits are multipliers with Humans = 1.0. Cell people supply growth and fighting; the ruling race supplies aggression, cohesion and tolerance (M7).
- Diplomacy: one shared opinion per pair; alliances are defensive and offensive; only bordering allies join. Pacts fade without shared wars and new rulers may break them (`fickleness` race trait).
- Land: cells store causes (unrest, devastation, development, settlements, ownership); chances are worked out each year. `control` replaces distance from the capital. Every owner change goes through `setOwner`.
- Armies: one per side per war, four seasons a year; land is occupied in war and changes owner only at peace, by war goal (conquer, reclaim, raid). Holding the enemy capital at peace makes the loser a vassal (M21).
- Culture stays inside a race, faith crosses races; nine faiths. Rebels are one culture; dead realms can return. Pretenders come only from the ruling people.
- Rulers: five great types, each race leaning to one; succession crises and civil wars. Golden ages left out (backlog).
- War is decided on estimates (race confidence × ruler boldness × yearly error); defenders who hold out score and can win; generals lead armies; losers can sue for peace.
- Tuning target: great empires can reach 25–50% of the land and still break apart. On unseen seeds ~65% of worlds reach 25%; attackers win ~80% of decided wars.

**Look and screen**
- Parchment is the default style (M14); Classic map keeps the cel-shaded look. `MapLook` carries a style's choices to the overlay, labels and markers.
- Drawing: a still base canvas plus per-frame effects; overlays repaint only changed cells. Zoom redraws sharp 150 ms after it settles; markers grow as zoom^0.5.
- Side panel beside the map from 900 px, on one page (Wars, Past wars, Log, Sandbox, Play).
- Ruler portraits: 48 Octopath-style placeholders on parchment frames; only the seal takes the nation's color.

**Playing (M15–M20)**
- Controllers: the AI and the player answer the same questions under the same rules and information. History = seed + non-AI commands.
- Per-decision dice streams so one nation's choice can't shift another's rolls.
- War records are written by the rules and never read by them (history unchanged).
- Settled start (default, 10 kingdoms) wraps generation in `createWorld`; the open start is unchanged.
- The player plays by orders while paused plus standing policies; armies march on their own. When your realm falls you carry on as a realm of your people. No score.
- Dispatches pause on what happens to your realm; "Pause for…" switches are kept in the browser, not in saves.

| Date | Recent decisions |
|---|---|
| 2026-11-08 | Promoted vassalage and imperial succession into the next planned scope, with submission peace as the first route to becoming a subject. Start with one level of subjects, local rulers retained, military obligations/protection, and recognition or independence disputes on sovereign succession. Detailed contracts, family trees and inheritance of independent crowns remain later work. Scope only; implementation and parameter choices pending. See `docs/systems/vassalage.md` |
| 2026-11-08 | Built simplified campaign improvements: strength/morale/supply affect sieges; generals choose costly, uncertain assaults; relief and abandonment repair progress. Short controlled supply routes replace automatic supply on occupations; foraging, hunger and morale drive attrition/retreat. War Room shows conditions. `SIEGE_STEPS` 0.3 → 0.5; seven small parameters added. Repeatable tuning/validation reports cover separate ten-seed sets. Validation remains attacker-favored (84% of decided wars), so this is an initial pass. Golden histories deliberately updated; 380 tests and build pass, 2 optional reports skipped in normal suite; browser checked. Details: `docs/systems/campaigns.md` |
| 2026-11-08 | Army engagement judgment now estimates defensive ground with yearly, army/foe-specific scouting error (`ENGAGE_INTEL_ERROR` 0.4), plus saved cautious/bold general personalities using race temperament. Player armies use the same rules; combat's weighted outcome roll is unchanged. Old generals default to measured confidence. Golden histories deliberately re-recorded; 365 tests and build pass (1 optional balance test skipped), War Room checked in browser. Initial scouting range awaits balance tuning |
| 2026-11-08 | Bug fixes: fight-on policies cannot bypass exhaustion or maximum war duration; map styles switch in place without losing progress; Play demographics count current inhabitants from year 0 and explain when recruitment begins. 357 tests pass (1 optional balance test skipped), build passes, golden history unchanged; style round-trip and continued play checked in browser. No parameter changes |
| 2026-11-08 | Backlogged vassalage, submission peace terms, and imperial succession (extending existing succession) as a possible route to unification under one sovereign with local rulers; design and implementation deferred, parameters unchanged |
| 2026-11-07 | M20 built in 6 steps: player controller and policies (save v13), Play tab, orders, dispatches, carrying on after a fall and the end summary |
| 2026-11-08 | M20 playtest: only your first rout per war pauses; ordinary successions ("Every new ruler") off by default. Pauses per run 16–333 → 11–169 on 6 worlds. A realm on default policies never starts wars, so playing well means giving orders |
| 2026-11-08 | Docs shortened: decision log condensed to current decisions; full history stays in git |
| 2026-11-09 | Reviewed the campaign pass and vassalage scope (sound code, honest numbers; attacker wins still 84%). User chose a simple vassalage first |
| 2026-11-09 | Vassalage v1 built: holding a capital at peace makes the loser a vassal (keeps its capital); vassals start no wars or alliances; overlord and vassal join each other's wars by rule; no wars inside a crown; a vassal may declare independence only in the year its overlord's ruler is crowned (AI chance from opinion and strength, `INDEPENDENCE_CHANCE` 1), and goes free if its overlord falls. Save stays v13 (optional `overlord`). Validation seeds: realms alive at 500 13.6 → 22.1, attacker wins 84% unchanged, vassals serve ~50 years. Year now ~15–19 ms (more realms alive); test time limit 30 s. Golden histories re-recorded |
