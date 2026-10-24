import { describe, expect, it } from "vitest";
import { closestS, perimeter, pointAt, signedDistance, type RoundedRect } from "./rounded-outline";

const pill: RoundedRect = { x: 10, y: 20, w: 200, h: 60, r: 30 };
const box: RoundedRect = { x: 0, y: 0, w: 120, h: 48, r: 12 };

describe("rounded outline", () => {
  it("computes the perimeter of a pill", () => {
    expect(perimeter(pill)).toBeCloseTo(2 * 140 + 2 * Math.PI * 30, 6);
  });

  it("walks the outline continuously", () => {
    const total = perimeter(box);
    let prev = pointAt(box, 0);
    for (let s = 1; s <= total + 1; s += 1) {
      const p = pointAt(box, s);
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(1.05);
      // normal is a unit vector perpendicular to the tangent
      expect(Math.hypot(p.nx, p.ny)).toBeCloseTo(1, 6);
      expect(p.nx * p.tx + p.ny * p.ty).toBeCloseTo(0, 6);
      prev = p;
    }
    // closes the loop
    const end = pointAt(box, total);
    const start = pointAt(box, 0);
    expect(end.x).toBeCloseTo(start.x, 6);
    expect(end.y).toBeCloseTo(start.y, 6);
  });

  it("round-trips closestS for points pushed out along the normal", () => {
    for (const rect of [pill, box]) {
      const total = perimeter(rect);
      for (let s = 0; s < total; s += 3.7) {
        const p = pointAt(rect, s);
        const got = closestS(rect, p.x + p.nx * 25, p.y + p.ny * 25);
        const diff = Math.min(Math.abs(got - s), total - Math.abs(got - s));
        expect(diff).toBeLessThan(0.5);
      }
    }
  });

  it("signs distances correctly", () => {
    expect(signedDistance(pill, 110, 50)).toBeLessThan(0);
    expect(signedDistance(pill, 110, 0)).toBeCloseTo(20, 6);
    expect(signedDistance(pill, 250, 50)).toBeCloseTo(40, 6);
    // corner region: distance to the arc
    expect(signedDistance(box, 130, -10)).toBeCloseTo(Math.hypot(130 - 108, -10 - 12) - 12, 6);
  });
});
