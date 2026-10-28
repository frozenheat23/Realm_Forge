# Glossary

New concepts as we meet them, with where they show up in our code.

| Term | Meaning | In our code |
|---|---|---|
| **Seed** | A starting value for a random number generator. Same seed → same "random" numbers every time. | `createRng("...")` in `src/core/rng.ts` |
| **Seeded RNG** | A random number generator that's actually a recipe: it scrambles a number over and over, so the sequence is repeatable. | `src/core/rng.ts` |
| **Fork (RNG stream)** | A separate generator made from the main seed plus a name, so each system (war, names…) gets its own numbers. | `rng.fork("war")` |
| **Interface** | A TypeScript description of what an object looks like (its properties and methods), checked before the code runs. | `interface Rng` in `src/core/rng.ts` |
| **Module / `export` / `import`** | Each `.ts` file is a module. `export` makes something visible to other files; `import` pulls it in. | `src/main.ts` imports from `core/`, `gen/`, `render/` |
| **Strict mode** | TypeScript settings that catch more mistakes, e.g. using a value that might be missing. | `"strict": true` in `tsconfig.json` |
| **Vite** | The dev server: serves the page, rebuilds instantly when you save, and bundles the app for release. | `npm run dev`, `vite.config.ts` |
| **Vitest** | The test runner. Each `it(...)` is one check that must pass. | `tests/*.test.ts`, `npm test` |
| **Canvas 2D** | A browser drawing surface you paint with code (shapes, pixels, text). | `src/main.ts` |
