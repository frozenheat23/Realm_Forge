# The empire cycle (scope)

> Linked from SPEC §8. Agreed with the user on 2026-11-11. **Part 1, item 1 is built (2026-11-16, see "As built"); the rest is scope only.** It builds on [vassalage](vassalage.md) and takes up three items that doc left for later (breaking away after defeats, a fuller loyalty formula, slowly absorbing vassals).

**Goal.** The world should tell the story of great empires: one rises by conquest and vassals, peaks, and breaks into successor states, which may later be joined again. Today giants rise but under half of them break (47%), and few vassals ever leave by revolt.

**What the user chose**
- Large empires that conquer and then break, and vassals that rebel, over a quiet balance of many kingdoms.
- A broken empire may be put back together later.
- Dwarves stay the stable survivors for now; they need no great empires.
- Realistic, but fun to play: a collapse must be something you saw coming and could act on.

## Part 1: what breaks an empire

1. **Vassals rebel at moments of weakness.** Today a vassal may declare independence only in the year its overlord's ruler is crowned. Add more moments: the overlord has just lost a war, its stability is low, or it is busy with a war elsewhere.
2. **Vassals rebel together.** When one vassal declares independence, the others under the same crown may join it, so there is one war of independence with several rebels. (Today they must stay out.)
3. **Size strains the crown.** Vassal land adds nothing to overextension today. Count a share of it, so a wider empire is a shakier one.
4. **Ruling other peoples costs more as the empire grows.** The cost of foreign subjects already exists (`FOREIGN_K`, unrest ÷ tolerance). Check that it bites at empire size, and let a vassal of another race or faith be less loyal.

## Part 2: each race builds a different empire

Mostly from traits the races already have (aggression, cohesion, tolerance, reign, fickleness).

| Race | How it rises | How it falls |
|---|---|---|
| Orcs | Fast, by annexing | Shatters when a strong ruler dies |
| Humans | Conquest and vassals mixed | Bad successions and leagues of vassals |
| Dark Elves | Vassals held by fear | Vassals turn at any weakness |
| Light Elves | Slowly, a long hegemony over vassals | Rarely, in one great crisis when a very old ruler dies |
| Dwarves | Seldom expand; very hard to conquer | They usually outlast the empires around them |

Long elven reigns stay as they are: once Part 1 is in, vassals no longer wait 120 years for a coronation.

## Part 3: putting an empire back together

- A realm that once held a broken empire's land keeps a **claim** on it (claims exist today, but lapse after `CLAIM_YEARS`). A longer-lasting "imperial claim" would make reconquest likelier.
- Dead realms already return under their old name and color when their people rebel. The same idea can let a successor state take up the old empire's name once it holds enough of the old land.
- Open question: whether a restored empire gets anything beyond the name (for example, former vassals submitting more readily).

## Part 4: fun for the player

- **Warning signs**, using the same numbers the AI uses: a crown-strain figure for an overlord, and a loyalty figure for each vassal.
- **A game on both sides.** As a vassal: wait and pick the moment to rebel, or join another's revolt. As an overlord: choose between annexing and taking vassals, and see which vassals are close to leaving.
- **Race as play style**: Orcs fast and fragile, Elves slow and steady, Dwarves defensive.
- Every choice still goes through a controller, so the AI and the player follow the same rules.

## Targets (measured with `npm run report`)

"Now" is the validation set on 2026-11-16, after step 1 (`world-validation-cycle1.json`). "Before" is 2026-11-15, with 7,000 cells and tidy borders (`world-validation-tidy7000.json`).

| Measure | Before | Now | Target |
|---|---|---|---|
| Great empires (a crown above 25% of the land) per 1,000 years | 3.3 | 3.2 | 2–4 |
| Peak size, crown with vassals | 50%; 79% of worlds reach 40% | 47%; 79% of worlds reach 40% | 40–60% of the land in most worlds |
| Years a great empire spends above 25% | 274 | 251 | 100–250 |
| Giants that break | 47% | 47% | 60–80% |
| Successor states from one breakup | 3.1 | 2.9 | 3–8 |
| Vassals that leave by revolt | 8% | 16% | about half |
| Vassals taken by another overlord | 27% | 26% | no target yet |
| Vassals swallowed or destroyed | 50% | 48% | no target yet |
| Realms alive | peak 25, lowest afterwards 17 | peak 25, lowest afterwards 16 | rises and falls between 8 and 30 |
| Independent crowns at years 250 / 500 / 1000 | 12 / 9 / 12 | 13 / 11 / 13 | no target yet |
| Attacker wins | 74% | 74% | 55–65% (helped by this, not solved by it) |

**What the numbers say**
- Step 1 doubled the vassals that leave by revolt (8% → 16%), still far from half. Most are still swallowed or passed between overlords.
- Giants break no more often than before (47%). A vassal leaving does not break the crown's own land; that needs items 3 and 4 (size strains the crown, foreign subjects cost more).
- The count and size of great empires stay inside their targets.

## Build order

1. **Breaking forces** (Part 1), one at a time, measuring after each. Golden histories re-recorded on purpose.
2. **Race styles** (Part 2): check each race against its row in the table; adjust traits only where a race doesn't fit.
3. **Reuniting** (Part 3).
4. **Player's warning signs** (Part 4).

The report's measures for this were added on 2026-11-11 (successor states, how vassals leave, realms and crowns over time; `tests/worldReport.ts`), so each step can be judged.

## As built

**Step 1: vassals rebel at moments of weakness (2026-11-16).** Code: `weakMoment` in `sim/independence.ts`; numbers in PARAMS → "Vassals".

- **Four moments.** A vassal may declare independence while its overlord has a new ruler (as before), lost a war of its own in the last `HUMBLED_YEARS` (a nation's new `humbled` year), has stability below `WEAK_STABILITY`, or is at war with someone else. Another vassal's rising counts as a war elsewhere, so risings tend to come together (a cheap stand-in for item 2).
- **The AI's chance** is `INDEPENDENCE_CHANCE × dislike × strength` at a coronation, and `INDEPENDENCE_WEAK_CHANCE × dislike × strength` in each year of the other moments.
- **A rising must be put down.** Found by measuring: with the moments alone, risings rose from 4.2 to 6.7 a century on the tuning set (10.8 at five times the chance) while victories stayed at 2.8, because a lone vassal rarely beats its overlord outright. So a rising that ends with no clear winner now frees the vassal (`RISING_HOLD_SCORE` 30); only an overlord that clearly wins keeps it.
- **A truce** after a failed rising now stops the vassal declaring again until it ends.
- **Player:** the Play tab's button works in all four moments and names the reason; a dispatch tells of a coronation or a lost war.
- **Measured** on the validation set (never tuned on): revolts 8% → 16% of vassals, wars of independence won 2.8 → 7.0 per world, average service 108 → 88 years, wars a century 42 → 47, peak crown 50% → 47%, worlds reaching 50% of the land 50% → 29%, giants breaking 47% → 47%. Tuning set: revolts 10% → 23%. `INDEPENDENCE_WEAK_CHANCE` 0.3 and 0.8 gave the same revolt share on the tuning set, so the lower stays.
- Golden histories re-recorded on purpose.

## Not in this scope

Fear coalitions against a giant, sub-vassals, levy shares, family trees, and ships.
