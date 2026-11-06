# Sandbox (M17)

> **Planned.** Designed 2026-11-06 with the user, who chose wars as the first god powers and "who wins this war / does this nation survive" as the first odds questions. Code will be `sim/sandbox.ts` (god commands and the command log), `sim/odds.ts` (futures) and `ui/sandbox.ts` (the tab). Where the build differs, "As built" at the end will say so.

**Goal.** Let you reach into a running history and change it, then ask how likely things are from here. Two parts:

1. **God powers.** Start a war between any two neighbors, or end a war now with a winner you pick or a white peace.
2. **Odds.** From the present moment, run about 20 possible futures with different dice and count what happens: who wins a chosen war, and whether a chosen nation survives the next N years and how big it ends up.

This is also the tool M18 (Real war) is tuned with: "the stronger side wins 9 times in 10" becomes something we can measure for one war, not only on averages over whole worlds.

## God commands

God commands are a second kind of command, next to the nation choices of M15. Like every command they go through the rules (`applyGodCommand` in `sim/sandbox.ts`), which check them and carry them out; the screen never changes the world itself.

| Command | What it does | Rules that still apply | Rules the gods may break |
|---|---|---|---|
| `godWar` { nation, target, goal } | `nation` goes to war on `target` with goal conquer, reclaim or raid. Allies are asked to join as for any declaration | Both alive, sharing a border, not already at war; the goal needs a claim (reclaim) or something to conquer | Truces, `MAX_WARS_PER_NATION`, and alliances (an alliance between them breaks) |
| `godPeace` { war, winner } | The war ends now. With a winner, peace is made as if the war had been won that way, by the usual peace rules: the winner keeps the goal land **it occupies** and up to `PEACE_EXTRA_CELLS` more it holds (the whole realm if it holds the capital), or takes tribute after a raid. Declaring a winner the day a war starts therefore moves no land. Without a winner, a white peace. Allies' joined wars end with it, and a truce follows | The war must be going on | Score, goals and willingness don't matter |

- The log tells it as the gods' doing: *"Year 412: by the will of the gods, Velmora goes to war with Kethar."*, *"Year 415: the gods impose peace: Kethar defeats Velmora, taking 6 provinces."*
- A war record (M16) ended this way has the outcome `how: "imposed"`.
- Allies' answers roll dice. Those come from a stream named after the year and the command's place in that year's log (`god-412-0`), so the same commands give the same history.

## The command log

- `WorldState.commands`: every god command with the year it was given, in order. Commands are given between years: after year Y's tick, before year Y + 1's.
- **History = seed + settings + command log.** Replaying from year 0 and applying each logged command after its year gives exactly the same history (a test checks this).
- Saved: save format **v11** adds the log. v10 saves still load, with an empty log.
- Nation choices made by the AI are never logged: they can always be worked out again from the seed.

## Odds: possible futures

`runFutures(snapshot, world, question, runs)` in `sim/odds.ts`:

1. Each future starts from a copy of the present (save data, so the real history is never touched).
2. Future 0 uses the real dice, so what will actually happen is one of the futures. Futures 1… use other dice: the sim stream of `"<seed>/future-k"`.
3. Each runs for `question.years` years (default `ODDS_YEARS`, 50), stopping early if it only asks about a war and that war has ended.
4. Counted:
   - **A war**: attacker wins, defender wins, white peace, or still going at the end; average land taken and years it lasted. Allies' joined wars count as part of their main war, as in the War Room.
   - **A nation**: survives or not; its size at the end compared with now (average and range); in how many futures it is the biggest nation at the end.
5. Runs a year at a time and pauses between chunks, so the page stays responsive and can show progress. 20 futures × 50 years takes about 10 seconds.

Only `ODDS_RUNS` (20) and `ODDS_YEARS` (50) are new parameters. Twenty futures can tell 90% from 50%, not 55% from 50%; that's said next to the result.

**Why the rule dice don't need separating first.** M15 left battles and spreading on shared streams, so one choice can shift unrelated rolls far away. For odds that doesn't matter: each future is meant to be a different roll of everything.

## The Sandbox tab

A fourth tab in the side panel, after Wars, Past wars and Log:

- **Start a war:** pick a nation, then one of its neighbors, then a goal (goals it can't have are greyed out with the reason), then "Declare". Refusals show the rules' reason.
- **End a war:** pick a current war, then "Attacker wins", "Defender wins" or "White peace".
- **Odds:** pick a war and/or a nation and a number of years, then "Run 20 futures". Shows a progress bar, then the counts as small bars: *"Velmora wins 14 of 20 (70%), Kethar 4, white peace 2; on average 7 provinces change hands after 5 years."* *"Kethar survives 50 years in 11 of 20 futures; ends at 40–160 cells (now 120); the largest nation in 2."*
- Time pauses while the tab acts.

## Build order

Each step ends with the full test suite green.

1. **God commands and the log.** `sim/sandbox.ts`, the peace code in `endWars` split into a function both use, `WorldState.commands`, save v11, the replay test. The golden history must not change (no commands = the same history).
2. **Odds.** `sim/odds.ts` with tests: same inputs give the same odds; future 0 matches the real history; a war of 3 against 1 is won by the stronger side in most futures.
3. **Sandbox tab.** `ui/sandbox.ts`, the event lines, checked in the browser.
4. **Check and docs.** Measure one or two real wars' odds, PARAMS, glossary, decision log.

## Not in M17

Rulers, unrest and army god powers (later, same pattern); comparing futures with and without a command side by side; world-wide odds; running futures in a Web Worker (only if 10 seconds turns out to be too slow); playing a nation (M20).
