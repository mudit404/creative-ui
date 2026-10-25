/**
 * Bounded-value math shared by numeric inputs (ElasticRange, DetentDial).
 * Pure and decimal-safe: quantization is computed relative to `min` with
 * integer step counts and rounded to the step's decimal places, never by
 * repeated binary-float addition.
 */

export interface Domain {
  min: number;
  max: number;
  step: number;
}

export interface Scale {
  /** Domain value → 0..1 */
  toFraction(value: number): number;
  /** 0..1 → domain value (unquantized) */
  fromFraction(fraction: number): number;
}

export function validateDomain(d: Domain): string | null {
  if (![d.min, d.max, d.step].every(Number.isFinite)) return "min, max and step must be finite numbers";
  if (d.max <= d.min) return "max must be greater than min";
  if (d.step <= 0) return "step must be greater than 0";
  return null;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Number of decimal places needed to represent `step` exactly (capped at 10). */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0;
  const s = step.toString();
  if (s.includes("e-")) return Math.min(10, parseInt(s.split("e-")[1]!, 10));
  const i = s.indexOf(".");
  return i === -1 ? 0 : Math.min(10, s.length - i - 1);
}

/** Round to `decimals` places, avoiding float artefacts like 0.30000000000000004. */
export function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Clamp into the domain, then snap to the nearest step counted from `min`. */
export function quantize(value: number, d: Domain): number {
  if (!Number.isFinite(value)) return d.min;
  const dec = Math.max(decimalsOf(d.step), decimalsOf(d.min));
  const steps = Math.round(roundTo((clamp(value, d.min, d.max) - d.min) / d.step, 9));
  return roundTo(clamp(d.min + steps * d.step, d.min, d.max), dec);
}

/** Move by `count` steps from `value` (count may be negative). */
export function stepBy(value: number, count: number, d: Domain): number {
  const dec = Math.max(decimalsOf(d.step), decimalsOf(d.min));
  const steps = Math.round(roundTo((quantize(value, d) - d.min) / d.step, 9)) + count;
  return roundTo(clamp(d.min + steps * d.step, d.min, d.max), dec);
}

export function linearScale(min: number, max: number): Scale {
  const span = max - min || 1;
  return {
    toFraction: (v) => clamp((v - min) / span, 0, 1),
    fromFraction: (f) => min + clamp(f, 0, 1) * span,
  };
}

/** Positive-only logarithmic scale. Throws for min <= 0 so callers can fall back with a diagnostic. */
export function logScale(min: number, max: number): Scale {
  if (!(min > 0) || !(max > min)) throw new RangeError("logScale requires 0 < min < max");
  const lmin = Math.log(min);
  const lspan = Math.log(max) - lmin;
  return {
    toFraction: (v) => clamp((Math.log(Math.max(v, min)) - lmin) / lspan, 0, 1),
    fromFraction: (f) => Math.exp(lmin + clamp(f, 0, 1) * lspan),
  };
}

/** Parse user text as a finite number (decimal point or comma); null when invalid. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Detent snapping with hysteresis. `snapIn`/`snapOut` are fractions of the
 * domain span. Returns the detent to snap to, or null. Once snapped, the
 * value stays snapped until it moves `snapOut` away, which prevents flicker
 * at the boundary (C42-T01).
 */
export function resolveDetent(
  value: number,
  detents: readonly number[],
  span: number,
  snapIn: number,
  snapOut: number,
  current: number | null,
): number | null {
  if (!detents.length || span <= 0) return null;
  if (current !== null && Math.abs(value - current) <= snapOut * span) return current;
  let best: number | null = null;
  let bestD = Infinity;
  for (const d of detents) {
    const dist = Math.abs(value - d);
    if (dist <= snapIn * span && dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

/** Nearest value from a list (used by the stepped dial). */
export function nearestOf(value: number, candidates: readonly number[]): number {
  let best = candidates[0] ?? value;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** Format with the step's precision unless a formatter is supplied. */
export function formatDomainValue(value: number, d: Domain, formatter?: (v: number) => string): string {
  if (formatter) return formatter(value);
  return value.toFixed(Math.max(decimalsOf(d.step), decimalsOf(d.min)));
}
