import { describe, expect, it } from "vitest";
import { extractPalette, hexOf, parseColor, sanitizeCssName, toCssVariables, type DecodedPixels } from "./palette-extract";

/** Build an image from stripes of [r,g,b,a] with pixel counts. */
export function stripes(spec: [number, number, number, number, number][], width = 10): DecodedPixels {
  const total = spec.reduce((n, s) => n + s[4], 0);
  const height = Math.ceil(total / width);
  const data = new Uint8ClampedArray(width * height * 4);
  let p = 0;
  for (const [r, g, b, a, n] of spec) {
    for (let i = 0; i < n; i++, p++) data.set([r, g, b, a], p * 4);
  }
  return { data, width, height };
}

export const SIX = stripes([
  [220, 40, 30, 255, 60],
  [30, 90, 200, 255, 50],
  [40, 170, 80, 255, 40],
  [240, 200, 40, 255, 30],
  [120, 60, 160, 255, 20],
  [20, 20, 20, 255, 10],
]);

describe("palette extraction", () => {
  it("finds six distinct colours ordered by population with real sample points (C48-T01)", () => {
    const out = extractPalette(SIX, { count: 6 });
    expect(out.map((c) => c.hex)).toEqual(["#dc281e", "#1e5ac8", "#28aa50", "#f0c828", "#783ca0", "#141414"]);
    expect(out[0]!.population).toBeCloseTo(60 / 210, 3);
    expect(out[0]!.sample).toEqual({ x: 0, y: 0 });
    expect(out[1]!.sample).toEqual({ x: 0, y: 6 });
  });

  it("collapses near-duplicates and leaves slots unused for a monochrome image", () => {
    const mono = stripes([
      [100, 100, 100, 255, 50],
      [104, 100, 100, 255, 50],
      [100, 100, 108, 255, 50],
    ]);
    expect(extractPalette(mono, { count: 6 })).toHaveLength(1);
    expect(extractPalette(mono, { count: 6, distanceThreshold: 2 })).toHaveLength(3);
  });

  it("ignores pixels under the alpha threshold so transparency cannot dominate (C48-T04)", () => {
    const img = stripes([
      [255, 0, 0, 40, 900], // mostly transparent red
      [0, 0, 255, 255, 100],
    ]);
    const out = extractPalette(img, { count: 6, alphaThreshold: 0.5 });
    expect(out.map((c) => c.hex)).toEqual(["#0000ff"]);
    expect(extractPalette(img, { count: 6, alphaThreshold: 0.1 }).map((c) => c.hex)).toEqual(["#ff0000", "#0000ff"]);
    expect(extractPalette(stripes([[1, 2, 3, 0, 20]]))).toEqual([]);
  });

  it("parses and formats colours strictly", () => {
    expect(parseColor("#abc")).toEqual([170, 187, 204]);
    expect(parseColor("ABCDEF")).toEqual([171, 205, 239]);
    expect(parseColor("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
    expect(parseColor("rgb(1 2 300)")).toBeNull();
    expect(parseColor("red")).toBeNull();
    expect(parseColor("#ggg")).toBeNull();
    expect(hexOf([255, 0, 128])).toBe("#ff0080");
  });

  it("exports sanitised names and only valid colours (C48-T08)", () => {
    const css = toCssVariables(
      [
        { id: "s1", color: "#aabbcc" },
        { id: "s2", color: null },
        { id: "s3", color: "red" },
        { id: "s4", color: "#112233", label: "Accent Color!" },
      ],
      "My Brand :root{}",
    );
    expect(css).toBe(":root {\n  --my-brand-root-1: #aabbcc;\n  --my-brand-root-accent-color: #112233;\n}");
    expect(sanitizeCssName("---")).toBe("palette");
  });
});
