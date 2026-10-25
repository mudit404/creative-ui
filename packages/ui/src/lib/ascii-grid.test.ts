import { describe, expect, it } from "vitest";
import { calibrateRamp, glyphIndex, gridSize, responsiveColumns, sampleCells, validateRamp } from "./ascii-grid";

describe("ascii grid", () => {
  it("derives rows that preserve the media aspect for a given cell aspect (C55-T02)", () => {
    expect(gridSize(1600, 900, 96, 0.6)).toEqual({ cols: 96, rows: 32 }); // 96×0.6×900/1600 = 32.4
    expect(gridSize(900, 1600, 48, 0.6)).toEqual({ cols: 48, rows: 51 });
    const a = gridSize(1600, 900, 64, 0.6);
    const b = gridSize(1600, 900, 128, 0.6);
    expect(Math.abs(a.rows / a.cols - b.rows / b.cols)).toBeLessThan(0.02);
    expect(responsiveColumns(360, 96, 48)).toBe(48);
    expect(responsiveColumns(1200, 96, 48)).toBe(96);
    expect(responsiveColumns(1200, 999, 48)).toBe(160);
  });

  it("maps luminance monotonically through the ramp (C55-T01)", () => {
    const ramp = " .:-=+*#%@";
    const idx = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1].map((l) => glyphIndex(l, ramp.length));
    for (let i = 1; i < idx.length; i++) expect(idx[i]!).toBeLessThanOrEqual(idx[i - 1]!); // lighter → earlier glyph
    expect(ramp[glyphIndex(1, ramp.length)]).toBe(" ");
    expect(ramp[glyphIndex(0, ramp.length)]).toBe("@");
    expect(ramp[glyphIndex(0, ramp.length, true)]).toBe(" ");
  });

  it("samples luminance and colour per cell and calibrates by coverage", () => {
    const frame = { data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255]), width: 2, height: 2 };
    const s = sampleCells(frame);
    expect(Array.from(s.luminance).map((l) => Math.round(l * 100) / 100)).toEqual([1, 0, 0.21, 0.07]);
    expect(Array.from(s.color.slice(6, 9))).toEqual([255, 0, 0]);
    expect(calibrateRamp({ "@": 0.8, " ": 0, ".": 0.1, "#": 0.6 }).join("")).toBe(" .#@");
  });

  it("validates ramps", () => {
    expect(validateRamp(" .:-=+*#%@")).toBeNull();
    expect(validateRamp("")).toMatch(/empty/);
    expect(validateRamp("á")).toMatch(/combining/);
    expect(validateRamp("🙂")).toMatch(/emoji/);
  });
});
