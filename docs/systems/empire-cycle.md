# The empire cycle (scope)

> Linked from SPEC §8. Agreed with the user on 2026-11-11. **Scope only: nothing here is built, and no parameter is chosen yet.** It builds on [vassalage](vassalage.md) and takes up three items that doc left for later (breaking away after defeats, a fuller loyalty formula, slowly absorbing vassals).

**Goal.** The world should tell the story of great empires: one rises by conquest and vassals, peaks, and breaks into successor states, which may later be joined again. Today giants rise but rarely break (38% do), and the number of realms only climbs.

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

"Now" is the validation set on 2026-11-11 (`world-validation-cycle-baseline.json`; the tuning set in brackets where it differs much).

| Measure | Now | Target |
|---|---|---|
| Great empires (a crown above 25% of the land) per 1,000 years | 2.3 | 2–4 |
| Peak size, crown with vassals | 38% on average; 42% of worlds reach 40% | 40–60% of the land in most worlds |
| Years a great empire spends above 25% | 226 | 100–250 |
| Giants that break | 38% (tuning 49%) | 60–80% |
| Successor states from one breakup | 2.7 | 3–8 |
| Vassals that leave by revolt | 4% | about half |
| Vassals taken by another overlord | 40% | no target yet |
| Vassals swallowed or destroyed | 48% | no target yet |
| Realms alive | peak 36, lowest afterwards 28 | rises and falls between 8 and 30 |
| Independent crowns at years 250 / 500 / 1000 | 14 / 13 / 17 | no target yet |
| Attacker wins | 81% | 55–65% (helped by this, not solved by it) |

**What the first numbers say**
- The count of great empires and their length are already inside the target. The gap is in how they end.
- Almost no vassal leaves by revolt (4%). Nearly all are swallowed, or passed from one overlord to another in war.
- The realm count barely falls after its peak (36 → 28): the world fragments and never comes back together.

## Build order

1. **Breaking forces** (Part 1), one at a time, measuring after each. Golden histories re-recorded on purpose.
2. **Race styles** (Part 2): check each race against its row in the table; adjust traits only where a race doesn't fit.
3. **Reuniting** (Part 3).
4. **Player's warning signs** (Part 4).

The report's measures for this were added on 2026-11-11 (successor states, how vassals leave, realms and crowns over time; `tests/worldReport.ts`), so each step can be judged.

## Not in this scope

Fear coalitions against a giant, sub-vassals, levy shares, family trees, and ships.
