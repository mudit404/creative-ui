/**
 * Grid math for AsciiMedia. Cell counts that preserve the media aspect
 * ratio, luminance sampling from RGBA pixels and a monotonic glyph ramp
 * lookup. Calibration of a ramp (ordering glyphs by rendered coverage) takes
 * measured coverages so it can be tested without a canvas. Pure.
 */

export interface GridSize {
  cols: number;
  rows: number;
}

/** Rows for a column count so that cols×rows cells (each `cellAspect` = width/height) cover the media's aspect. */
export function gridSize(mediaWidth: number, mediaHeight: number, cols: number, cellAspect = 0.6): GridSize {
  const c = Math.max(4, Math.floor(cols));
  if (!mediaWidth || !mediaHeight) return { cols: c, rows: Math.max(1, Math.round(c * cellAspect)) };
  const rows = Math.max(1, Math.round((c * cellAspect * mediaHeight) / mediaWidth));
  return { cols: c, rows };
}

/** Responsive column count: fewer columns on narrow widths rather than microscopic glyphs. */
export function responsiveColumns(containerWidth: number, desktop: number, narrow: number, breakpoint = 640, max = 160): number {
  const base = containerWidth && containerWidth < breakpoint ? narrow : desktop;
  return Math.max(4, Math.min(max, Math.floor(base)));
}

export const luminanceOf = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export interface CellSample {
  /** 0…1 */
  luminance: Float32Array;
  /** rgb 0…255 per cell */
  color: Uint8ClampedArray;
}

/** Average each grid cell of an RGBA frame already scaled to cols×rows (one getImageData per frame). */
export function sampleCells(frame: { data: Uint8ClampedArray; width: number; height: number }): CellSample {
  const n = frame.width * frame.height;
  const luminance = new Float32Array(n);
  const color = new Uint8ClampedArray(n * 3);
  for (let i = 0; i < n; i++) {
    const r = frame.data[i * 4]!;
    const g = frame.data[i * 4 + 1]!;
    const b = frame.data[i * 4 + 2]!;
    luminance[i] = luminanceOf(r, g, b);
    color[i * 3] = r;
    color[i * 3 + 1] = g;
    color[i * 3 + 2] = b;
  }
  return { luminance, color };
}

/** Order ramp glyphs by measured coverage (light → dark). Input: glyph → ink fraction 0…1. */
export function calibrateRamp(coverage: Record<string, number>): string[] {
  return Object.entries(coverage)
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .map(([g]) => g);
}

/** Glyph index for a luminance: light pixels get light glyphs unless inverted (monotonic, C55-T01). */
export function glyphIndex(luminance: number, rampLength: number, invert = false): number {
  const l = Math.max(0, Math.min(1, luminance));
  const v = invert ? l : 1 - l; // ramp[0] is the lightest glyph (least ink), so dark pixels map to the end
  return Math.min(rampLength - 1, Math.floor(v * rampLength));
}

/** Reject ramps with combining marks or non-single-cell glyphs. */
export function validateRamp(ramp: string): string | null {
  if (!ramp.length) return "glyphRamp must not be empty";
  if (/\p{M}/u.test(ramp)) return "glyphRamp must not contain combining marks";
  if (/[\u{1F300}-\u{1FAFF}]/u.test(ramp)) return "glyphRamp must use single-cell glyphs (no emoji)";
  return null;
}
