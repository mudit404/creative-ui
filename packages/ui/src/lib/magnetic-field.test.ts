import { describe, expect, it } from "vitest";
import { boxDistance, magneticSample } from "./magnetic-field";

const box = { left: 100, top: 100, width: 200, height: 60 };
const opts = { radius: 100, strength: 0.4, maxOffset: 30 };

describe("magnetic field", () => {
  it("measures distance to the box edge, zero inside", () => {
    expect(boxDistance(box, 200, 130)).toBe(0);
    expect(boxDistance(box, 200, 50)).toBe(50);
    expect(boxDistance(box, 40, 130)).toBe(60);
    expect(boxDistance(box, 60, 70)).toBeCloseTo(50, 6);
  });

  it("is idle without a pointer or outside the field", () => {
    expect(magneticSample(null, box, opts).active).toBe(false);
    const s = magneticSample({ x: 200, y: -50 }, box, opts);
    expect(s.active).toBe(false);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });

  it("pulls toward the pointer, stronger as it approaches", () => {
    const far = magneticSample({ x: 200, y: 20 }, box, opts); // 80px above
    const near = magneticSample({ x: 200, y: 90 }, box, opts); // 10px above
    expect(far.active).toBe(true);
    expect(far.y).toBeLessThan(0);
    expect(near.y).toBeLessThan(far.y);
    expect(near.proximity).toBeGreaterThan(far.proximity);
    expect(near.x).toBe(0);
  });

  it("caps the displacement and reports inside", () => {
    const s = magneticSample({ x: 290, y: 130 }, box, opts);
    expect(s.inside).toBe(true);
    expect(s.proximity).toBe(1);
    expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(30 + 1e-9);
  });

  it("restricts to an axis", () => {
    const s = magneticSample({ x: 260, y: 90 }, box, { ...opts, axis: "x" });
    expect(s.y).toBe(0);
    expect(s.x).toBeGreaterThan(0);
  });
});
