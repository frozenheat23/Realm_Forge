// Ruler portraits: every ruler the game can crown has an image file.
import { describe, expect, it } from "vitest";
import { Race, RulerType, type RaceId, type Ruler, type RulerTypeId } from "../src/core/types";
import { fallbackPath, portraitPath } from "../src/ui/portraits";

const ruler = (female: boolean, great?: RulerTypeId): Ruler => ({ name: "Test", dynasty: "House Test", female, crowned: 0, ends: 10, great, boldness: 1 });

describe("ruler portraits", () => {
  it("names the file by race, gender and type", () => {
    expect(portraitPath(Race.DarkElf, ruler(true, RulerType.Schemer))).toBe("portraits/delf-f-schemer.webp");
    expect(portraitPath(Race.Human, ruler(false))).toBe("portraits/human-m-ordinary.webp");
  });

  it("falls back to the men's portrait for races without queens", () => {
    expect(portraitPath(Race.Orc, ruler(true, RulerType.Conqueror))).toBe("portraits/orc-m-conqueror.webp");
  });

  it("has an image for every race, gender and type", () => {
    // Vite lists the files matching a pattern, e.g. "../public/portraits/orc-m-ordinary.webp".
    const files = new Set(Object.keys(import.meta.glob("../public/portraits/*.webp")).map((f) => f.replace("../public/", "")));
    const races: RaceId[] = [Race.Human, Race.LightElf, Race.DarkElf, Race.Dwarf, Race.Orc];
    const types: (RulerTypeId | undefined)[] = [undefined, ...Object.values(RulerType)];
    for (const race of races) {
      for (const female of [false, true]) {
        for (const type of types) {
          const path = portraitPath(race, ruler(female, type));
          expect(files.has(path), path).toBe(true);
        }
      }
    }
  });

  it("can fall back from a great portrait to the ordinary one", () => {
    expect(fallbackPath(Race.LightElf, ruler(true, RulerType.Prophet))).toBe("portraits/lelf-f-ordinary.webp");
  });
});
