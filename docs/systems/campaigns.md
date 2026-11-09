# Simple sieges, supply and tuning

Built 2026-11-08 as a small extension to the existing seasonal campaign. Field-battle odds and imperfect engagement judgment remain unchanged.

## Sieges

`sim/siege.ts` uses existing population, settlement level, terrain, capital status and siege progress to estimate local resistance. It represents a local militia and defenses, not a second field army or another pool of recruitable soldiers. Larger, healthier besiegers progress faster up to the normal siege speed; food shortages slow their work. Capitals and cities take longer than open country.

Each general chooses **wait** or **assault** through the controller, using a persistent temperament and an uncertain yearly estimate. The choice travels with the existing `orderArmy` command. Waiting builds progress without assault casualties. Once a season's siege work is done, an ordered assault on a town, city or capital may occupy it immediately. Its success is a weighted random roll using the army's actual size/morale and remaining resistance. Every assault costs 12% of the attacking army, including successful ones; failure also hurts morale. The war report records the result and its casualty total includes those losses.

Relief armies interrupt siege work. Progress recovers by 0.2 per season when there is no fit, unopposed besieger, including after all armies have disbanded. Low morale triggers the existing withdrawal rule. Only one besieger contributes work per cell per season, so allied stacks cannot count several seasons at once. A town's fall cannot automatically capture a neighboring capital.

Base `SIEGE_STEPS` increased from 0.3 to 0.5: on plain ground, the unmodified timer is 2.75 seasons for a city and 5.5 for a capital city. Actual duration depends on strength, supplies, relief and assaults. These numbers are initial settings, not historical duration claims.

## Supply

`sim/supply.ts` searches up to six cell links to unoccupied home/allied land. Routes pass through friendly-controlled cells; occupation overrides legal ownership. Hostile armies block the cells they stand in, and neutral land and water cannot carry supplies. An army's current hostile cell may be the endpoint of a route: a frontier siege can receive food without owning its target. Reinforcements require a connected position that is already friendly-controlled.

Without a route, an army forages from the local population, reduced by devastation and its size relative to the local population. Foraging covers at most half its needs. The remaining shortage multiplies troop attrition and a 0.06 seasonal morale loss; harsh terrain still doubles troop attrition. Hunger can therefore force withdrawal without a battle. Supplied armies recover morale only on unoccupied home/allied land, not in newly occupied territory.

This intentionally stops short of wagons, stored provisions, harvest seasons, garrison food inventories or a capital-connected depot network. Any unoccupied friendly territory can be a local source, including a detached province. Route length is cell links, not terrain travel time. Foraging uses current conditions; it does not separately deplete a stored food resource.

## Visible behavior and compatibility

The War Room shows supplied/cut-off status, morale, and siege progress with waiting/assault orders. Assault results appear among a war report's turning points. The observer sees actual conditions; generals still make uncertain decisions.

New armies save an optional `siegeMode`; old saves/orders without it wait until fresh orders are issued. Save format remains v13, and existing siege-progress arrays are reused. No new player micromanagement is required: AI and player armies use the same controller decisions. Same seed, settings and commands still reproduce history under this version; older histories intentionally develop differently after loading.

## Repeatable measurements

- `npm run balance -- tuning`: ten fixed `campaign-tuning-*` seeds.
- `npm run balance -- validation`: ten separate `campaign-validation-*` seeds, checked after choosing behavior.

Each run uses settled starts with ten kingdoms, a 320×180 map and 500 years. The report includes wars per century, duration, attacker victories among decided wars, no-winner endings, casualties, battles, territory changes, peak empire size and remaining realms. These tests are optional and skipped by normal `npm test`; the runner works on Windows, macOS and Linux.

The first candidate allowed morale recovery on supplied occupations. On tuning seeds, attacker victory share rose from 82.7% to 87.2%, and land taken rose sharply. Restricting recovery to unoccupied friendly territory brought attacker victory share back near the baseline. This adjustment used the tuning seeds; the separate validation set was then inspected.

[Raw paired measurements](../measurements/campaigns-2026-11-08.json) preserve every seed result. Validation means across ten worlds, before this patch → final version:

| Measure | Before | After |
|---|---:|---:|
| Main wars per century | 94.6 | 79.6 |
| Completed war duration, years | 5.34 | 4.80 |
| Attacker wins among decided wars | 83.0% | 84.3% |
| Endings with no winner (includes a side falling) | 30.1% | 25.8% |
| Casualties per completed war, simulation units | 8.85 | 12.96 |
| Transferred cells per century | 572.8 | 688.2 |
| Field battles per completed war | 16.67 | 14.94 |
| Largest empire reached, share of land | 24.8% | 30.3% |
| Living realms at year 500 | 18.7 | 13.6 |

This is an initial coarse tuning pass, not proof of improved overall balance. Assaults can speed conquest despite the longer passive timer; fewer, bloodier wars and larger empires result on these seeds. The prior 55–75% attacker-victory target remains unmet. Do not tune small percentage changes to these ten outcomes. Broaden to more seeds, larger settled maps and longer runs before a full balance pass. Golden tests separately cover a full-size 600-year open-start history and two small 1,000-year histories.

Focused tests cover cut routes, hostile occupation, route range, neutral/water barriers, foraging, morale recovery, weak besiegers, relief, abandonment, multiple besiegers, assault costs/outcomes, player parity and retreat. The earlier controller-isolation test was corrected to vary random draws while preserving choices: changing a declaration can legitimately affect distant allies, so equal distant war outcomes was not a valid test of dice independence.

## Safe exercise

In Settings → Armies, try `SIEGE_ASSAULT_RATIO = 6` instead of 3, then restart the same seed. Generals should choose waiting more often, although whole-history effects can vary. Restore 3 (or use Reset) to undo it. Change just this one value before comparing.

Final verification: 380 tests passed, two optional reports skipped by the normal suite (the campaign report was run separately for both sets); production build and whitespace checks passed. Existing save/load, player replay, randomized combat and golden-history checks passed. The browser preview showed supplied and cut-off armies, morale and a live assault siege without console errors.
