# Realm Forge

A fantasy world simulator that runs in your browser. It generates a continent, then watches kingdoms rise, go to war, rebel and collapse over a thousand years, played back as a timelapse.

> 🚧 Early development. Built as a hobby project and as a way to learn TypeScript.

## What it does (planned)

- 🗺️ **Generates a world** from a seed: mountains, rivers, forests, deserts, coastlines
- 👑 **Simulates history** year by year: nations expand, fight wars, make peace, split apart and fall
- 🎬 **Plays it back** with play / pause / speed controls, a year counter and an event log
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

Then open the link shown in the terminal (usually http://localhost:5173). Add `?seed=anything` to the address to get a different world, `?style=painted` for the painted look, or `?style=atlas` for the parchment map (also on the **Parchment map** button). Press **Space** to play/pause, **→** to step a year, **C** to see the cells, **N** to hide/show nations, and hover to inspect a cell. Open **Settings** to tune the simulation live, click an event to highlight its nations, and use **Save / Load / Record** to keep a history or export a video.

Run the tests with:

```bash
npm test
```

## Progress

- [x] M0 · Project setup
- [x] M1 · Terrain
- [x] M2 · Cells and biomes
- [x] M3 · Starting nations
- [x] M4a · Growth
- [x] M4b · Rebellion and collapse
- [x] M5 · War
- [x] M6 · Polish (speed controls, video export, save/load)

## Built with

TypeScript · Vite · Canvas 2D · simplex-noise · d3-delaunay · Vitest

## Inspiration

- *Fantasy Map Simulator* (Steam)
- [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator)
- [Red Blob Games](https://www.redblobgames.com/) articles on map generation

## Credits

Parchment map lettering: IM Fell English and IM Fell English SC by Igino Marini, under the SIL Open Font License 1.1, through Fontsource.
