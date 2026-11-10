import { describe, expect, it } from "vitest";
import { burnFrame, burnOrder } from "../src/ui/burn";

describe("burning a fallen ruler's card", () => {
  const W = 64;
  const H = 96;
  const order = burnOrder(W, H, "Velmora");
  // A plain, solid, light card.
  const clean = new Uint8ClampedArray(W * H * 4).fill(200);
  for (let p = 0; p < W * H; p++) clean[p * 4 + 3] = 255;
  const at = (x: number, y: number) => (y * W + x) * 4;

  it("burns the same way every time for the same name, and differently for another", () => {
    expect(burnOrder(W, H, "Velmora")).toEqual(order);
    expect(burnOrder(W, H, "Krash")).not.toEqual(order);
  });

  it("leaves an untouched card exactly as it was", () => {
    const out = new Uint8ClampedArray(clean.length);
    burnFrame(clean, out, order, 0);
    expect(out).toEqual(clean);
  });

  it("burns away the top edge, keeps the middle and the nameplate, and browns what's left", () => {
    const out = new Uint8ClampedArray(clean.length);
    burnFrame(clean, out, order, 1);
    expect(out[at(W / 2, 0) + 3]).toBe(0); // top edge: gone
    expect(out[at(0, H / 2) + 3]).toBe(0); // side edge: gone
    expect(out[at(W / 2, H / 2) + 3]).toBe(255); // the face: still there
    expect(out[at(W / 2, H - 10) + 3]).toBe(255); // the name: still there
    const mid = at(W / 2, H / 2);
    expect(out[mid]!).toBeLessThan(200); // darker than before…
    expect(out[mid]!).toBeGreaterThan(out[mid + 2]!); // …and browner (more red than blue)
  });

  it("burns more as time goes on", () => {
    const gone = (t: number) => {
      const out = new Uint8ClampedArray(clean.length);
      burnFrame(clean, out, order, t);
      let count = 0;
      for (let p = 0; p < W * H; p++) if (out[p * 4 + 3] === 0) count++;
      return count;
    };
    expect(gone(0.3)).toBeLessThan(gone(0.6));
    expect(gone(0.6)).toBeLessThan(gone(1));
  });
});
