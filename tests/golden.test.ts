// Golden history (M15): fingerprints of long runs, recorded before a refactor.
// The determinism test only compares the code with itself; this one compares it
// with how the code behaved when the fingerprint was recorded. If a change is
// meant to alter history, record new fingerprints and say why in the decision log.
import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/rng";
import { generateWorld } from "../src/gen";
import { tick } from "../src/sim/tick";
import { runYears } from "./longRun";

/** FNV-1a hash of some text, as 8 hex digits. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Every event, plus who owns and lives in each cell at the end. */
async function fingerprint(seed: string, years: number, width?: number, height?: number): Promise<string> {
  const { state } = generateWorld(seed, width, height);
  const rng = createRng(seed).fork("sim");
  await runYears(years, () => tick(state, rng));
  const s = state.state;
  return hash(
    state.events.map((e) => e.text).join("\n") +
      [...s.owner].join(",") +
      [...s.race].join(",") +
      [...s.culture].join(",") +
      [...s.faith].join(","),
  );
}

// Recorded 2026-11-02 after M15 step 5 (each choice rolls its own dice). The first
// recording, before M15 (a9cbfab), held unchanged through steps 1–4. Re-recorded in M16 for
// the new wording of a victory that took no land (history itself unchanged). Re-recorded
// 2026-11-06: civil-war pretenders now rise from the ruling people, and again when
// alliances began to fade and break under new rulers (history changed both times). Re-recorded
// 2026-11-07: nations go to war on what they believe, not on exact strength (M18 misjudgment),
// and again when defenders who hold out began to win (M18 underdog defense), and for
// generals and peace offers (M18 part 3). Re-recorded 2026-11-08 for imperfect
// army engagement estimates (defensive ground, yearly scouting reports and general personality),
// then for strength-sensitive sieges, costly assaults, supply routes and hunger.
const GOLDEN = {
  full: "7833d41f",
  smallA: "4e816901",
  smallB: "17891614",
};

describe("golden history", () => {
  it("a full-size world over 600 years", async () => {
    expect(await fingerprint("golden-full", 600)).toBe(GOLDEN.full);
  }, 120_000);

  it("two small worlds over 1,000 years", async () => {
    expect(await fingerprint("golden-a", 1000, 320, 180)).toBe(GOLDEN.smallA);
    expect(await fingerprint("golden-b", 1000, 320, 180)).toBe(GOLDEN.smallB);
  }, 120_000);
});
