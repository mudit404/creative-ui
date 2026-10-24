/**
 * Cell model for SplitFlapBoard. Grapheme-safe tokenisation, change
 * detection, a bounded stagger schedule and script support checks. Pure.
 */

const SEGMENTER = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** Split into user-perceived characters (emoji and combining marks stay whole). */
export function graphemes(text: string): string[] {
  if (SEGMENTER) return [...SEGMENTER.segment(text)].map((s) => s.segment);
  return [...text]; // code points; still never splits surrogate pairs
}

/** Pad or trim to a fixed cell count (numeric boards right-align by padding on the left). */
export function fitCells(cells: readonly string[], length: number, align: "left" | "right" = "left", pad = " "): string[] {
  const trimmed = cells.slice(0, length);
  const padding = Array.from({ length: Math.max(0, length - trimmed.length) }, () => pad);
  return align === "right" ? [...padding, ...trimmed] : [...trimmed, ...padding];
}

/** Indices whose glyph changed (unchanged cells never animate, C47-T02). */
export function changedCells(prev: readonly string[], next: readonly string[]): number[] {
  const out: number[] = [];
  const n = Math.max(prev.length, next.length);
  for (let i = 0; i < n; i++) if (prev[i] !== next[i]) out.push(i);
  return out;
}

/**
 * Start delay per changed cell: `stagger` ms apart, compressed so the last
 * cell finishes within `maxSettle` (C47-T01).
 */
export function staggerSchedule(changed: readonly number[], flipDuration: number, stagger: number, maxSettle: number): Map<number, number> {
  const out = new Map<number, number>();
  if (!changed.length) return out;
  const room = Math.max(0, maxSettle - flipDuration);
  const step = changed.length > 1 ? Math.min(stagger, room / (changed.length - 1)) : 0;
  changed.forEach((cell, i) => out.set(cell, Math.round(i * step)));
  return out;
}

/** Scripts whose letters need shaping get the whole-content fallback (C47-T05). */
export function needsWholeContent(text: string): boolean {
  return /[\p{Script=Devanagari}\p{Script=Arabic}\p{Script=Bengali}\p{Script=Thai}\p{Script=Tamil}\p{Script=Hebrew}\p{Script=Myanmar}\p{Script=Khmer}]/u.test(text);
}

export const DEFAULT_CHARACTER_SET = [" ", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", ".", ",", ":", "-", "/", "+", "!", "?", "&", "'"];

/** True when every grapheme of `text` is in the supported set (case-insensitive letters). */
export function supportedByCharacterSet(cells: readonly string[], characterSet: readonly string[]): boolean {
  const set = new Set(characterSet.map((c) => c.toUpperCase()));
  return cells.every((c) => set.has(c.toUpperCase()));
}

/** Numeric input → display string; invalid numbers show the placeholder, never zero. */
export function formatNumeric(value: string | number, placeholder = "—"): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : placeholder;
  return value;
}
