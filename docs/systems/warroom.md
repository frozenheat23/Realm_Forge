# War Room (M16)

> SPEC §5.4j, in its own file because SPEC.md is past the ~700-line limit in §9. Code: `sim/warRecords.ts`, `ui/warRoom.ts`, `render/warFocus.ts`. Decisions taken with the user on 2026-11-02 (decision log).

**Goal.** Make wars something you can follow: see which wars are on, pick one, watch it play out, and read what happened when it ends. Nothing about *how* wars are fought changes (that's M18), and history stays the same: the records only watch.

## War records (simulation, saved)

Until M16 a war forgot everything at peace, battles were kept for one year, and nothing counted casualties per war. Now every war that's declared gets a `WarRecord` in `WorldState.warRecords`, kept for the whole run and saved (format v10).

```ts
interface WarRecord {
  id: number;                    // the war's id
  attacker: NationId;
  defender: NationId;
  allies: { nation: NationId; side: "attack" | "defend"; year: number }[];
  goal: WarGoal;
  start: number;
  end?: number;
  scores: number[];              // the score at the end of each year (positive = attacker winning)
  battles: { year; cell; winner; loser; lost; routed }[];
  fallen: { attack: number; defend: number };   // soldiers lost by each side, allies included
  moments: { year; kind: "joined" | "rout" | "capital"; text }[];
  outcome?: { how: "goal" | "decisive" | "exhausted" | "too long" | "side fell"; winner?: NationId; raid: boolean; cells: number; wholeRealm: boolean; text: string };
}
```

- **One record per war, allies folded in.** A joined ally's own `support` war adds the ally to `allies`, and its battles and losses count for its side of the main war.
- **Where it's written:** `startWar` (new record, or an ally joining), `fight` in `battle.ts` (battles, routs), `loseSoldiers` (casualties, battles and attrition alike), `occupy` in `siege.ts` (a capital taken), and `endWars` (each year's score, then the outcome).
- **Read only by the screen.** The simulation never reads a record, so the golden history is unchanged by adding them.
- Size: about 350 wars and 4,000 battles over 1,000 years, a few hundred KB in a save.

## Smaller fixes

- A victory that took no land read *"X defeats Y, taking 0 provinces"*. Now: *"X defeats Y, but no land changes hands."* This changes event text, so the golden fingerprints are re-recorded.
- **Battles in the log** are folded into one line per war per year: *"⚒ Year 412: 3 battles between Kethar and Velmora (2,400 fell)."* They stay under the Battles filter.

## Side panel

On wide screens (≥ 1200 px) the page becomes two columns: the map with its toolbar on the left, a panel on the right that stays in view as you scroll. On narrow screens the panel drops below the map. The panel has three tabs.

- **Wars**: the wars going on now. Each row shows both sides (color swatches) and how many allies each has, the goal (and the city it's about), years so far, a score bar from the defender's win line to the attacker's, and soldiers fallen on each side. Click a row to follow it.
- **Past wars**: every war that has ended, newest first, sortable by length, by soldiers fallen, and by land that changed hands. Click one for its report.
- **Log**: the event log as before, with its filters.

## Following a war

- **On the map:**
  - Every nation outside the war is dimmed (the event-click highlight, held for as long as you follow).
  - Goal land the attacker hasn't taken yet is ringed in gold.
  - Land each side occupies carries a small mark in the occupier's color.
  - Armies and battle flashes show as usual.
- **Time:**
  - Playback slows to `FOLLOW_SPEED` years a second if it was faster, and goes back to its speed when you stop following.
  - It pauses when a capital falls, an army is routed, or the war ends.
- **The report** opens by itself when the war ends, and from Past wars at any time. It shows:
  - the two sides and their allies
  - the goal, the years it ran, and how it ended
  - battles won by each side
  - soldiers fallen (in men)
  - land that changed hands
  - its turning points
  - a small line of the score over the years
- **Stop** stops following. Following a war that's over just shows its report.

## Done when

- Every war has a record; records survive save and load; allies' battles and losses land on the right side.
- Golden history unchanged by the records (then re-recorded once for the new peace text).
- The panel lists current and past wars; following one dims the rest, marks goal and occupied land, slows time and pauses on the big moments; the report opens at peace.
- Tick no slower than before within noise; no console errors; tests for records, the peace text and battle folding.

## Not in M16

Zoom and pan (M19); changing how wars are fought (M18); clicking the map to pick a war; a timeline of all history.
