# Controllers and commands (M15)

> **Built in M15.** This is SPEC §4.16, in its own file because SPEC.md is past the ~700-line limit in §9. M15 adds no new parameters. Code: `sim/ai/controller.ts`, `sim/ai/default.ts`, `sim/commands.ts`, and an `apply…` function next to each rule (`applyDeclareWar` in `war.ts` and so on). Where the build differs from the design below, "As built" at the end says so.

**Goal.** Separate the **rules** of the world from the **choices** nations make, so that later a player can make one nation's choices (M19) without the simulation being rewritten. Today about twenty choices are random rolls woven through `war.ts`, `warGoals.ts`, `armies.ts`, `diplomacy.ts`, `rebellion.ts` and `faith.ts`. After M15 every one of them is asked of the nation's **controller**, and the answer comes back as a **command** that the rules check and carry out.

M15 is a refactor. It adds nothing new to watch. Steps 1–4 leave history *exactly* as it is; step 5 changes it once, on purpose, so that one nation's choices can't shift another nation's dice.

## Principles (agreed 2026-11-02)

1. **Every nation choice goes through a controller.** The AI controller is today's logic, moved. A player controller (M19) will answer from the UI instead.
2. **Choices become commands.** A controller returns a command ("declare war on Kethar to reclaim"); the rules validate it and apply it. Later, a history is *seed + the commands that didn't come from the AI*: that gives saves, replays and "what if I'd done X".
3. **Nothing changes the world except the rules.** Controllers only read the world. The UI will only issue commands.
4. **Decisions are strategic.** Over 1,000 years a player can't micromanage. Controllers decide goals, alliances and where a campaign goes; armies carry it out on their own.
5. **Same rules and same information for everyone.** No controller gets hidden bonuses. The player sees what the AI sees.
6. **A player plays a people, not just a state** (M19). Measured 2026-11-02 on 4 worlds: half of starting nations are dead by year 1000 (48 of 96), but 71% still have their culture ruling somewhere. When your realm falls you carry on as your culture's rebels, a reborn realm, or your dynasty's next seat.

## Rules vs choices

Only **nation choices** move. Anything that isn't a decision someone takes stays a rule.

| Choice (moves to the controller) | Today | Rules that still apply around it |
|---|---|---|
| **Declare war**, and on whom | `declareWars`: the side with more power rolls `warChance` | Not at war, allied, in a truce or at `MAX_WARS_PER_NATION`; must share a border |
| **War goal** | `chooseGoal`: reclaim if there's a claim, else raid by chance, else conquer | Goal cells are worked out by the rules (`claimedCells`, `conquestCells`) from the goal picked |
| **Join an ally's war** | Roll `ALLY_DEFEND_PROB` / `ALLY_ATTACK_PROB` | Must be a helper (§4.5) |
| **Form an alliance** | Roll `ALLIANCE_PROB` when opinion ≥ `ALLIANCE_MIN_OPINION` | Both sides must agree; `MAX_ALLIES`; not at war with each other |
| **Break an alliance** | Automatic when opinion < `ALLIANCE_BREAK_OPINION` | — |
| **Accept peace** when the goal is reached or the score is decisive | Automatic | Exhaustion (`WEARINESS_PEACE`) and `MAX_WAR_YEARS` still **force** peace: those are rules |
| **Mobilize**: how much of the reserve to raise for a war | `MOBILIZE_SHARE` | Reinforcement (`REINFORCE_RATE`) stays a rule |
| **Campaign orders**: what each army goes for | The target ladder in `direct()` (§4.13), minus retreat | Retreat below `RETREAT_MORALE` and routs stay rules (soldiers flee whatever the king says); pathfinding, marching, battles, sieges unchanged |
| **Crush a revolt** | Roll `REBEL_WAR_PROB` | `MAX_WARS_PER_NATION` |
| **Adopt a faith** | Roll `FAITH_ADOPT` once another faith holds `FAITH_MAJORITY` | Only offered when that majority exists |

**Staying rules:** battle rolls, expansion into empty land, culture and faith spreading, revolts starting, succession and civil wars, great rulers, collapse and annexation, emergence, unrest and everything in §4.11. Nobody *chooses* to have a rebellion.

Note: today only the **stronger** side of a pair ever considers war. That's an AI habit, not a rule. After M15 the rules allow either side to declare; the AI controller keeps the habit, so history doesn't change.

## The interface

One plain interface, one function per choice. No plugin system.

