// The standings in the band below the map (src/ui/worldBand.ts).
import { describe, expect, it } from "vitest";
import type { Nation, WorldState } from "../src/core/types";
import { standings } from "../src/ui/worldBand";

function nation(id: number, area: number, overlord?: number, alive = true): Nation {
  return { id, name: `Realm ${id}`, color: "#123456", area, overlord, alive } as unknown as Nation;
}
const worldOf = (nations: Nation[]) => ({ nations: new Map(nations.map((n) => [n.id, n])) }) as unknown as WorldState;

describe("standings", () => {
  it("lists the largest crowns first, counting vassals' land with their overlord", () => {
    // Realm 1 alone holds 20%; realm 2 holds 10% and its vassal 15%.
    const rows = standings(worldOf([nation(1, 200), nation(2, 100), nation(3, 150, 2)]), 1000, 5);
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
    expect(rows[0]).toMatchObject({ share: 0.25, vassalShare: 0.15, vassals: 1 });
    expect(rows[1]).toMatchObject({ share: 0.2, vassalShare: 0, vassals: 0 });
  });

  it("keeps only the top few, and leaves out fallen realms", () => {
    const rows = standings(worldOf([nation(1, 50), nation(2, 400, undefined, false), nation(3, 80), nation(4, 60)]), 1000, 2);
    expect(rows.map((r) => r.id)).toEqual([3, 4]);
  });

  it("counts a vassal as its own crown once its overlord has fallen", () => {
    const rows = standings(worldOf([nation(1, 300, undefined, false), nation(2, 100, 1)]), 1000, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 2, vassals: 0 });
  });

  it("puts the older realm first when two are the same size", () => {
    expect(standings(worldOf([nation(7, 100), nation(3, 100)]), 1000, 5).map((r) => r.id)).toEqual([3, 7]);
  });
});
