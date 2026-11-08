# Realm Forge

A fantasy world simulator that runs in your browser. It generates a continent, then watches kingdoms rise, go to war, rebel and collapse over a thousand years, played back as a timelapse.

A hobby project, built as a way to learn TypeScript.

## What it does

- 🗺️ **Generates a world** from a seed: mountains, rivers, forests, deserts, coastlines, drawn as an old parchment chart
- 👑 **Simulates history** year by year: five races, kingdoms, wars with marching armies, alliances, rebellions, cultures, faiths, rulers and dynasties
- 🎬 **Plays it back** with speed controls, zoom, an event log and a War Room to follow any war
- 🧙 **Sandbox:** start or end wars as a god and see the odds of possible futures
- 🛡️ **Play as a nation:** pick a realm, give orders and set policies for 1,000 years
- 🔁 **Repeatable:** the same seed always produces the same history

## Run it

**Play it now, with nothing to install:** https://frozenheat23.github.io/Realm_Forge/

To run it from the code instead, you need [Node.js](https://nodejs.org/) (LTS version).

```bash
git clone https://github.com/frozenheat23/Realm_Forge.git
cd Realm_Forge
npm install
npm run dev
```

Then open the link shown in the terminal (usually http://localhost:5173). Add `?seed=anything` to the address for a different world. Press **Space** to play/pause, **→** to step a year, scroll to zoom, and hover to inspect. The side panel has the War Room, the log, the Sandbox and the **Play** tab. **Save / Load / Record** keep a history or export a video.

Run the tests with:

```bash
npm test
```

## Progress

Milestones M0–M20 are built: terrain, nations, war, races, diplomacy, armies, culture and faith, rulers, the parchment map, the War Room, the Sandbox, zoom and playing as a nation. Details are in [`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/).

## Built with

TypeScript · Vite · Canvas 2D · simplex-noise · d3-delaunay · Vitest

## Inspiration

- *Fantasy Map Simulator* (Steam)
- [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator)
- [Red Blob Games](https://www.redblobgames.com/) articles on map generation

## Credits

Parchment map lettering: IM Fell English and IM Fell English SC by Igino Marini, under the SIL Open Font License 1.1, through Fontsource.
