# Real war (M18)

> **Part 1 (misjudgment) and part 2 (underdog defense) built** 2026-11-07, designed with the user. Generals and choices inside a war come in a later part, measured with the Sandbox's odds (`docs/systems/sandbox.md`).

**Why.** The Sandbox's first odds showed that wars are decided before they start: in 4 of 5 real wars every one of 20 futures ended the same way. Nations see each other's strength exactly, and only the stronger side ever considers war, so they only pick fights they will win. Real rulers act on poor intelligence, pride and temper, and lose wars they were sure of.

## Part 1: misjudgment

Each year, when a nation weighs war on a neighbor (the AI's `declareWar`), it uses its **estimate** of the strength ratio instead of the true one:

```
estimate = true ratio × race confidence × ruler's boldness × this year's error
```

- **True ratio**: (my fighting power + allies' expected help) ÷ (theirs + their allies' expected help), as before.
- **Race confidence** (`confidence`, a race trait): how much the race overrates itself.
- **Ruler's boldness** (`Ruler.boldness`): rolled once when a ruler is crowned, between `e^-temper` and `e^+temper`, where `temper` is a race trait. Humans have the widest spread, so some human kings are warmongers and some are timid; Dwarves and Light Elves vary least.
- **This year's error**: a new "spy report" every year, between `e^-INTEL_ERROR` and `e^+INTEL_ERROR`, × `INTEL_FOREIGN` against a nation of another race (they know strangers less well).

The estimate replaces the true ratio in both places it was used:

1. **Who considers war.** Before: only the truly stronger side. Now: any side that *believes* it is stronger (estimate > 1). Both sides may believe it at once.
2. **How tempting war is.** War chance still grows with ratio ^ `WAR_STRENGTH_EXP`. So boldness also works as appetite: a ruler who thinks they're 1.5× as strong as they are starts about 2.5× as many wars.

Fighting appetite as such stays the existing race trait `aggression` (Orcs 1.6, Dark Elves 1.4, Humans 1, Dwarves 0.7, Light Elves 0.5). The new traits add misjudgment on top:

| Race | `confidence` | `temper` (boldness range) | Meaning |
|---|---|---|---|
| Humans | 1.0 | 0.6 (×0.55 – ×1.8) | Judge fairly on average, but rulers vary most: some warmongers |
| Light Elves | 0.9 | 0.25 (×0.78 – ×1.28) | Cautious and steady |
| Dark Elves | 1.15 | 0.5 (×0.61 – ×1.65) | Overrate themselves, and unpredictable |
| Dwarves | 0.9 | 0.2 (×0.82 – ×1.22) | Cautious and steady |
| Orcs | 1.25 | 0.3 (×0.74 – ×1.35) | Overrate themselves most: eager fights they sometimes lose |

**Only the decision is fooled.** Battles, sieges and peace use true strength, so a nation that misjudged pays for it.

**Dice.** The error rolls from the war choice's own stream (`war-<me>-<them>`). Boldness rolls from a fork named after the ruler (`temper-<house>-<name>-<year>`), so rulers' names and reigns don't change. A plain `fork("temper")` gave every ruler from one stream the same boldness, because a fork depends only on its name; a test caught it.

**Saves.** `Ruler.boldness` is saved (save format v12); v11 and v10 saves load with boldness 1.

### Targets

Measured on seeds never tuned on, against the old code on the same seeds:

- **Attackers lose more often.** Today they win nearly every war. In studies of real wars, the side that starts one wins roughly 60–70% of the time, so aim for attackers winning about 55–75% of the wars that end with a winner.
- **The Sandbox's odds split.** In wars of near-equals, futures should no longer all end the same way.
- **Within noise:** wars per century (retune `WAR_BASE_PROB` if more wars start), rebellions, peak empire, and the race balance (no race above ~46% of the land).

### New parameters

| Parameter | Start value | What it does |
|---|---|---|
| `INTEL_ERROR` | 0.7 (designed at 0.4) | Size of the yearly error in judging a rival (the estimate is off by up to ×0.5 – ×2) |
| `INTEL_FOREIGN` | 1.5 | × the error against a nation of another race |
| race `confidence` | see table | × the estimate |
| race `temper` | see table | Range of rulers' boldness |

### As built: what part 1 changed

Tuned on 10 seeds, checked against the old code on 2 more sets of 10 never tuned on (settled start, 1,000 years).

**Where it works.** Wars sorted by true strength when they began (4 tuning worlds, old → new):

| Attacker's true strength | Share of wars | Attacker wins | Defender wins |
|---|---|---|---|
| Weaker (< 0.8) | 0% → 2% | 47% → 16% | 0% → 48% |
| About even | 1% → 3% | 29% → 40% | 29% → 30% |
| Stronger (1.25–3×) | 8% → 14% | 66% → 58% | 5% → 8% |
| Much stronger (3×+) | 91% → 82% | 65% → 60% | 1% → 1% |

Weak realms now sometimes attack and usually pay for it, which never happened before.

**Where it can't help.** Nine wars in ten are a big realm against one a third its strength or less, and misjudgment doesn't change those. Overall, attackers still win 95% of the wars that end with a winner (97% before); defenders win 3% (2%). Even an error of ×4.5 left defenders at 5%. The rest are white peaces, and 72% of those end with the attacker ahead on score but short of `WIN_SCORE`. Most wars being decided at the start is a war-rules matter, for part 2: a defender scores only by battles and by occupying land, and defending armies mostly stay home.

**Side effects** (both unseen sets): wars per century 94 → 116 and 94 → 119. These are new wars between pairs that could never fight before (the weaker side never considered war), so `WAR_BASE_PROB` doesn't bring the number down: −20% left it unchanged. Rebellions, peak empire and tick time stayed within noise. Race balance: in one of 30 worlds Humans ended with 68% of the land (old code at most 51%). On the other two sets Humans averaged 20% and 15% (old 21% and 17%), so it looks like chance. The old code also crossed the ~46% line on these seeds (51%, 49%, 49%), but 68% is the furthest yet: worth watching in later balance checks.

## Part 2: underdog defense

**What was wrong.** Measured on 4 tuning worlds: 95% of wars ended because a side reached war weariness `WEARINESS_PEACE` (0.9), usually the defender, and then whoever was `WIN_SCORE` ahead won. Nations go into wars already tired (two in three defenders start above 0.3), white peaces lasted about a year, and a defender could only score by winning battles and occupying land. Driving an invader off was worth nothing: it ended in a white peace.

**Four rules:**

1. **Holding out scores.** Each year after the first in which the attacker holds none of what it came for (its goal cells; in a raid or an ally's war, any of the defender's land), the war's `heldOff` count grows and the score moves `HOLD_SCORE` toward the defender. A stalled invasion slowly turns into a defeat. The first year is free, for marching in.
2. **Defending homes tires slower.** A nation that is only defending (attacking no one) gains war weariness `DEFEND_WEARINESS` times as fast, both the yearly gain and the weariness from losses. So the attacker is more often the side that gives up.
3. **The invaded rally.** A nation defending in a war refills its reserve `RALLY_REFILL` times as fast.
4. **A beaten attacker pays.** A defender who wins takes `RAID_TRIBUTE` stability from the attacker (as a raid's winner does) and whatever it occupies. With no land the log reads *"Kethar drives off Velmora."* (was *"…defeats Velmora, but no land changes hands"*).

A home-ground bonus in battle already existed (`DEFENDER_BONUS` × terrain × the people's `defense`), so none was added.

| Parameter | Value | What it does |
|---|---|---|
| `HOLD_SCORE` | 10 | Score to the defender per year held off |
| `DEFEND_WEARINESS` | 0.25 | × weariness for a nation only defending |
| `RALLY_REFILL` | 2 | × `LEVY_REFILL` while defending |

`War.heldOff` is optional, so saves keep format v12 (a missing count is 0).

### As built: what part 2 changed

Tuned on 4 seeds (`HOLD_SCORE` 5–15, `DEFEND_WEARINESS` 0.25–0.5, `RALLY_REFILL` 1–4). Checked against part 1 on 2 sets of 10 seeds never tuned on (settled start, 1,000 years):

| | Part 1 | Part 2 |
|---|---|---|
| Attacker wins, of wars with a winner | 94%, 94% | 80%, 80% |
| Defender wins, of all wars | 4%, 3% | 14%, 14% |
| White peace | 41%, 39% | 26%, 26% |
| Wars per century | 106, 100 | 69, 70 |
| Rebellions per century | 8.3, 9.0 | 8.0, 8.6 |
| Average peak empire | 25%, 27% | 23%, 25% |
| Biggest race in any world | 48%, 57% | 55%, 50% |
| Tick (Node, one run alone) | 10.5 ms | 10.9 ms |

By true strength when the war began (4 tuning worlds, part 2):

| Attacker's true strength | Share of wars | Attacker wins | Defender wins |
|---|---|---|---|
| Weaker (< 0.8) | 4% | 11% | 65% |
| About even | 5% | 20% | 58% |
| Stronger (1.25–3×) | 19% | 42% | 28% |
| Much stronger (3×+) | 71% | 67% | 7% |

**Reached:** an attacker who can't take what it came for now loses, even a much stronger one (7% of 3×+ wars, was 1%). Near-equal wars now usually go the defender's way. Of 4 real wars run as 20 Sandbox futures, three now end differently in at least one future (18–2, 17–3, 19–1), and one still ends the same way in all 20. In part 1, 4 of 5 wars ended the same way in every future.

**Missed:** attackers still win 80% of decided wars, above the 55–75% target. Seven wars in ten are still a realm at least three times stronger, so the main lever left is who goes to war at all (part 3).

**Side effects:** wars fall by a third (about 103 → 70 a century; ~94 before part 1). Wars last longer now, and a nation fights at most `MAX_WARS_PER_NATION` at once, so fewer new ones start. Empire peaks are about 2 points lower. Rebellions and the race balance are within noise: both versions put one race above ~46% in some world.

## Next parts

- **Part 3: generals and choices in war.** Commanders, and choices such as suing for peace early or fighting on, so wars are less settled by who started them.