```ts
interface Controller {
  declareWar(view: View, me: Nation, target: Nation, why: WarContext, rng: Rng): WarGoal | null;
  joinWar(view: View, me: Nation, friend: Nation, enemy: Nation, side: "attack" | "defend", rng: Rng): boolean;
  proposeAlliance(view: View, me: Nation, other: Nation, rng: Rng): boolean;
  acceptAlliance(view: View, me: Nation, other: Nation): boolean;
  keepAlliance(view: View, me: Nation, other: Nation, idleYears: number, rng: Rng): boolean; // idleYears = since they last fought a shared enemy
  acceptPeace(view: View, me: Nation, war: War, reason: "goal" | "decisive"): boolean;
  suePeace(view: View, me: Nation, war: War, rng: Rng): boolean;     // M18: losing side offers terms
  acceptTerms(view: View, me: Nation, war: War, rng: Rng): boolean;  // M18: winning side takes them
  mobilize(view: View, me: Nation, wars: War[]): number[];                     // soldiers for each war without an army
  orderArmy(view: View, army: Army, orders: ArmyOrders): CellId;             // NO_TARGET = stand still; orders.reach(cell) checks a cell can be reached
  refused?(command: Command, reason: string): void;                          // told when the rules turn a command down
  crushRevolt(view: View, me: Nation, rebels: Nation, rng: Rng): boolean;
  adoptFaith(view: View, me: Nation, faith: FaithId, rng: Rng): boolean;
}
```

- **`View`** is the world as a controller may see it: `Readonly<WorldState>` for now, plus the yearly lookups the rules already compute (claims, border prizes, helpers' power), so controllers don't recompute them. A controller must never change it.
- **Context objects** (`WarContext`, `ArmyOrders`) carry what the decision needs: the power ratio, whether there's a claim, the border prize, nearby hostile armies, open goal cells. Built by the rules, read by the controller.
- **Synchronous and pure.** A controller answers immediately from the view and its own `rng`. A player's answers will come from orders and standing policies set beforehand, with the game pausing when a decision is due (M19). M15 doesn't design that, but it mustn't rule it out.
- **Who controls whom** is passed to `tick(state, rng, controllers)` as a function `NationId → Controller`, defaulting to the AI for every nation. It isn't stored in `WorldState` (functions can't be saved). Since M20 step 1 the default is `controllersOf(state)` (`sim/ai/player.ts`), which reads the saved `WorldState.player` and gives that nation the player's controller.

## Commands

Every answer becomes a command, and only the rules carry it out: each rule file has an `apply…` function for its commands, and `applyCommand(state, command)` is the one door for callers outside the yearly steps. It **validates** first, using today's rules (you can't declare war during a truce, join a war you can't reach, raise more soldiers than your reserve…), and returns why it refused.

```ts
type Command =
  | { kind: "declareWar"; nation: NationId; target: NationId; goal: WarGoal }
  | { kind: "joinWar"; nation: NationId; war: number; side: "attack" | "defend" }
  | { kind: "formAlliance"; a: NationId; b: NationId }
  | { kind: "breakAlliance"; nation: NationId; other: NationId }
  | { kind: "mobilize"; nation: NationId; war: number; size: number }
  | { kind: "orderArmy"; army: number; target: CellId }
  | { kind: "crushRevolt"; nation: NationId; rebels: NationId }
  | { kind: "adoptFaith"; nation: NationId; faith: FaithId };
```

The AI's commands never fail (it only asks for what the rules already allow), so a refused AI command is a bug and the tests treat it as one. M15 doesn't record commands: AI commands can always be worked out again from the seed. The **command log** arrives with the first input that isn't the AI (M17 Sandbox), together with a save-format bump.

## Dice

Today each step rolls from one stream in a fixed order (`declare`, `diplomacy`, `campaign`…). If a player skipped one roll, every later roll in that step would shift, and wars between unrelated nations on the far side of the map would change. That would make "what if" comparisons meaningless.

So in **step 5**, each decision rolls from its own fork, named after who decides and about whom, e.g. `year-412 / declare / 7-12`, `alliance / 3-9`, `crush / 7-31`, `faith / 7`. Then a choice only changes what actually depends on it. History changes once, here, and the balance numbers are measured again.

## Folder layout

```
src/sim/ai/controller.ts   the Controller interface, View, context types
src/sim/ai/default.ts      the AI: today's logic, moved (warChance, goal choice, joining, alliances, peace, mobilizing, the army ladder, revolts, faith)
src/sim/commands.ts        Command type and applyCommand (each rule file validates and applies its own commands)
src/sim/marching.ts        read-only map questions for armies (paths, march rights, targets), shared by rules and AI
```

The rule files keep the rules: `war.ts` still starts and ends wars, `warGoals.ts` still works out goal cells and terms, `armies.ts` still marches, `battle.ts`, `siege.ts` and the rest are untouched.

## Build order

Each step ends with the full test suite green.

