# Rulers and dynasties (M13)

> **Built in M13, except golden ages**, which are designed below but left for later. This is SPEC §4.15, in its own file because SPEC.md is past the ~700-line limit in §9. Numbers are in `PARAMS.md` → "Rulers and dynasties". Code: `gen/rulers.ts`, `sim/rulers.ts`, `sim/succession.ts`.

**Goal.** Give history people. Every nation has a named ruler from a named dynasty. A few rulers are great, and they bend history while they live. The bigger payoff is their death: an empire held together by one person falls into a succession crisis. That feeds the core loop directly, and gives us a believable way to build a giant empire and to break it.

Plague and famine are not part of this. They stay in the backlog (SPEC §8).

## What's stored

| Where | Field | Meaning |
|---|---|---|
| Nation | `ruler: Ruler` | Who rules now |

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

**At each succession:** pick one of the five types evenly, then the ruler is great with chance `GREAT_RULER_CHANCE × the race's number for that type × (1 + area / GREAT_AREA)`. Otherwise they're ordinary, and an ordinary ruler has no type or effect. A nation's founder is always ordinary, and so are the rulers a world starts with.

The size term was added in tuning: great rulers used to be spread evenly, so they rarely sat on the thrones of giants, and a giant's fate had nothing to do with them.

| | Conqueror | Lawgiver | Builder | Prophet | Schemer |
|---|---|---|---|---|---|
| Humans | 1 | **3** | 1 | 1 | 1 |
| Orcs | **3** | 0.5 | 0.5 | 1 | 0.5 |
| Dwarves | 0.5 | 1 | **3** | 0.5 | 0.5 |
| Light Elves | 0.5 | 1 | 1 | **3** | 1 |
| Dark Elves | 1 | 0.5 | 0.5 | 1 | **3** |

The rows don't average the same (Humans 1.4, Orcs and Dwarves 1.1), which the race balance check watches.

Because the chance is per ruler, reign length changes the feel, not the share of time. Orcs get many short-lived warlords; elves get one in an age who rules for generations.

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
       × (1 + area / CRISIS_AREA)
       × (the dead ruler was great ? CRISIS_GREAT : 1)
