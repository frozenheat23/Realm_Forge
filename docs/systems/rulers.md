# Rulers and dynasties (M13)

> **Planned, not built.** Design for SPEC §4.15. It has its own file because SPEC.md is past the ~700-line limit in §9. Numbers are in `PARAMS.md` → "Rulers and dynasties" and are starting guesses until tuned. Code will be in `sim/rulers.ts`, `sim/goldenAge.ts` and `gen/rulers.ts`.

**Goal.** Give history people. Every nation has a named ruler from a named dynasty. A few rulers are great, and they bend history while they live. The bigger payoff is their death: an empire held together by one person falls into a succession crisis. That feeds the core loop directly, and gives us a believable way to build a giant empire and to break it.

Plague and famine are not part of this. They stay in the backlog (SPEC §8).

## What's stored

| Where | Field | Meaning |
|---|---|---|
| Nation | `ruler: Ruler` | Who rules now |
| Nation | `peaceSince` | Year its last war ended (golden ages need a long peace) |
| Nation | `goldenUntil?` | Last year of its golden age |
| Nation | `declineUntil?` | Last year of the decline that follows |

```ts
interface Ruler {
  name: string;
  dynasty: string;      // "House Varrin"
  female: boolean;
  crowned: number;      // year
  ends: number;         // year the reign ends, rolled at coronation
  great?: RulerType;    // only great rulers have a type
}
```

The end of a reign is rolled once, at coronation, instead of a yearly chance of death. It needs no yearly dice for each nation, and it can be read back in the hover info and tests. Year-0 rulers start partway through their reign, so nations don't all change rulers together.

## Great rulers

Five types, in the `RULER_TYPES` table (`gen/params.ts`, next to `RACES`). No type belongs to one race, but each race is much more likely to produce one of them.

**At each coronation:** pick one of the five types evenly, then the ruler is great with chance `GREAT_RULER_CHANCE × the race's number for that type`. Otherwise they're ordinary, and an ordinary ruler has no type or effect.

| | Conqueror | Lawgiver | Builder | Prophet | Schemer |
|---|---|---|---|---|---|
| Humans | 1 | **3** | 1 | 1 | 1 |
| Orcs | **3** | 0.5 | 0.5 | 1 | 0.5 |
| Dwarves | 0.5 | 1 | **3** | 0.5 | 0.5 |
| Light Elves | 0.5 | 1 | 1 | **3** | 1 |
| Dark Elves | 1 | 0.5 | 0.5 | 1 | **3** |

At 0.05 that's about 1 ruler in 18 being great. The rows don't average the same (Humans 1.4, Orcs and Dwarves 1.1), which the race balance check must watch.

Because the chance is per ruler, reign length changes the feel, not the share of time. Orcs get many short-lived warlords; elves get one in an age who rules for generations. A nation is under a great ruler about 5–7% of the time whatever its race.

**What each does, while alive.** All are multipliers read through one helper, `greatBonus(nation, type)`, which returns 1 for everyone else (the same pattern as `blessing()`).

| Type | Effect |
|---|---|
| **Conqueror** | Army power × `GREAT_CONQUEROR_POWER`, war chance × `GREAT_CONQUEROR_WAR` |
| **Lawgiver** | `adminCap` × `GREAT_LAWGIVER_CAP`, `UNREST_DECAY` × `GREAT_LAWGIVER_CALM` on its land |
| **Builder** | `DEV_GROWTH` × `GREAT_BUILDER_DEV` |
| **Prophet** | Spread of the nation's faith × `GREAT_PROPHET_SPREAD`, at home and across its borders |
| **Schemer** | Its most hated neighbor (lowest opinion) loses `GREAT_SCHEMER_STAB` stability a year |

The Prophet is also our best hope for realm conversions, which sit at 4.8 a run against a target of 10.

## Titles and gender

Gender changes a ruler's title and name only, never their power. Each race has its own `femaleChance`: Humans and Light Elves 0.5, Dark Elves 0.8 (the Hollow Mother's people lean toward matriarchs), Orcs and Dwarves 0 for now, with one title each.

| Race | Ordinary | Conqueror | Lawgiver | Builder | Prophet | Schemer |
|---|---|---|---|---|---|---|
| Humans | King / Queen | High King / High Queen | Great King / Great Queen | Builder King / Builder Queen | Prophet / Prophetess | Spymaster / Spymistress |
| Light Elves | Lord / Lady | Sun Lord / Sun Lady | High Lord / High Lady | Spire Lord / Spire Lady | Sage-King / Sage-Queen | Veiled Lord / Veiled Lady |
| Dark Elves | Lord / Matriarch | Shadow Lord / Shadow Queen | Dread Lord / Dread Lady | Deep Lord / Deep Lady | Voice / Voice of the Mother | Patron / Matron |
| Orcs | Chief | Warlord | Lawspeaker | Hall-Raiser | Doomcaller | Whisper-Chief |
| Dwarves | Thane | War Thane | Lawkeeper | Mountain King | Rune Father | Vault Thane |

Personal names come from new short lists for each race and gender, and dynasty names from the existing name generator (`gen/rulers.ts`). Regnal numbers ("Aldric III") stay out.

## Succession

Runs as new tick step **7b**, after Rebellion and before Collapse, so a piece too small to live dissolves the same year. For each nation whose ruler's reign has ended:

