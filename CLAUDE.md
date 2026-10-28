# Realm Forge — Project Guide for Claude

A browser-based fantasy world simulator. It generates a continent from a seed, then simulates nations rising, fighting, rebelling and collapsing over 1,000+ years, played back as a timelapse.

**Visual target:** a grand-strategy game look (shaded terrain with translucent nation colors on top), in the spirit of *Fantasy Map Simulator* on Steam. Not a flat atlas look.

> Keep this file up to date. When a decision changes, update the relevant section and add a line to the **Decision log**.

---

## 1. Who I am and how to work with me

I'm new to coding and learning TypeScript through this project. Every session is **build + teach**.

- **Explain as you go.** After creating or changing a file, give 2–3 plain-English sentences: what it does, how it connects to other files, and one new concept it uses.
- **Readable over clever.** Clear names, short functions, a one-line comment above anything non-obvious.
- **Explain errors first.** When something breaks, say what the error means in plain words, then fix it.
- **One small exercise per milestone.** Something safe for me to change myself (a number, a color, a rule), what should happen, and how to undo it.
- **Keep a glossary.** Add each new concept to `docs/GLOSSARY.md` with a 1–2 line definition and where it appears in our code.
- **Keep it short.** I'll ask if I want more detail.

---

## 2. What we're building

**Goals**
- Generate a believable fantasy continent from a seed.
- Simulate nations year by year: expansion, war, peace, rebellion, collapse, new states.
- Show it as a good-looking map with play / pause / speed controls, a year counter and an event log.
- Same seed + same settings = same history (in the same browser).

**Not now:** player control, economy, trade, religion, multiplayer, servers or accounts.

---

## 3. Tech stack

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

## 4. Folder structure

```
src/
  core/     shared basics: random numbers, types, math helpers
  gen/      builds the world: terrain, climate, biomes, rivers, cells, starting nations
  sim/      runs one year at a time: population, expansion, war, rebellion, collapse
  render/   draws the map: terrain, nation colors, borders, labels
  ui/       buttons, speed control, year counter, event log
  main.ts   starts everything
tests/      automated tests
docs/       GLOSSARY.md, reference screenshots in docs/ref/
```

**Rules**
- `gen/` and `sim/` never touch the screen (no DOM or Canvas code). They only work with data, so they're easy to test.
- `render/` only reads the world. It never changes it.
- All randomness comes from one seeded generator, split into named streams (e.g. `rng.fork("war")`).
- All tunable numbers live in `gen/params.ts` (generation), `sim/params.ts` (simulation) or `render/palette.ts` (colors). No magic numbers elsewhere.

---

## 5. How the simulation works

One tick = one year. Steps run in this fixed order:

1. **Population** grows toward each cell's capacity; war zones lose people.
2. **Totals**: recompute each nation's size, population and strength.
3. **Stability** drops when a nation is too big, too war-weary, or far from its capital; it slowly recovers otherwise.
4. **Expansion**: nations claim nearby empty land (cheap on plains and rivers, expensive in mountains and deserts).
5. **War declared** between neighbors, more likely when one is much stronger.
6. **War fought**: border cells flip toward the winning side; peace comes when one side is clearly winning, exhausted, or the war runs too long.
7. **Rebellion**: unstable nations may split, with a new nation forming far from the capital.
8. **Collapse**: tiny or capital-less nations dissolve.
9. **Emergence**: new nations can appear in large empty areas.
10. **Events** are logged for anything notable.

**The core loop to protect:** grow → get too big → become unstable → break apart. If history looks frozen or chaotic, tune this first.

---

## 6. Milestones

Work one at a time. At the end of each: run tests, take a screenshot, give me my exercise, and update the Decision log.

| # | Milestone | Done when |
|---|---|---|
| M0 ✅ | Setup | Vite + TypeScript + Vitest run; seeded random generator has a test proving same seed = same numbers |
| M1 | Terrain | Seeded map with hillshading and water shows on screen and looks good |
| M2 | Cells & biomes | Map split into cells with climate, biomes and rivers; debug view of cells |
| M3 | Starting nations | Capitals and starting borders drawn with colors, borders and names |
| M4a | Growth | Population and expansion work; nations spread across the map |
| M4b | Instability | Stability, rebellion, collapse and emergence work; empires break apart; event log shows it |
| M5 | War | Wars start, play out and end; a 1,000-year run tells a believable story |
| M6 | Polish | Speed controls, settings panel, video export, save/load. Move the sim to a Web Worker only if it's slowing the screen. |
| Later | Backlog | Azgaar map import, cultures, dynasties, trade, better names, possible Rust port of `sim/` |

---

## 7. Environment and workflow

- **Two PCs**, synced through a private GitHub repo (my personal account, not work).
- **Start of session:** `git pull`. **End of session:** commit and push. Nothing unpushed is safe.
- **Work PC (Windows, managed):**
  - Do **not** change PowerShell execution policy or any system or security settings.
  - Run commands in Command Prompt (`cmd`). In PowerShell, use `npm.cmd` / `npx.cmd`.
  - Don't install global tools or anything needing admin rights without asking me.
- **Cloud sessions** (e.g. Codespaces) are fine. Same rule: push before closing.

---

## 8. Conventions

- Determinism matters: test that the same seed gives identical events after 1,000 years.
- Use typed arrays (e.g. `Float32Array`) for per-cell data that changes every year.
- Small, pure functions in `sim/`, each with a test on a tiny hand-made map.
- Commit after each milestone or meaningful step, with a clear message.

---

## 9. References

- *Fantasy Map Simulator* (Steam): look-and-feel reference.
- Azgaar's Fantasy Map Generator (MIT license): reference for generation techniques. If we adapt any code, keep its MIT notice and credit it.
- Red Blob Games articles on map generation and noise.

---

## 10. Open questions

- Map size (default 1600×900)?
- One continent vs islands?
- Slow down time automatically during big events?
- Which reference screenshots define the look? (Add them to `docs/ref/`.)

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
| 2026-10-28 | M0 done: Vite 7 + TS 5.9 strict + Vitest 3; RNG is FNV-1a hash + Mulberry32; `fork(name)` derives from seed + name only |
| 2026-10-28 | Generation params live in `src/gen/params.ts` (as SPEC.md says), alongside `sim/params.ts` and `render/palette.ts` |
| 2026-10-28 | `.gitattributes` forces LF line endings so Mac and Windows checkouts match |
