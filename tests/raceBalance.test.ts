// Race balance check (M7 "done when"): no race should take over most worlds.
// Slow (10 worlds × 1,000 years), so it only runs when asked:
//   set RACE_BALANCE=1 && npx vitest run tests/raceBalance.test.ts      (Command Prompt)
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { generateWorld } from "../src/gen";
import { PLAYABLE_RACES, traits } from "../src/gen/races";
import { tick } from "../src/sim/tick";

const SEEDS = 10;
const YEARS = 1000;
/** A race "takes over" a world if its people live on more than this share of the settled land. */
const TAKEOVER_SHARE = 0.5;

// Node's `process` isn't in our browser-only TypeScript setup, so describe the bit we use.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

describe.runIf(env.RACE_BALANCE)("race balance", () => {
  it(
    `no race takes over most of ${SEEDS} worlds after ${YEARS} years`,
    () => {
      let takeovers = 0;
      const rows: string[] = [];
      for (let s = 0; s < SEEDS; s++) {
        const seed = `balance-${s}`;
        const { state } = generateWorld(seed);
        const rng = createRng(seed).fork("sim");
        for (let y = 0; y < YEARS; y++) tick(state, rng);

        // Share of settled cells each race lives on.
        const counts = new Map<number, number>();
        let settled = 0;
        for (const r of state.state.race) {
          if (r === 0) continue;
          counts.set(r, (counts.get(r) ?? 0) + 1);
          settled++;
        }
        const shares = PLAYABLE_RACES.map((r) => (counts.get(r) ?? 0) / Math.max(settled, 1));
        if (Math.max(...shares) > TAKEOVER_SHARE) takeovers++;
        rows.push(`${seed.padEnd(11)} ${shares.map((x) => `${(x * 100).toFixed(0)}%`.padStart(12)).join("")}`);
      }
      console.log(`${"seed".padEnd(11)} ${PLAYABLE_RACES.map((r) => traits(r).plural.padStart(12)).join("")}\n${rows.join("\n")}`);
      expect(takeovers).toBeLessThan(SEEDS / 2 + 1);
    },
    600_000,
  );
});
