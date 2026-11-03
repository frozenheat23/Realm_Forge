# Settled start: old kingdoms (M16b)

> SPEC §3.8b, in its own file because SPEC.md is past the ~700-line limit in §9. Decided with the user on 2026-11-02. Code: `gen/kingdoms.ts` (drawing the kingdoms), `sim/start.ts` (`createWorld`, ageing them). Numbers in `PARAMS.md` → "Starting nations".

**Goal.** Open history on a world that's already full: 5 to 10 old kingdoms share all the land anyone can live on, with towns, cities, settled peoples and long-held borders. The first centuries are the story of these empires and how they break apart, instead of empty land filling up.

## Choosing a start

- **Settled, 5–10 kingdoms** (`START_KINGDOMS`, default 10): the new default.
- **Open land**: the old start (24 small nations in an empty world), kept for comparison.

Picked in the toolbar and kept in the page address (`?start=8`, `?start=open`). The choice only changes year 0; the map itself is the same for a seed either way. Saves hold the whole state, so loading needs nothing extra.

## Drawing the kingdoms (generation)

1. **Capitals.** Each race has 2 homelands (§4.10), 10 in all. Every race gets one kingdom; the races take turns in a random order (stream `kingdoms`), each picking its homeland farthest from the kingdoms already placed, and the remaining kingdoms (`START_KINGDOMS − 5`) go to the spare homelands the same way. Each capital is the habitable cell nearest its homeland point, then:
   - it never stands within `KINGDOM_SPACING` steps of another capital, nor on a body of land smaller than `KINGDOM_MIN_LAND` cells (no kingdom starts on a speck of an island);
   - it shifts toward land its race likes (`START_HOME_RANGE`), as in the open start;
   - then up to `KINGDOM_ROOM` steps toward open country (the most land around it), so none starts at the tip of a peninsula.
2. **Land.** The kingdoms share the land out **one cell per round, in turn**, each taking the cell cheapest to reach from its own land (travel cost: biome, mountains, rivers). Terrain shapes the borders, since cheap land goes first, but a kingdom boxed in on a peninsula keeps pace with the rest instead of being left with a scrap. Land that holds nobody (ice) stays empty, as does land no capital can reach over land (islands); new nations can rise there later.
3. **Peoples (mixed).** Each cell's people are the race of the nearest homeland, whoever rules it. A great kingdom that spans another race's homeland already holds subject peoples.
4. **Cultures.** Each cell's culture is that of the nearest kingdom of its people's race. So people living under a kingdom of another race, or of other kin, already belong elsewhere: that's where revolts will come from.
5. **Faiths.** Each cell's faith comes from its people's homeland, as today; each kingdom holds the faith of its capital.
6. **People** fill `SETTLED_POP_FRACTION` of what each cell can hold.
7. **Old.** Every cell has been held for `OLD_REALM_YEARS`, so it's core land from the first year.

## Ageing them (simulation, before year 1)

- **Development** = `SETTLED_DEV` × the kingdom's control of the cell: high around the capital, thin at the far edges.
- **Settlements** follow from it by the usual thresholds: villages, towns, and cities at least `CITY_MIN_SPACING` apart, each city named. No "grows into a city" events for these: they were always there.
- Unrest and devastation start at 0; rulers are partway through their reigns, as today.
- The log opens with one line per kingdom: *"Year 0: Kethar, an ancient realm of Humans, holds 412 provinces."*

## Done when

- The toolbar offers Open land and 5–10 kingdoms, and the choice survives New world and Random.
- With the settled start every habitable cell reachable over land belongs to a kingdom; every race has at least one; realms hold subject peoples.
- Measured on 5 seeds × 1,000 years (10 kingdoms): the first breakup of each old empire (rebellion or civil war) mostly falls between year 100 and 300; history keeps moving after that (wars, nations alive comparable to the open start by year 500). 10-seed race balance holds.
- The open start, `generateWorld` and the golden history are unchanged.

## As built (2026-11-02)

- **Borders.** First tried: all kingdoms racing outward by travel cost, with each race's own terrain costs. Dwarves swept the mountains (up to 1,279 cells) and capitals near another homeland, on a peninsula or on a small island were left with 1–76 cells. Without race terrain costs it was still uneven. Taking turns one cell per round, with the spacing, land and open-country rules for capitals, gives 10 kingdoms of about 250–600 cells (one boxed-in realm of 76 on one seed); 5 kingdoms of about 500–1,400.
- **Development.** `SETTLED_DEV` × control gives most land towns and 20–35 cities at year 0. That matches a mature world: an open start at year 400 has towns on 60–75% of its land and 65–71 cities.
- **Measured** on 5 seeds × 1,000 years, 10 kingdoms:
  - **First breakup** of each old kingdom (a rebellion or a civil war): 10% by year 58, 25% by 130, median 238, 75% by 670. 8 of 50 never break up. The old empires are durable: 3–6 of the 10 are still alive at year 1000.
  - **Wars** declared per century (crushing revolts included): 87–129, against 44–86 for the open start on the same seeds. A full world fights more.
  - **Nations alive at 1000:** 19–36, against 19–29 for the open start.
  - **10-seed race balance:** biggest race 46% (Orcs, one seed), no takeovers.
- **Possible tuning later:** if the long-lived empires feel too permanent, the knobs are succession crises for big realms (`CRISIS_AREA`, `CIVIL_WAR_MIN_AREA`), or start them further from perfect (lower `START_STABILITY` or `SETTLED_DEV`).
