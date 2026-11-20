# Handoff: worlds that end differently

A note for Astra, picking up from Fable's sessions of 2026-11-15 to 2026-11-17. The user will start you from here. Read `CLAUDE.md` first (rules, how the user likes to work), then this note.

## November 20 iteration

The report now describes each world's ending in one sentence. In `world-validation-small-12`, Arzir held 76% of all land in year 1,000. Six realms survived and the Orcs had lost their last realm. In `world-validation-full-0`, Krak held just under a quarter and all five peoples still had realms.

| At year 1,000 on the same 24 validation seeds | November 17 rules, remeasured | November 20 rules | Target |
|---|---:|---:|---:|
| Crown above 60% | 0/24 | 1/24 | 6–7/24 |
| Largest crown at or below 25% | 5/24 | 1/24 | 5–8/24 |
| Races ruling | 4.67 | 4.50 (range 3–5) | About 3 (range 1–5) |
| Worlds where a race lacks a realm | 6/24 | 11/24 | At least 17/24 |
| Large realms conquered whole per world | 4.00 | 3.75 | 3–6 |
| Realms alive | 16.04 | 11.33 | 6–14 |
| Giants that broke | 47% | 43% | 40–60% |

**Experiments and decisions**

1. **War fatigue.** Of decided conquest wars, 59% on tuning and 61% on validation ended in exhaustion. On six tuning seeds, in 246 of 472 such endings a side that exhausted had already been at least 60% weary before declaration. Halving casualty weariness on the tuning set reduced exhaustion endings to 45% and increased cells per partial victory from 6.56 to 7.65. Both versions produced one dominant ending. Keep the original weariness rules.
2. **Peoples after conquest.** A populated, calm cell under one foreign ruler for 50 years can gain a new majority. Its annual chance is 2% at full control, lower elsewhere. A race without any surviving realm or cell stays extinct when old homelands generate new realms. Settlement alone took the tuning set from 2 to 7 worlds missing a ruling race.
3. **Cost of size.** Lowering `OVEREXT_K` from 0.00003 to 0.000012, alongside settlement, brought the tuning average from 15.6 living realms to 12.8. Half of tuning giants still broke. The table above gives the held-out result for these defaults. All five peoples survived as residents in every validation world. Each of the five was the largest resident population by land in at least one world.

**Where to pick up.** Twenty-two validation endings now have a leading crown between 25% and 60%. Measure how the final century differs for crowns that hold their gains and those that lose them, including how much land goes to vassals, annexations and breakaways. Also count cells of the last subject people by control, unrest and habitability to learn what keeps an enclave alive.

**Code and exercise.** `sim/culture.ts` uses a separate seeded stream for settlement. It changes race and culture together because a culture belongs to one people. `sim/emergence.ts` consults the existing realm and cell records before founding a new kingdom in an old homeland. In Settings → Culture and faith, try `PEOPLE_SETTLEMENT_RATE` at 0 on a fresh run of the same seed and watch the Races layer. Foreign majorities can then survive centuries of calm rule. Restore 0.02 to undo the experiment.

## Before this iteration (November 17)

Everything below is committed and on `main` (`3154cbb`). All 461 tests and the build pass.

Built in those sessions:

- **Realm titles and split marks** (SPEC §5.4r–s): screen only.
- **Peoples list and headlines** (SPEC §5.4t, `src/ui/peoples.ts`): the band shows each race's realms and land, and a headline tells when a race's last realm falls or a fallen race rules again. Screen only.
- **Empire cycle step 1** (`docs/systems/empire-cycle.md`): vassals rise when their overlord is weak.
- **Conquest pass** (`docs/systems/rulers.md`, last bullet): Conquerors march for the enemy throne, swallow realms more often and feel less strain while they reign. `PEACE_EXTRA_CELLS` 40 → 150 and `ANNEX_CHANCE` 0.25 → 0.6. The user chose to keep these for now.
- **Era report** (`tests/eraReport.test.ts`): opt-in runs of up to 5,000 years, measured in 500-year eras.

## The agreed goal

**Every world ends differently, and you can say how in one sentence.** Snowballs are welcome; races and kingdoms can be wiped out for good. "If in 1000 years there is only humans with a small orc enclave as vassal then so be it" (the user's words).

The user's decisions:

- A race may be **ruled out** (no realm) or **wiped out** (its people fade from land others hold). Extinction can be permanent.
- One crown should hold **over 60% of the land in 25–30% of worlds**.
- **Dwarves are no longer protected.** This overrides the 2026-11-11 empire-cycle scope ("Dwarves stay the stable survivors").

The current figures and targets are in the November 20 table above.

The report now records all seven targets. It counts land held through vassals in a crown, and counts a large annexation by the cells the loser still held at peace. Losing the last ruling realm and losing the last resident cell are separate measures.

## What holds history back (the four brakes)

These were the four hypotheses on November 17. See the November 20 results above for the experiments so far.

1. **Wars take little.** An ordinary war of conquest moves about 7.5 cells, and in a breakdown of 6 tuning worlds over half of won wars ended in exhaustion (`WEARINESS_PEACE`), not by reaching their goal.
2. **Size is punished, winning is not rewarded.** Overextension, control and foreign-people penalties all grow with size (`src/sim/stability.ts`); nothing pays a realm for winning.
3. **The map refills.** About 6 new realms a century from rebellions and reborn realms.
4. **Peoples persisted under conquest.** Before this iteration a cell kept its residents throughout foreign rule, allowing fallen peoples to rise again indefinitely.

## Original build order

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
- Pre-change baseline: `docs/measurements/world-*-endings-base.json`. Current rules: `docs/measurements/world-*-settlement-strain.json`.

## Loose ends (small, unrelated to the goal)

- `HEADLINE_WEIGHTS.succession` is 8 in `src/ui/config.ts` but 4 in `docs/PARAMS.md`. The user hasn't said which is right.
- The Settings slider for `RISING_HOLD_SCORE` was never checked with negative values.
- Titles, split marks and the Peoples list were not checked in the 3D view.
- Ghost-name and title thresholds are first guesses, not measured.

## Working with the user

They are learning TypeScript: explain each changed file in 2–3 plain sentences with one new concept, keep the glossary current, give one small exercise per step, and keep messages short. For anything visual, show mock-ups and let them pick before building. Golden histories (`tests/golden.test.ts`) will change with any rule change; re-record them on purpose and note it in the Decision log.
