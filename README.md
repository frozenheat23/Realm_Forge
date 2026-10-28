# Realm Forge

A fantasy world simulator that runs in your browser. It generates a continent, then watches kingdoms rise, go to war, rebel and collapse over a thousand years, played back as a timelapse.

> 🚧 Early development. Built as a hobby project and as a way to learn TypeScript.

## What it does (planned)

- 🗺️ **Generates a world** from a seed: mountains, rivers, forests, deserts, coastlines
- 👑 **Simulates history** year by year: nations expand, fight wars, make peace, split apart and fall
- 🎬 **Plays it back** with play / pause / speed controls, a year counter and an event log
- 🔁 **Repeatable:** the same seed always produces the same history

## Run it

You need [Node.js](https://nodejs.org/) (LTS version).

```bash
git clone https://github.com/frozenheat23/Realm_Forge.git
cd Realm_Forge
npm install
npm run dev
```

Then open the link shown in the terminal (usually http://localhost:5173). Add `?seed=anything` to the address to get a different world.

Run the tests with:

```bash
npm test
```

## Progress

- [x] M0 · Project setup
- [x] M1 · Terrain
- [ ] M2 · Cells and biomes
- [ ] M3 · Starting nations
- [ ] M4a · Growth
- [ ] M4b · Rebellion and collapse
- [ ] M5 · War
- [ ] M6 · Polish (speed controls, video export, save/load)

## Built with

TypeScript · Vite · Canvas 2D · simplex-noise · d3-delaunay · Vitest

## Inspiration

- *Fantasy Map Simulator* (Steam)
- [Azgaar's Fantasy Map Generator](https://github.com/Azgaar/Fantasy-Map-Generator)
- [Red Blob Games](https://www.redblobgames.com/) articles on map generation
