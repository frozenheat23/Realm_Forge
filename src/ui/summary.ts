// The end of a played history (M20, docs/systems/play.md): what became of the realms you
// played and of your people. No score. Worked out from the command log's "play" orders,
// so nothing extra is saved. Only reads the world; no page code, so tests can check it.
import type { NationId, WorldState } from "../core/types";
import { traits } from "../gen/races";
import { livingNations } from "../sim/helpers";

/** One stretch of history spent playing one realm. */
export interface Stint {
  nation: NationId;
  from: number;
  /** When you stopped playing it: you chose another, stopped, or this is the last year. */
  to: number;
}

/** The realms played, in order, from the command log. */
export function stintsOf(state: WorldState): Stint[] {
  const stints: Stint[] = [];
  for (const entry of state.commands) {
    if (entry.by !== "player" || entry.command.kind !== "play") continue;
    const last = stints.at(-1);
    if (last && last.to === -1) last.to = entry.year;
    if (entry.command.nation !== null) stints.push({ nation: entry.command.nation, from: entry.year, to: -1 });
  }
  const last = stints.at(-1);
  if (last && last.to === -1) last.to = state.year;
  return stints;
}

/** The summary as sentences, oldest realm first, then your people and race today. */
export function summaryLines(state: WorldState): string[] {
  const owned = new Map<NationId, number>();
  let land = 0;
  for (const owner of state.state.owner) {
    if (owner === 0) continue;
    owned.set(owner, (owned.get(owner) ?? 0) + 1);
    land++;
  }
  const share = (cells: number) => `${Math.round((100 * cells) / Math.max(1, land))}%`;
  const lines: string[] = [];

  for (const stint of stintsOf(state)) {
    const nation = state.nations.get(stint.nation);
    if (!nation) continue;
    const years = `years ${stint.from}–${stint.to}`;
    let fate: string;
    if (!nation.alive && nation.fell !== undefined && nation.fell <= stint.to) fate = `fell in year ${nation.fell}`;
    else if (!nation.alive) fate = `you left it in year ${stint.to}, and it fell in year ${nation.fell ?? "?"}`;
    else if (stint.to < state.year) fate = `you left it in year ${stint.to}; it still stands, with ${owned.get(nation.id) ?? 0} provinces`;
    else fate = `stands at the end with ${owned.get(nation.id) ?? 0} provinces, ${share(owned.get(nation.id) ?? 0)} of the land`;
    lines.push(`${nation.name} (${years}): ${fate}.`);
  }

  const player = state.player;
  const played = player && state.nations.get(player.nation);
  if (player && played) {
    const people = state.nations.get(player.culture)?.name ?? played.name;
    const realms = livingNations(state).filter((n) => n.culture === player.culture);
    const cells = realms.reduce((sum, n) => sum + (owned.get(n.id) ?? 0), 0);
    lines.push(
      realms.length === 0
        ? `Your people, the folk of ${people}, rule nowhere now.`
        : `Your people, the folk of ${people}, rule ${realms.length} realm${realms.length === 1 ? "" : "s"}: ${realms.map((n) => n.name).join(", ")}, ${share(cells)} of the land.`,
    );
    const raceCells = livingNations(state)
      .filter((n) => n.race === played.race)
      .reduce((sum, n) => sum + (owned.get(n.id) ?? 0), 0);
    lines.push(`The ${traits(played.race).plural} rule ${share(raceCells)} of the land.`);
  }
  return lines;
}
