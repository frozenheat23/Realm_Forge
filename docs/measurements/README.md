# Measurements

Saved numbers from measuring runs, so later changes can be compared on the same worlds.

## The world report (from 2026-11-09)

`npm run report -- tuning` or `npm run report -- validation` runs **24 worlds × 1,000 years** in parallel shards (about 1 minute per set on the Mac; `--shards 4` on a smaller machine) and saves `world-<set>-<date>.json` here.

- **Worlds per set:** 16 small settled starts (320×180, 10 kingdoms), 4 full-size settled starts, 4 small open starts. Seeds are `world-tuning-…` and `world-validation-…`.
- **How to use it:** tune on the tuning set only; check the result once on the validation set. Compare old and new code with `npm run report -- show <new file> <old file>`. Try parameter variants without changing code: `npm run report -- tuning --params '{"VASSAL_DEMAND_CHANCE":0.2}' --tag try-demand02`.
- **Code:** `tests/worldReport.ts` (what is measured), `tests/worldReport.test.ts` (skipped unless asked), `scripts/report.mjs` (shards, saving, summary).

| Measure | Meaning |
|---|---|
| `warsPerCentury`, `averageWarYears`, `battlesPerWar` | How much war, and how long |
| `attackerWinShare` | Of wars with a winner, the share the attacker won (target 55–75%) |
| `noWinnerShare` | Wars ending with no winner (white peace, or a side fell) |
| `cellsChangedPerCentury` | Land handed over at peace |
| `rebellionsPerCentury`, `civilWarsPerCentury`, `newRealmsPerCentury` | Breaking apart |
| `realmsAt250/500/1000`, `foundersAliveAt1000` | Realms alive; of the starting realms, how many survive |
| `realmsPeak`, `realmsLowAfterPeak` | The most realms ever alive, and the fewest after that. Close together = the world only fragments; far apart = it also comes back together |
| `crownsAt250/500/1000` | Independent crowns (a realm with its vassals counts once) |
| `peakRealmShare`, `peakCrownShare` | Most land one realm, or one crown (a realm and its vassals), ever held |
| `reached25`, `reached40`, `reached50` | Share of worlds where a crown reached 25% / 40% / 50% of the land |
| `finalCrownShare`, `finalCrownOver60`, `finalCrownAtMost25` | Largest crown's share of all land after the final year's transfers. The two flags count worlds above 60% and at or below 25%, including vassals |
| `largeRealmsConquered` | Realms taken whole in a single war settlement while holding at least 5% of all land. Includes allies' annexations. Partial transfers and realms dissolving below minimum size do not count |
| `missingRulingRaceAtEnd`, `residentRacesAtEnd`, `largestResidentPeople` | Whether any of the five peoples lacks a realm, the number still represented on cells, and the people holding the most cells by residence (ties use race order). Each world's `ending` names its leading crown and which peoples still have realms |
| `decidedConquests`, `exhaustedConquests`, `goalConquests`, `decisiveConquests`, `negotiatedConquests` | Main wars declared for conquest with a winner on either side, with counts by recorded peace reason. The total also includes wars that reached the time limit |
| `partialConquestWins`, `partialConquestCells` | Decided conquests where the loser's realm survived the peace, and cells handed over in those treaties |
| `giants`, `giantYears`, `giantsBroken` | Great empires per world (crowns that reached 25%); years they spent there; how many later fell below 12.5% |
| `successorStates` | Counted in the year an empire breaks: realms outside its crown each holding 5% or more (`SUCCESSOR_SHARE`) of the land it held at its height |
| `submissionsPerCentury`, `independenceWarsPerCentury`, `independenceWins` | Vassals made, wars of independence, and how many were won |
| `vassalsAt1000`, `vassalLandShareAt1000`, `averageServiceYears` | Vassals at the end, their land, how long a vassal served |
| `vassalsRevolted`, `vassalsFreedByFall`, `vassalsAbsorbed`, `vassalsChangedCrown`, `vassalsLetGo` | How each vassal's service ended: won a war of independence; its overlord fell; the vassal itself was swallowed or destroyed; it was taken by another overlord; or it was let go (too far to hold, or its overlord submitted) |
| `racesFallen`, `racesRulingAt1000`, `realmsConqueredPerCentury` | How often a race lost its last realm (it can return and fall again); how many of the five races rule a realm at the end; realms annexed by a conqueror |
| `biggestRaceShare` | The largest race's share of settled land at the end (over 50% = takeover) |
| `tickMs` | Milliseconds per simulated year; rough, since shards share the machine |

The summary pools the counts within each group of worlds before dividing. For example, `exhaustedConquestShare` divides exhausted conquest wins by all decided conquest wars. `cellsPerPartialConquest` divides cells transferred by the number of partial victories. The same approach measures giant breakups, successors, vassalage and the years after a Conqueror's death. Comparing with a file that predates a measure shows `NaN → value`.

## Saved files

- `world-*-settlement-strain.json` is the November 20 iteration. The tuning run records the tested overextension override. Validation uses the same value as the new default.
- `world-tuning-settlement.json` isolates settlement under long foreign rule with the original overextension cost.
- `world-tuning-fatigue-trial.json` tests half the weariness from casualties under the November 17 rules. The experiment ended on the tuning set.
- `world-*-endings-base.json` records the November 17 rules with the new ending measures. Across both sets all older simulation measures match the conquest reports seed for seed.
- `world-tuning-conquest.json`, `world-validation-conquest.json`: the conquest pass (2026-11-17): Conquerors march for the throne, `PEACE_EXTRA_CELLS` 150, `ANNEX_CHANCE` 0.6.
- `world-validation-peoples-base.json`: the rules of the one below, measured again with the race and Conqueror measures added.
- `world-tuning-cycle1.json`, `world-validation-cycle1.json`: the one before (2026-11-16): empire cycle step 1 (vassals rise at moments of weakness).
- `world-tuning-tidy7000.json`, `world-validation-tidy7000.json`: the one before (2026-11-15): 7,000 cells and tidy borders.
- `world-tuning-cycle-baseline.json`, `world-validation-cycle-baseline.json`: the one before (2026-11-11): 10,000 cells, no tidying. The starting point for `docs/systems/empire-cycle.md`.

Older files (the campaign pass, vassalage v1, the empires pass, and 7,000 cells with tidying off) were removed on 2026-11-15; they are in git history.

## The era report (very long histories)

`tests/eraReport.test.ts` runs the same worlds for up to 5,000 years and measures each 500-year era on its own, to show whether late history still moves. It is opt-in, like the world report. One shard:

`ERA_REPORT=validation ERA_YEARS=5000 ERA_SHARD=0/8 npx vitest run tests/eraReport.test.ts`

Eight shards side by side take about 5 minutes. Each `ERA_ROW` line is one world in one era. A crown that breaks and rises again counts as a new great empire here (the world report counts it once).

- `eras-validation-cycle1.json` (2026-11-16): 24 validation worlds × 5,000 years, after empire cycle step 1. History does not freeze: from year 1,500 on, wars (about 58 a century), new realms (about 8 a century) and the largest crown (about 24% of the land on average) stay level. Great empires rise and break about once per 500 years per world; years 500–1,000 are the exception, with a great empire standing 82% of the time.
