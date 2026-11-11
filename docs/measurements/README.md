# Measurements

Saved numbers from measuring runs, so later changes can be compared on the same worlds.

## The world report (from 2026-11-09)

`npm run report -- tuning` or `npm run report -- validation` runs **24 worlds × 1,000 years** in parallel shards (about 20–30 minutes on a 14-core PC; `--shards 4` on a smaller one) and saves `world-<set>-<date>.json` here.

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
| `giants`, `giantYears`, `giantsBroken` | Great empires per world (crowns that reached 25%); years they spent there; how many later fell below 12.5% |
| `successorStates` | Counted in the year an empire breaks: realms outside its crown each holding 5% or more (`SUCCESSOR_SHARE`) of the land it held at its height |
| `submissionsPerCentury`, `independenceWarsPerCentury`, `independenceWins` | Vassals made, wars of independence, and how many were won |
| `vassalsAt1000`, `vassalLandShareAt1000`, `averageServiceYears` | Vassals at the end, their land, how long a vassal served |
| `vassalsRevolted`, `vassalsFreedByFall`, `vassalsAbsorbed`, `vassalsChangedCrown`, `vassalsLetGo` | How each vassal's service ended: won a war of independence; its overlord fell; the vassal itself was swallowed or destroyed; it was taken by another overlord; or it was let go (too far to hold, or its overlord submitted) |
| `biggestRaceShare` | The largest race's share of settled land at the end (over 50% = takeover) |
| `tickMs` | Milliseconds per simulated year; rough, since shards share the machine |

The summary ends with five **ratios**, worked out over all the worlds of a group together (so a world with no breakup doesn't count as zero): `giantsBrokenShare`, `successorsPerBreakup`, `vassalsRevoltedShare`, `vassalsChangedCrownShare`, `vassalsAbsorbedShare`. Compared with a file saved before a measure existed, that measure shows `NaN → value`.

## Older files

- `campaigns-2026-11-08.json`: 10 small worlds × 500 years, before and after the campaign pass (`npm run balance`).
- `vassals-2026-11-09.json`: the same report after vassalage v1.
- `world-tuning-baseline.json`, `world-validation-baseline.json`: the first world reports (vassalage v1).
- `world-tuning-empires.json`, `world-validation-empires.json`: after the empires pass (`docs/systems/vassalage.md`).
- `world-tuning-cycle-baseline.json`, `world-validation-cycle-baseline.json`: the same code as the empires files, with the empire-cycle measures added (2026-11-11). The starting point for `docs/systems/empire-cycle.md`.
