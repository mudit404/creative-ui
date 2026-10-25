import { describe, expect, it } from "vitest";
import { decimalsOf, linearScale, logScale, nearestOf, parseNumber, quantize, resolveDetent, stepBy, validateDomain } from "./bounded-value";

describe("bounded value", () => {
  it("validates domains", () => {
    expect(validateDomain({ min: 0, max: 100, step: 1 })).toBeNull();
    expect(validateDomain({ min: 10, max: 10, step: 1 })).toMatch(/greater than min/);
    expect(validateDomain({ min: 0, max: 1, step: 0 })).toMatch(/step/);
    expect(validateDomain({ min: NaN, max: 1, step: 1 })).toMatch(/finite/);
  });

  it("quantizes without float drift (C41-T06)", () => {
    const d = { min: 0, max: 1, step: 0.1 };
    let v = 0;
    for (let i = 0; i < 10; i++) v = stepBy(v, 1, d);
    expect(v).toBe(1);
    expect(stepBy(0, 3, d)).toBe(0.3);
    expect(quantize(0.35, d)).toBe(0.4);
    expect(quantize(0.34, d)).toBe(0.3);
    expect(decimalsOf(0.1)).toBe(1);
    expect(decimalsOf(0.001)).toBe(3);
    expect(decimalsOf(1e-7)).toBe(7);
  });

  it("clamps out-of-domain values to the bounds (C41-T01)", () => {
    const d = { min: 0, max: 100, step: 1 };
    expect(quantize(500, d)).toBe(100);
    expect(quantize(-500, d)).toBe(0);
    expect(quantize(NaN, d)).toBe(0);
    expect(stepBy(100, 5, d)).toBe(100);
    expect(stepBy(0, -1, d)).toBe(0);
  });

  it("quantizes relative to min, not zero", () => {
    const d = { min: 0.5, max: 2.5, step: 0.5 };
    expect(quantize(0.7, d)).toBe(0.5);
    expect(quantize(1.3, d)).toBe(1.5);
    expect(stepBy(0.5, 2, d)).toBe(1.5);
  });

  it("maps linear and log scales", () => {
    const lin = linearScale(0, 100);
    expect(lin.toFraction(25)).toBe(0.25);
    expect(lin.fromFraction(0.5)).toBe(50);
    const log = logScale(20, 20000);
    expect(log.toFraction(20)).toBe(0);
    expect(log.toFraction(20000)).toBe(1);
    expect(log.fromFraction(0.5)).toBeCloseTo(632.46, 1);
    expect(() => logScale(0, 100)).toThrow(RangeError);
  });

  it("parses numbers strictly", () => {
    expect(parseNumber(" 12.5 ")).toBe(12.5);
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("1e3")).toBe(1000);
    expect(parseNumber("Infinity")).toBeNull();
  });

  it("snaps to detents with hysteresis and no flicker (C42-T01)", () => {
    const detents = [0, 25, 50, 75, 100];
    const span = 100;
    // approaching 50: snaps within 2%
    expect(resolveDetent(47, detents, span, 0.02, 0.04, null)).toBeNull();
    expect(resolveDetent(48.5, detents, span, 0.02, 0.04, null)).toBe(50);
    // while snapped, stays snapped until 4% away
    expect(resolveDetent(52.5, detents, span, 0.02, 0.04, 50)).toBe(50);
    expect(resolveDetent(53.9, detents, span, 0.02, 0.04, 50)).toBe(50);
    expect(resolveDetent(54.1, detents, span, 0.02, 0.04, 50)).toBeNull();
    // walking slowly across the boundary never alternates
    let current: number | null = null;
    const seen: (number | null)[] = [];
    for (let v = 46; v <= 56; v += 0.25) {
      current = resolveDetent(v, detents, span, 0.02, 0.04, current);
      seen.push(current);
    }
    const transitions = seen.filter((s, i) => i > 0 && s !== seen[i - 1]).length;
    expect(transitions).toBe(2); // null → 50 → null, once each
    expect(nearestOf(63, detents)).toBe(75);
  });
});
