// The versus screen's two small decisions (src/ui/versus.ts): which conquest to show, and where on the page.
import { describe, expect, it } from "vitest";
import type { SimEvent } from "../src/core/types";
import { VERSUS_GAP } from "../src/render/palette";
import { VERSUS_MIN_SHARE } from "../src/ui/config";
import { pickDuel, versusTop } from "../src/ui/versus";

const conquest = (loser: number, winner: number): SimEvent => ({ year: 9, type: "annexed", actors: [loser, winner], text: "Year 9: A takes the capital of B and conquers the whole realm, 40 provinces in all." });

describe("pickDuel", () => {
  const sizes = new Map([[1, 0.3], [2, VERSUS_MIN_SHARE * 2], [3, VERSUS_MIN_SHARE / 2], [4, VERSUS_MIN_SHARE * 3]]);
  const sizeOf = (id: number) => sizes.get(id) ?? 0;

  it("picks the conquest of the biggest fallen realm", () => {
    expect(pickDuel([conquest(2, 1), conquest(4, 1)], sizeOf)).toMatchObject({ winner: 1, loser: 4 });
  });
  it("leaves small realms to burn as before", () => {
    expect(pickDuel([conquest(3, 1)], sizeOf)).toBeNull();
  });
  it("ignores realms that fell apart with no conqueror in a war", () => {
    const absorbed: SimEvent = { year: 9, type: "annexed", actors: [4, 1], text: "Year 9: B falls apart and is absorbed by A." };
    expect(pickDuel([absorbed], sizeOf)).toBeNull();
  });
});

describe("versusTop", () => {
  const map = { top: 0, height: 600 };
  it("sits below the page's content when the window has room", () => {
    expect(versusTop(map, 700, 1000, 240)).toBe(700 + VERSUS_GAP);
  });
  it("sits centered on the map when it would not fit below", () => {
    expect(versusTop(map, 700, 800, 240)).toBe(180);
  });
});