1. **Heir.** With chance `HEIR_CHANCE` the same dynasty continues. Otherwise a new dynasty takes over and the nation loses `DYNASTY_STAB_HIT` stability.
2. **Crisis.** Whichever happened, a crisis strikes with chance:

```
chance = CRISIS_BASE × succession (race trait)
       × (1 + overreach × CRISIS_OVERREACH_K)
       × (the dead ruler was great ? CRISIS_GREAT : 1)

overreach = max(0, area / adminCap − 1)
```

The nation that outgrew what it can rule is the one that breaks, and a great ruler leaves a much worse hole than an ordinary one.

3. **What a crisis does.** The nation loses `CRISIS_STAB_HIT` stability. If it holds at least `CIVIL_WAR_MIN_AREA` cells it also falls into **civil war**: pretenders rise, one for every `CIVIL_WAR_CELLS_PER_SPLIT` cells, up to `CIVIL_WAR_MAX_SPLITS`. Each takes a region of up to `CIVIL_WAR_SHARE` of the land, grown by the existing rebellion `floodFill` from a restless cell, so it follows culture and province lines. A piece is a new nation like any revolt (`rebelHeritage`, soldiers defect, fallen realms can return) and may fight at once, as with `REBEL_WAR_PROB`.

So a great empire shatters into warring successor states, the way Alexander's did. New states have vigor, which means a successor could rebuild fast. We want to see that, but must check it doesn't undo the split every time.

**Race traits.** `reign` is the average years on the throne, rolled between 0.5 and 1.5 × that. `succession` scales the crisis chance.

| Race | `reign` | `succession` | Why |
|---|---|---|---|
| Humans | 25 | 1.0 | The baseline |
| Light Elves | 120 | 0.5 | Long lives, orderly courts |
| Dark Elves | 80 | 1.2 | Long lives, poison at every feast |
| Dwarves | 60 | 0.4 | Clans and law, the calmest |
| Orcs | 15 | 2.0 | The strongest takes the throne |

A nation's first ruler has no heir question. A nation that dies takes its ruler with it.

## Golden ages

A golden age is earned, not random. It's the last step of the build, and runs right after Stability as step **3b** (`sim/goldenAge.ts`).

**Starts.** Each year, a nation with no golden age or decline, at peace for `GOLDEN_PEACE_YEARS`, with stability at least `GOLDEN_MIN_STABILITY` and at least one city, starts one with chance `GOLDEN_CHANCE` (× `GOLDEN_RULER_BONUS` under a great Lawgiver or Builder). It lasts `GOLDEN_YEARS`.

**During.** `DEV_GROWTH` × `GOLDEN_DEV`, `STAB_RECOVERY` × `GOLDEN_STAB`.

**Ends.** When its years run out, or early if stability falls below `GOLDEN_MIN_STABILITY` − 0.3. Then comes **decline** for `DECLINE_YEARS`: `STAB_RECOVERY` × `DECLINE_STAB` and `adminCap` × `DECLINE_CAP`.

Decline is essential. We already have a problem with old mid-size nations settling comfortably, and a golden age with no cost would make that worse.

## Map, log and UI

- **Crown** over the capital while a great ruler lives, drawn with the labels (`GREAT_CROWN_*` in `render/palette.ts`). A faint gold ring round the capital during a golden age.
- **Log**, new filter "Rulers", event type `ruler`: *"Warlord Grukk rises in Zogrimnar."*, *"High Queen Selena of Velmora dies after 31 years."*, *"Civil war tears Kethar apart."*, *"Velmora enters a golden age."*, *"Velmora's golden age fades."* Ordinary successions aren't logged: at about 120 a century they'd bury everything else.
- **Hover** shows the ruler, title, dynasty and years on the throne.
- **Settings** gets a Rulers section. Race tables stay in `gen/params.ts`, like faiths.
- **Save format v9.** v8 saves are refused with a message.

## What stays out

Regnal numbers, rulers dying in battle, marriages between dynasties, a family tree, a ruler changing a nation's faith by decree, personal traits on ordinary rulers, and any plague or famine.

## Build order

One commit each:

1. Rulers, dynasties and names, hover info, save v9. Nothing reads them yet, so history stays the same (same event hash).
2. Succession, crisis and civil war, with ordinary rulers only.
3. The five great types and their effects.
4. Crown, log filter and Settings.
5. Golden ages and decline.
6. Retune and run the full check.

## Done when

Tune on one set of seeds, then measure 20 seeds never tuned on, over 1,000 years, against **the same seeds** on the code before M13.

| Check | Target |
|---|---|
| Great rulers per run | 30–80 |
| Great rulers alive at once | Usually 1–3 |
| Civil wars per run | 10–30 |
| Worlds reaching 40% of the land | Above the 25% before M13 |
| Giants (over 25%) that fall apart within 30 years of a great ruler's death | At least 1 in 3 |
| Realm conversions per run | Above 4.8 |
| Golden ages per run | 5–15 |
| Rebellions, wars | Within about 25% of before |
| Land at unrest ≥ 0.9 | No worse than the 22.5% before |
| Biggest race (10-seed balance check) | Under 45%, no takeovers |
| Tick | Under 10 ms |

Each great type must also pass a leave-one-out run: switching it off changes what it should, and no single type swings rebellions or peak empires by more than a quarter (this is what caught Order at 1.3 in M12).
