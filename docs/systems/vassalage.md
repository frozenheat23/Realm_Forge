# Vassalage (v1)

> Linked from SPEC §8. Agreed with the user on 2026-11-09: start with the simplest version that lets realms join under one crown and fall apart again, then add more after playtesting. Code: `sim/vassals.ts` (who serves whom), `sim/independence.ts` (breaking free). Numbers in `PARAMS.md` → "Vassals".

**Goal.** Today, holding an enemy capital at peace swallows the whole realm, so the world consolidates: ~14 realms are left at year 500 on settled starts. A vassal keeps its own land and ruler but serves an overlord, so empires can grow wide but loosely held, and break apart along their seams.

## The rules

1. **One field.** Each nation has an `overlord` (none = independent). The vassal keeps its land, ruler, army, culture and faith; none of its land counts toward the overlord's area, control or unrest. One level only: a vassal has no vassals of its own.
2. **One way in: submitting at peace.** A winner who holds the loser's capital at peace no longer takes the whole realm. It takes the land peace terms give it as usual (never the capital), and the loser becomes its vassal.
   - If the loser had vassals, they go free.
   - The loser's alliances end.
   - A winner that is itself a vassal still takes the whole realm, as before (one level only).
3. **Three duties.**
   - A vassal can't declare wars or make alliances. (It can still crush its own rebels.)
   - Overlord and vassal fight beside each other: a vassal joins its overlord's wars, and the overlord defends its vassal. This is a rule, not a choice: they join whenever the rules for allies joining allow it (bordering the enemy or the friend, under the war limit).
   - Realms under one crown (the overlord and its vassals) never fight each other. Wars between them end quietly when one submits.
   - Armies of the same crown may march and resupply through each other's land, as allies' do.
4. **Two ways out.**
   - **A new ruler on the overlord's throne.** In the year an overlord's ruler is crowned, each of its vassals may declare independence. The AI's chance is `INDEPENDENCE_CHANCE × (1 − opinion) / 2 × min(1, vassal's power / overlord's power)`: likelier the more it dislikes its overlord and the stronger it is. The player decides by an order, in the same year only.
     - That starts a war of independence (goal `independence`, no goal land). Other vassals of the same crown stay out of it; the overlord's allies may join.
     - If the vassal wins, it is free. Otherwise (lost or white peace) it stays a vassal. No land changes hands either way.
     - A vassal that no longer borders its overlord simply goes free when it declares.
   - **The overlord falls.** Its vassals are free at once.
5. **Shown simply.** A vassal keeps its own color, with a band in its overlord's color inside its borders. Hover says "vassal of …". The log has "submits to", "declares independence", "wins its independence" and "goes free".
6. **Player.** If your realm submits, you play on as a vassal. When your overlord's crown passes, a dispatch pauses the game and the Play tab offers "Declare independence" until the year ends.

New tick step **7c**, after Succession: vassals of fallen overlords go free; then vassals whose overlord has a new ruler may declare independence.

Saves: `overlord` is an optional field of a nation, so v13 saves still load (everyone independent).

## Later (not in v1)

A levy share for the overlord; choosing annex or vassalize; asking for protection; breaking away after defeats and crises; a fuller loyalty formula; slowly absorbing vassals; a "Banners" map layer; a settled start with vassals.

## Build order

1. The relationship, its map band and hover: nothing creates vassals yet, so history is unchanged (golden test passes).
2. Submission at peace, duties, and step 7c's independence and freeing; the player's order and dispatch. Golden histories re-recorded on purpose.
3. Measure on tuning and validation seeds (settled start, 10 kingdoms, 500 years): realms alive at year 500 (13.6 before), share of land held by vassals, how long vassals serve, attacker win rate (84% before), race balance.

## Done when

- Rules 1–6 work and are tested: no cycles, one level only, no wars or alliances inside a crown, vassals freed when their overlord falls, saves and replays still match, the player and AI follow the same rules.
- More realms survive to year 500 than before; vassals serve for decades, not forever; attacker wins don't rise.

## As built (2026-11-09)

- Built as planned, in `sim/vassals.ts` (questions: `overlordOf`, `vassalsOf`, `sameCrown`, `crownPartners`; changes: `becomeVassal`, `setFree`) and `sim/independence.ts` (step 7c and the `declareIndependence` command). Submission happens in `takeLand` (`warGoals.ts`); wars of independence end in `concludeIndependence` (`war.ts`). `friendsOf` and `friendly` (`diplomacy.ts`) add the crown to allies for joining wars, marching, supply and liberating land.
- One rule added while building: an army that occupies its own crown's land frees it, as allies' armies do.
- Map: a 3-pixel band (`VASSAL_BAND_WIDTH`) inside a vassal's borders in its overlord's color, on the nation tint only. Log filter "Vassals" (♔). Play tab: "Overlord" and "Vassals" rows, a "Declare independence" button, and a "vassal" dispatch.
- **Measured** (settled start, 10 kingdoms, 320×180, 500 years; [raw](../measurements/vassals-2026-11-09.json)), against the same seeds before vassals (`campaigns-2026-11-08.json`, "final"):

| Measure | Tuning before → after | Validation before → after |
|---|---:|---:|
| Realms alive at year 500 | 15.2 → 23.1 | 13.6 → 22.1 |
| Attacker wins among decided wars | 82.5% → 83.9% | 84.3% → 84.2% |
| Wars per century | 76.8 → 79.9 | 79.6 → 70.4 |
| Land changing hands per century (cells) | 656 → 278 | 688 → 257 |
| Biggest single realm, share of land | 26% → 19% | 30% → 18% |
| Biggest crown (overlord + vassals) | — → 27% | — → 30% |
| Submissions per century | — → 11.6 | — → 10.2 |
| Wars of independence per century | — → 1.3 | — → 1.1 |
| Vassals at year 500 (their share of land) | — → 10.6 (17%) | — → 10.3 (19%) |
| Average years a vassal served (finished services) | — → 49 | — → 53 |

  More realms survive, crowns grow as large as single empires did, and vassals serve for decades, not forever. Most services end when the overlord falls or another realm takes the vassal; wars of independence are rarer. Attacker wins didn't move (vassals don't change who picks fights). No parameter was tuned: `INDEPENDENCE_CHANCE` stays 1.
- **Cost:** with ~60% more realms alive, a full-size year takes ~15–19 ms instead of ~11 ms (more borders, wars and army paths; the profile shows no vassal code among the hot spots). The default test time limit went from 5 to 30 seconds (`vite.config.ts`), since tests that take ~1.5 s alone tripped 5 s when the whole suite runs at once.
- Golden histories re-recorded on purpose.