```

Big realms are the ones that break, and a great ruler leaves a much worse hole than an ordinary one. The design first used how far a nation was over `adminCap`, but young nations' caps are so large that almost nobody was ever over.

3. **What a crisis does.** The nation loses `CRISIS_STAB_HIT` stability. If it holds at least `CIVIL_WAR_MIN_AREA` cells it also falls into **civil war**: pretenders rise, one for every `CIVIL_WAR_CELLS_PER_SPLIT` cells, up to `CIVIL_WAR_MAX_SPLITS`. Each takes a region of up to `CIVIL_WAR_SHARE` of the land, grown by the existing rebellion `floodFill` from a restless cell, so it follows culture and province lines. A piece is a new nation like any revolt (`uprising()`: soldiers defect, fallen realms can return) and may fight at once, as with `REBEL_WAR_PROB`.

So a great empire can shatter into warring successor states, the way Alexander's did.

**Race traits.** `reign` is the average years on the throne, rolled between 0.5 and 1.5 × that. `succession` scales the crisis chance.

| Race | `reign` | `succession` | Why |
|---|---|---|---|
| Humans | 25 | 1.0 | The baseline |
| Light Elves | 120 | 0.5 | Long lives, orderly courts |
| Dark Elves | 80 | 1.2 | Long lives, poison at every feast |
| Dwarves | 60 | 0.4 | Clans and law, the calmest |
| Orcs | 15 | 2.0 | The strongest takes the throne |

A nation's first ruler has no heir question. A nation that dies takes its ruler with it.

## Golden ages (not built)

Left for later by choice. They'd need `peaceSince`, `goldenUntil?` and `declineUntil?` on each nation, and `GOLDEN_*` and `DECLINE_*` numbers (guesses: `GOLDEN_PEACE_YEARS` 30, `GOLDEN_MIN_STABILITY` 0.8, `GOLDEN_CHANCE` 0.01, `GOLDEN_RULER_BONUS` 3, `GOLDEN_YEARS` 50, `GOLDEN_DEV` 1.5, `GOLDEN_STAB` 1.25, `DECLINE_YEARS` 30, `DECLINE_STAB` 0.5, `DECLINE_CAP` 0.75).

A golden age is earned, not random. It would run right after Stability as step **3b** (`sim/goldenAge.ts`).

**Starts.** Each year, a nation with no golden age or decline, at peace for `GOLDEN_PEACE_YEARS`, with stability at least `GOLDEN_MIN_STABILITY` and at least one city, starts one with chance `GOLDEN_CHANCE` (× `GOLDEN_RULER_BONUS` under a great Lawgiver or Builder). It lasts `GOLDEN_YEARS`.

**During.** `DEV_GROWTH` × `GOLDEN_DEV`, `STAB_RECOVERY` × `GOLDEN_STAB`.

**Ends.** When its years run out, or early if stability falls below `GOLDEN_MIN_STABILITY` − 0.3. Then comes **decline** for `DECLINE_YEARS`: `STAB_RECOVERY` × `DECLINE_STAB` and `adminCap` × `DECLINE_CAP`.

Decline is essential. We already have a problem with old mid-size nations settling comfortably, and a golden age with no cost would make that worse.

## Map, log and UI

- **Crown** over the capital while a great ruler lives, drawn with the labels (`CROWN_*` in `render/palette.ts`).
- **Log**, new filter "Rulers", event type `ruler`: *"Warlord Grukk rises in Zogrimnar."*, *"High Queen Selena of Velmora dies after 31 years."*, *"Civil war tears Kethar apart."* Ordinary successions aren't logged, or they'd bury everything else.
- **Hover** shows the ruler, title, dynasty and years on the throne.
- **Settings** gets a Rulers section. Race tables stay in `gen/params.ts`, like faiths.
- **Save format v9.** v8 saves are refused with a message.

## What stays out

Regnal numbers, rulers dying in battle, marriages between dynasties, a family tree, a ruler changing a nation's faith by decree, personal traits on ordinary rulers, and any plague or famine.

## What it gives

Measured on 20 seeds never used for tuning, each 1,000 years, against the same seeds before M13:

| Check | Target | Before | After | |
|---|---|---|---|---|
| Great rulers per run | 30–80 | 0 | 69 | Met |
| Alive at once | Usually 1–3 | 0 | 2.2 on average, 6.3 at most | Met |
| Civil wars per run | 10–30 | 0 | 10.9 | Met |
| Worlds reaching 25% / 40% of the land | More at 40% than before | 55% / 5% | 55% / 5% | **Missed**: unchanged |
| Average biggest empire at its peak | | 28% | 27% | |
| A giant stays over 25% | | ~200 years | ~130 years | Costs: shorter |
| Giants' falls within 30 years of a great ruler's death | ≥ 1 in 3 | | About 1 in 5 (0.1 of 0.5 a run) | **Missed**, and too few giants to be sure |
| Realm conversions per run | Above before | 3.8 | 5.8 | Met, but see the Prophet below |
| Wars per century | Within ~25% | 55 | 66 | Met (+20%) |
| Rebellions per century | Within ~25% | 4.0 | 5.5 | **Over** (+37%; civil war pieces count as rebellions) |
| Realms reborn per run | | 12.8 | 25.4 | |
| Owned land at unrest ≥ 0.9 at year 1000 | No worse | 35.6% | 32.7% | Met |
| Tick, one at a time | < 10 ms | 8.3 ms | 8.6 ms | Met |
| Biggest race, 10-seed balance check | < 45% | 42% | 41% | Met |

(The 35.6% unrest figure counts only year 1000; the 22.5% in §4.14 counted differently, so don't compare the two.)

- **Conquerors don't make giants.** Even at power × 2 and war chance × 3, the peak hardly moved. A reign is short and real empires take centuries, so the great rulers add story more than they change how large empires get. Reaching 40–70% more often needs a different lever.
- **Leave-one-out** (20 tuning seeds, each switched off in turn). The Conqueror matters most: without them rebellions fall 23%, wars 9%, and no world reached 50%. No type swings rebellions or peak empires by more than a quarter. Builder, Lawgiver, Prophet and Schemer differences are within noise in these overall numbers. Each one's own effect is shown by unit tests.
- **The Prophet** doesn't show a measured rise in realm conversions: 6.2 a run with them, 6.8 without. Conversions rose after M13 for other reasons, most likely more nations changing hands.
