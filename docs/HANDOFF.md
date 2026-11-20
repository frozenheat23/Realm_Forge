# Handoff: worlds that end differently

A note for Astra, picking up from Fable's sessions of 2026-11-15 to 2026-11-17. The user will start you from here. Read `CLAUDE.md` first (rules, how the user likes to work), then this note.

## Where things stand

Everything below is committed and on `main` (`3154cbb`). All 461 tests and the build pass.

Built in those sessions:

- **Realm titles and split marks** (SPEC §5.4r–s): screen only.
- **Peoples list and headlines** (SPEC §5.4t, `src/ui/peoples.ts`): the band shows each race's realms and land, and a headline tells when a race's last realm falls or a fallen race rules again. Screen only.
- **Empire cycle step 1** (`docs/systems/empire-cycle.md`): vassals rise when their overlord is weak.
- **Conquest pass** (`docs/systems/rulers.md`, last bullet): Conquerors march for the enemy throne, swallow realms more often and feel less strain while they reign. `PEACE_EXTRA_CELLS` 40 → 150 and `ANNEX_CHANCE` 0.25 → 0.6. The user chose to keep these for now.
- **Era report** (`tests/eraReport.test.ts`): opt-in runs of up to 5,000 years, measured in 500-year eras.

## The goal the user agreed (not started)

**Every world ends differently, and you can say how in one sentence.** Snowballs are welcome; races and kingdoms can be wiped out for good. "If in 1000 years there is only humans with a small orc enclave as vassal then so be it" (the user's words).

The user's decisions:

- A race may be **ruled out** (no realm) or **wiped out** (its people fade from land others hold). Extinction can be permanent.
- One crown should hold **over 60% of the land in 25–30% of worlds**.
- **Dwarves are no longer protected.** This overrides the 2026-11-11 empire-cycle scope ("Dwarves stay the stable survivors").

Targets on the 24 validation worlds at year 1,000:

| Measure | Now | Target |
|---|---|---|
| Worlds where one crown holds over 60% at the end | 0% | 25–30% |
| Worlds with no crown over 25% at the end | most | 20–35% |
| Races still ruling at the end (of 5) | 4.7 | about 3, from 1 to 5 |
| Worlds with at least one race gone at the end | about 30% | 70% or more |
| Large realms (5%+ of the land) conquered whole, per world | almost none | 3–6 |
| Realms alive at the end | 16 | 6–14 |
| Giants that break | 47% | 40–60% |

The first, second and fifth measures are **not in the world report yet**. Add them to `tests/worldReport.ts` (and the ratios in `scripts/report.mjs` if needed) before changing any rule, then re-measure the current code as the baseline.

## What holds history back (the four brakes)

Found while measuring; none has been changed yet.

1. **Wars take little.** An ordinary war of conquest moves about 7.5 cells, and in a breakdown of 6 tuning worlds over half of won wars ended in exhaustion (`WEARINESS_PEACE`), not by reaching their goal.
2. **Size is punished, winning is not rewarded.** Overextension, control and foreign-people penalties all grow with size (`src/sim/stability.ts`); nothing pays a realm for winning.
3. **The map refills.** About 6 new realms a century from rebellions and reborn realms.
4. **Peoples never change.** Conquest changes who rules a cell, never who lives there (`state.state.race` changes only when land empties or is settled), so a "dead" race can always rise again. Permanent extinction needs a rule here, for example people slowly taking on their rulers' race after long foreign rule.

## Suggested order

1. Add the missing measures; record the baseline on both sets.
2. Investigate brake 1 first. Measure why wars end where they do before touching numbers.
3. Then brake 4 (peoples fading), which is the only way to make extinction permanent. It is the riskiest: watch that one race doesn't win every world (`biggestRaceShare`).
4. Then brakes 2 and 3 as needed to hit the targets.

## Lessons from the last pass

- **Measure before guessing.** Four Conqueror levers (refusing peace, slower weariness, war chance × 4, army power × 2.5) changed nothing measurable. The breakdown that showed why took one small throwaway test.
- **The tuning set over-promised.** Giants breaking went 40% → 54% on tuning worlds but stayed 47% on validation. Always confirm on the validation set and report those numbers.
- **The 1,000-year cut-off matters.** Years 500–1,000 are the age of empires in most worlds; over 5,000 years nearly every giant breaks. Judge "giants break" with that in mind.
- **Unexplained:** a Conqueror starts only about 2 wars in a 23-year reign. Not looked into.

## How to measure

- `npm run report -- tuning --tag <name>` and `npm run report -- validation --tag <name>`, about 1 minute each.
- `npm run report -- show <new.json> <old.json>` compares two runs.
- Try a value without editing code: `--params '{"ANNEX_CHANCE":0.8}'`.
- Long runs: see "The era report" in `docs/measurements/README.md`.
- Current baseline: `docs/measurements/world-*-conquest.json`.

## Loose ends (small, unrelated to the goal)

- `HEADLINE_WEIGHTS.succession` is 8 in `src/ui/config.ts` but 4 in `docs/PARAMS.md`. The user hasn't said which is right.
- The Settings slider for `RISING_HOLD_SCORE` was never checked with negative values.
- Titles, split marks and the Peoples list were not checked in the 3D view.
- Ghost-name and title thresholds are first guesses, not measured.

## Working with the user

They are learning TypeScript: explain each changed file in 2–3 plain sentences with one new concept, keep the glossary current, give one small exercise per step, and keep messages short. For anything visual, show mock-ups and let them pick before building. Golden histories (`tests/golden.test.ts`) will change with any rule change; re-record them on purpose and note it in the Decision log.
