# Play as a nation (M20)

> **Planned** 2026-11-07, designed with the user. **Step 1 built** 2026-11-07 (the player's controller, orders and log, no screen yet: see "As built" at the end); steps 2–6 still planned. Builds on controllers (`controllers.md`), the command log (`sandbox.md`), the War Room (`warroom.md`) and zoom (SPEC §5.4l).

**Goal.** Pick a nation and play its 1,000 years. You make its strategic choices; the same rules as everyone else decide what happens. When your realm falls, you carry on with your people.

## Decisions, agreed with the user

| Question | Choice |
|---|---|
| How decisions work | **Orders and standing policies.** You give orders while paused, between years. Questions that come up during a year are answered by policies you set beforehand. The game pauses afterwards to tell you what happened. |
| How hands-on war is | **Strategy only.** You choose wars, goals, how many soldiers to raise and when to sue for peace. Armies march and fight on their own, as the AI's do. |
| When your realm falls | **You choose who to follow** from the living realms of your people. |
| Score | **None.** The story is the point; the War Room and the log tell it. |

Principles kept from M15 (`controllers.md`): the player sees what the AI sees and plays by the same rules, and every choice becomes a command the rules check.

## Why orders and policies

A year runs in one go (`tick`), asking each nation's controller its questions as they come up: "join your ally's war?" is asked the moment the ally is attacked. The year can't stop halfway to wait for a click. So:

- **Proactive choices are orders**, given while paused and carried out at once through `applyCommand`, as Sandbox god commands are now. The player's controller never starts these on its own.
- **Reactive choices are policies**: the player's controller answers from the policy the player set. Afterwards the game pauses on the result ("Velmora was attacked; you joined, as your policy says") so the player can respond with orders.

## The player's controller (`sim/ai/player.ts`)

| Controller question | The player's answer |
|---|---|
| `declareWar` | Never by itself: wars come from the **Declare war** order |
| `joinWar` (an ally is attacked, or attacks) | Policy **Join allies' wars**: always / only defending / allies of my race / never |
| `proposeAlliance` | Never by itself: the **Propose alliance** order |
| `acceptAlliance` | Policy **Accept alliances**: when opinion is good (the AI's rule) / always / never |
| `keepAlliance` | Always: the player ends pacts with the **Break alliance** order |
| `acceptPeace` (war won) | Policy **When a war is won**: make peace (the AI's rule) / fight on for more |
| `suePeace` (losing) | Policy **Sue for peace**: never by itself / when war-weary (≥ 0.6) |
| `acceptTerms` (the enemy sues) | Policy **Enemy sues**: accept / accept when weary / refuse |
| `mobilize` | Policy **Raise for a new war**: 25% / 50% / 80% (the AI's) / 100% of the reserve |
| `orderArmy` | The AI's orders (strategy only) |
| `crushRevolt` | Policy **Rebels break away**: fight them / let them go |
| `adoptFaith` | Never by itself: when another faith holds the realm, the game pauses and offers it as an order |

Each policy starts at the AI's own behavior, so a nation whose player does nothing behaves much like an AI nation, but with fixed answers instead of dice.

## Orders (all while paused)

| Order | Command | Notes |
|---|---|---|
| Declare war on a neighbor, with a goal | `declareWar` (exists) | Buttons show why a goal isn't allowed, as in the Sandbox (`godWarRefusals`) |
| Sue for peace in a losing war | `suePeace` (exists, M18) | The enemy's controller decides whether to accept, at once |
| Propose an alliance | `formAlliance` (exists) | Only if the other side's controller accepts (`acceptAlliance`), at once |
| Break an alliance | `breakAlliance` (exists) | |
| Adopt the faith most of the realm holds | `adoptFaith` (exists) | Only while that faith is offered |
| Change a policy | new `setPolicy` | Policies change answers, so they are logged too |

**The command log** (M17) gains player orders and policy changes, with the year and `by: "player"`. History is still seed + settings + command log: replaying a save gives the same history. Save format v13: the played nation, the people (culture) being followed, and the policies.

## Screens

1. **Choosing a nation.** A **Play** tab beside Wars, Past wars, Log and Sandbox: pick a race, then one of its living nations (name, land, ruler). You can take over at year 0 or at any later year; "Stop playing" goes back to watching.
2. **Your realm** (the Play tab once playing): ruler card, land, people, soldiers and reserve, stability, war weariness, unrest, allies and rivals, your wars (with War Room scores), the order buttons, and the policies.
3. **On the map:** your realm's border drawn heavier, and a click on a neighbor while choosing a war target picks it (zoom helps here).
4. **Dispatches.** The game pauses, and a note says what happened, when:
   - war is declared on you, or an ally calls you (and what your policy did);
   - a battle is lost badly, a capital is besieged or falls;
   - a war of yours ends, or an enemy sues;
   - your ruler dies, a succession crisis or civil war starts, or a revolt breaks away;
   - an alliance is offered, formed or broken; a faith is offered;
   - your realm falls.
   Each kind can be switched off.

## When your realm falls

The game pauses and lists living realms of your **people** (your culture): rebels and sister states of your culture, and a reborn realm. You pick one to carry on as; your policies come with you. If your culture rules nowhere, it lists realms of your **race**, or you stop playing and watch. Measured in M15: half of starting nations die by year 1000, but 71% still have their culture ruling somewhere.

## Build order (one commit each)

1. **Player controller and policies** in `sim/` (no screen yet), the `setPolicy` command, player orders in the command log, save v13. Tests: with no player the golden history is unchanged; a played nation with default policies plays out a full run; replaying a save's log gives the same history.
2. **Choosing a nation and the Your realm panel**, with your realm marked on the map.
3. **Orders**, with reasons when one isn't allowed.
4. **Dispatches and auto-pause.**
5. **Following your people** when your realm falls, and a short end-of-run summary at year 1000 (what became of your realms, no score).
6. **Playtest pass**, docs and the M20 decision log.

## Done when

You can pick a nation at year 0, play it to year 1000 with orders and policies, get paused on what matters, carry on after your realm falls, save and load in the middle, and the AI-only history is unchanged.

## Not in M20

Directing armies yourself, fog of war, a score, custom realms at the start, diplomacy beyond alliances (vassals, tribute deals), and an AI that treats the player differently.

## As built

**Step 1** (2026-11-07). Code: `sim/ai/player.ts` (the controller `PLAYER`, `POLICY_CHOICES`, `defaultPolicies`, `controllersOf`), `sim/play.ts` (orders), `tests/play.test.ts`.

- **Who plays** is `WorldState.player` (`{ nation, culture, policies }`), set only by the **play** order, saved in save format v13 (v12 still loads, with no one playing). `controllersOf(state)` reads it each time it's asked, so `tick`, the Sandbox and odds futures all use the player's controller for the played nation with no extra wiring; with no player it is the AI for everyone, and the golden history is unchanged.
- **Orders** are `PlayerCommand`s given through the same `giveCommand` as god commands, logged with `by: "player"`. Their dice (allies joining a declared war, the enemy hearing terms) come from streams named `player-<year>-<n>`. A refused order changes nothing and isn't logged. Orders: `play` (a living nation, or null to stop), `setPolicy`, `declareWar`, `suePeace`, `proposeAlliance`, `breakAlliance`, `adoptFaith`.
- **Policy names in the code:** `joinWar` (always / defending / kin / never), `acceptAlliance` (opinion / always / never), `wonWar` (peace / fightOn), `suePeace` (never / weary), `enemySues` (accept / weary / refuse), `mobilize` (a share of the reserve, above 0 and at most 1), `rebels` (fight / letGo). "Weary" means war weariness ≥ `PLAYER_WEARY` (0.6). Defaults: defending, opinion, peace, weary, weary, `MOBILIZE_SHARE`, fight.
- **Orders given at year 0** (before the first year) are logged at year 0, so a replay applies the log once before the first tick, then after each year.
- **Measured** (3 worlds × 1,000 years, settled start, first kingdom played, no orders): attacked 1–13 times, never attacked anyone except its own rebels; one of the three fell (year 406).
