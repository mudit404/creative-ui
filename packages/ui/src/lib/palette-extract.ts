/**
 * Palette extraction for PaletteComposer. Pure and deterministic: works on a
 * decoded RGBA buffer, ignores pixels below an alpha threshold, buckets
 * colours at 5 bits per channel, then picks the most populated buckets that
 * are at least `distanceThreshold` apart (RGB Euclidean). Each colour carries
 * a real sample coordinate (the first pixel seen in its bucket), so the
 * presentation can start discs from a true source location.
 *
 * Also hosts colour parsing/formatting and the CSS export used by the editor.
 */

export interface DecodedPixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ExtractedColor {
  /** Lower-case `#rrggbb`. */
  hex: string;
  rgb: [number, number, number];
  /** Share of opaque pixels in this colour's bucket, 0..1. */
  population: number;
  /** A real pixel location of this colour in the decoded (sampled) image. */
  sample: { x: number; y: number };
}

export interface ExtractOptions {
  count?: number;
  /** 0..1; pixels with alpha below this are ignored. */
  alphaThreshold?: number;
  /** Minimum RGB distance between kept colours (0..441). */
  distanceThreshold?: number;
}

export interface ExtractorInput extends DecodedPixels {
  count: number;
  alphaThreshold: number;
}

export type Extractor = (input: ExtractorInput, signal: AbortSignal) => Promise<ExtractedColor[]>;

export function rgbDistance(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function hexOf(rgb: readonly [number, number, number]): string {
  return "#" + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}

/** Parse `#rgb`, `#rrggbb`, `rgb(r, g, b)` or `rgb(r g b)`; null when invalid. */
export function parseColor(text: string): [number, number, number] | null {
  const t = text.trim().toLowerCase();
  let m = /^#?([0-9a-f]{3})$/.exec(t);
  if (m) return [...m[1]!].map((c) => parseInt(c + c, 16)) as [number, number, number];
  m = /^#?([0-9a-f]{6})$/.exec(t);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1]!.slice(i, i + 2), 16)) as [number, number, number];
  m = /^rgb\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)$/.exec(t);
  if (m) {
    const v = [m[1], m[2], m[3]].map(Number) as [number, number, number];
    return v.every((c) => c <= 255) ? v : null;
  }
  return null;
}

export function isHexColor(text: string): boolean {
  return /^#[0-9a-f]{6}$/.test(text);
}

/** Relative luminance (sRGB) for contrast-safe label surfaces. */
export function luminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function extractPalette(pixels: DecodedPixels, opts: ExtractOptions = {}): ExtractedColor[] {
  const count = Math.max(1, Math.floor(opts.count ?? 6));
  const alphaMin = Math.round(Math.max(0, Math.min(1, opts.alphaThreshold ?? 0.5)) * 255);
  const minDist = opts.distanceThreshold ?? 40;
  const { data, width } = pixels;
  const sums = new Map<number, { n: number; r: number; g: number; b: number; x: number; y: number }>();
  let opaque = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < alphaMin) continue;
    opaque++;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let s = sums.get(key);
    if (!s) {
      const p = i / 4;
      s = { n: 0, r: 0, g: 0, b: 0, x: p % width, y: Math.floor(p / width) };
      sums.set(key, s);
    }
    s.n++;
    s.r += r;
    s.g += g;
    s.b += b;
  }
  if (!opaque) return [];
  const buckets = [...sums.values()].sort((p, q) => q.n - p.n);
  const out: ExtractedColor[] = [];
  for (const s of buckets) {
    const rgb: [number, number, number] = [s.r / s.n, s.g / s.n, s.b / s.n];
    if (out.some((o) => rgbDistance(o.rgb, rgb) < minDist)) continue;
    out.push({ hex: hexOf(rgb), rgb: rgb.map(Math.round) as [number, number, number], population: s.n / opaque, sample: { x: s.x, y: s.y } });
    if (out.length >= count) break;
  }
  return out;
}

/** Default extractor: synchronous math behind a promise, abortable between the two phases. */
export const defaultExtractor: Extractor = async (input, signal) => {
  await Promise.resolve();
  if (signal.aborted) throw new DOMException("aborted", "AbortError");
  return extractPalette(input, { count: input.count, alphaThreshold: input.alphaThreshold });
};

/** CSS custom-property name token: lower-case letters, digits and dashes only. */
export function sanitizeCssName(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return s || "palette";
}

export interface ExportSwatch {
  id: string;
  color: string | null;
  label?: string;
}

/** `:root { --prefix-1: #rrggbb; }` for valid colours only; labels become name suffixes when present. */
export function toCssVariables(swatches: readonly ExportSwatch[], prefix: string): string {
  const p = sanitizeCssName(prefix);
  const lines: string[] = [];
  swatches.forEach((s, i) => {
    if (!s.color || !isHexColor(s.color)) return;
    const suffix = s.label ? sanitizeCssName(s.label) : String(i + 1);
    lines.push(`  --${p}-${suffix}: ${s.color};`);
  });
  return `:root {\n${lines.join("\n")}\n}`;
}
