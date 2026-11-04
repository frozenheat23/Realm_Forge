// Long simulations in tests. A test that runs for a minute without a break keeps its
// Vitest worker from answering progress messages, and on GitHub's slower machines
// Vitest then crashes the whole run even though every test passed.

/** Years between short pauses. */
const PAUSE_EVERY = 50;

/** Calls `step` once per year for `years` years, pausing briefly now and then. History is unchanged. */
export async function runYears(years: number, step: (year: number) => void): Promise<void> {
  for (let y = 0; y < years; y++) {
    step(y);
    // Waiting for a zero-length timer lets the worker deal with its messages first.
    if (y % PAUSE_EVERY === PAUSE_EVERY - 1) await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
