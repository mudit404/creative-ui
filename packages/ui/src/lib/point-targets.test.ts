import { describe, expect, it } from "vitest";
import { curveOffsets, evaluateMorph, meanDistance, mortonOrder, resamplePoints, sampleMask } from "./point-targets";

/** Square mask with an opaque disc in the centre. */
function disc(size = 64, r = 20) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const inside = Math.hypot(x - size / 2, y - size / 2) <= r;
      const i = (y * size + x) * 4;
      data[i] = 200; data[i + 1] = 60; data[i + 2] = 30; data[i + 3] = inside ? 255 : 0;
    }
  return { data, width: size, height: size };
}
const EMPTY = { data: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 };

describe("point targets", () => {
  it("samples only opaque pixels into the normalised box and keeps source colour (C54-T01)", () => {
    const t = sampleMask(disc(), 500, 7)!;
    expect(t.count).toBe(500);
    expect(t.positions).toHaveLength(1500);
    for (let i = 0; i < 500; i++) {
      expect(Math.hypot(t.positions[i * 3]!, t.positions[i * 3 + 1]!)).toBeLessThanOrEqual(20 / 32 + 0.05); // inside the disc radius
      expect(t.colors[i * 3]).toBeCloseTo(200 / 255, 3);
    }
    expect(sampleMask(EMPTY, 10)).toBeNull();
  });

  it("is deterministic for the same seed and ordered along the Morton curve (C54-T02)", () => {
    const a = sampleMask(disc(), 300, 3)!;
    const b = sampleMask(disc(), 300, 3)!;
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    const c = sampleMask(disc(), 300, 4)!;
    expect(Array.from(c.positions)).not.toEqual(Array.from(a.positions));
    const order = mortonOrder(a.positions, a.count);
    expect(Array.from(order)).toEqual(Array.from({ length: 300 }, (_, i) => i)); // already in Morton order after sampling
  });

  it("resamples prepared clouds to a fixed count in the same box (C54-T07)", () => {
    const cube = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 10, 10, 10]);
    const t = resamplePoints(cube, 8, 1)!;
    expect(t.count).toBe(8);
    expect(t.positions).toHaveLength(24);
    for (let i = 0; i < 24; i++) expect(Math.abs(t.positions[i]!)).toBeLessThanOrEqual(1);
    expect(resamplePoints([], 5)).toBeNull();
  });

  it("interpolates without allocating and starts a new morph from the current positions (C54-T03, C54-T10)", () => {
    const a = sampleMask(disc(), 200, 1)!;
    const b = resamplePoints(new Float32Array(600).map((_, i) => (i % 3 === 0 ? 1 : -1)), 200, 1)!;
    const offsets = curveOffsets(200, 0.12, 1);
    const out = new Float32Array(600);
    evaluateMorph(a.positions, b.positions, offsets, 0, out);
    expect(meanDistance(out, a.positions)).toBeCloseTo(0, 6);
    evaluateMorph(a.positions, b.positions, offsets, 1, out);
    expect(meanDistance(out, b.positions)).toBeCloseTo(0, 6);
    evaluateMorph(a.positions, b.positions, offsets, 0.5, out);
    const mid = Float32Array.from(out); // snapshot as the start of an interrupting morph
    evaluateMorph(mid, a.positions, offsets, 0, out);
    expect(meanDistance(out, mid)).toBeCloseTo(0, 6);
    expect(out.buffer).toBe(out.buffer);
  });
});