0. **Golden history.** Before moving anything, record a fingerprint (a hash of every event's text) of 1,000 years on 3 seeds into `tests/golden.test.ts`. The existing determinism test only compares the code with itself; this one compares it with the code *before* the refactor.
1. **Interface and commands.** `controller.ts`, `commands.ts` with validation and tests for each refusal. Nothing calls them yet.
2. **War choices.** Declaring, goals and allies joining go through the controller and `applyCommand`. Golden history unchanged.
3. **Everything else that's yearly.** Alliances, peace, mobilizing, crushing revolts, faith. Golden history unchanged.
4. **Campaign orders.** The `direct()` ladder moves into the AI as `orderArmy`; retreat and routs stay in `armies.ts`. Golden history unchanged.
5. **Separate dice.** Per-decision forks. The golden fingerprint is recorded again, and the balance checks re-run.

## Tests

- **Golden history** (steps 0–4): fingerprints match exactly.
- **Refusals**: each rule `applyCommand` checks has a tiny-map test (declare during truce, join while at war limit, mobilize more than the reserve, order an army to water…).
- **A peaceful world**: every nation on a `Passive` controller (never declares, never crushes revolts) → no war is ever declared in 1,000 years, and rebellions still happen.
- **Isolation** (step 5): one year run twice from the same state, once with nation X made passive. Declarations between nations that aren't X and don't border X are identical.
- **AI never refused**: over 1,000 years, `applyCommand` refuses no AI command.

## Done when

- Every choice in the table goes through a controller; no choice rolls are left in the rule files.
- Steps 1–4 leave the golden history identical on all 3 seeds.
- After step 5, measured on the 5 review seeds against the 2026-11-02 review: wars per century (~35), attacker win share (~77%), median war length (~4 years) and peak empire share (~26%) are within noise, and the 10-seed race balance check passes.
- Tick time no more than 10% slower.
- The `Passive` and isolation tests pass.
- Docs: SPEC §4.16 links here; CLAUDE.md milestone row and decision log; glossary (interface, command, golden test, dependency passing).

## As built

- **Interface changes.**
  - `mobilize` returns the number of soldiers for each war, not a share, so the AI can keep raising the same share of the year's starting reserve for each war.
  - An alliance is `proposeAlliance` (which may roll) plus `acceptAlliance` (which doesn't), so asking both sides costs no extra dice.
  - An optional `refused(command, reason)` tells a controller when the rules turn it down. Later this is how a player hears "you can't do that".
- **Peace has no command.** `acceptPeace` is a yes/no answered inside the peace step (6b), because peace terms need that year's final score. A sandbox "force peace" comes in M17. In M18 a losing side can also sue for peace: `suePeace` and `acceptTerms` are asked in the same step, and an accepted offer becomes the `suePeace` command (like an alliance, proposed then accepted).
- **Controllers are a required parameter of the rule steps.** `tick(state, rng, controllers = everyoneAI)` defaults to the AI, but `declareWars`, `endWars`, `musterArmies`, `campaign`, `updateAlliances`, `convertRealms`, `rebellions` and `succession` all take the controllers explicitly. So the rule files never import the AI, and the AI can read any rule file without a circular import. Tests pass `everyoneAI`.
- **Files moved.** The read-only map questions armies need (`findPath`, `marchRights`, `homeCell`, `nearestHostile`, `goalCell`…) moved from `armies.ts` to a new `marching.ts`; `frontCells` moved to `helpers.ts`; `warChance` and the goal choice (`chooseGoal`) moved to the AI. Old import paths still work where tests used them.
- **Dice (step 5).** Each choice now rolls from its own stream: `war-<me>-<them>`, `join-<ally>-<friend>-<enemy>`, `alliance-<a>-<b>`, `faith-<nation>`. Crushing a revolt already had its own stream per uprising. **Rule dice still share streams**: battles (one stream per season), expansion, and the spread of culture and faith. A choice that changes the map can therefore still shift rolls far away within a few years. Isolate those too in M17 if the sandbox's odds need it.

**Measured.**
- **Steps 1–4:** golden history identical on all 3 seeds.
- **Step 5 vs the review**, on its 5 seeds: wars per century 35.1 → 34.6, attacker wins 77% → 80%, median war 4 → 4 years, peak empire 26% → 30%.
- **Within noise.** On other seeds the numbers swung more (e.g. 26.7 → 36.7 wars per century). But simply renaming the *old* code's random stream gives 36–38 on those seeds, so that swing is how chaotic the history is, not a change in the odds. First draws of forked streams were checked separately: they're uniform, and the same pair's draws don't correlate year to year.
- **Race balance:** biggest race 43%, no takeovers.
- **Speed:** a 600-year full-size run takes 8.3 s, against 8.6–9.1 s before M15.

## Not in M15

Any player UI or player controller; the command log and saves (M17); AI personalities per race or ruler (easy once this exists: a different `Controller`); new behaviors such as the weaker side declaring war or suing for peace early; choosing where to settle empty land (expansion stays a rule for now).

## Roadmap this serves

| | Milestone | What |
|---|---|---|
| M15 | Controllers | This file |
| M16 | War Room | Panel of current wars (goal, score, casualties), follow a war on the map, war report at peace, fix "taking 0 provinces", tidy the battle log |
| M17 | Sandbox | God-mode commands (start or end a war, move an army, crown a ruler); command log and saves; replay from a save with different seeds to show odds |
| M18 | Real war | Generals (from ruler types), stronger underdog defense, maybe a second army per side; tuned with the sandbox's odds |
| M19 | Map zoom | Zoom and pan, labels and markers included (added 2026-11-02, from the War Room talk) |
| M20 | Play as a nation | Start screen (race, nation or custom realm), auto-pause on decisions, orders and standing policies, "play a people" succession, legacy score at year 1000 |
