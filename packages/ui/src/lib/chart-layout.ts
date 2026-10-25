/**
 * Pure layout for ContinuityChart: snapshot validation (units, ids, finite
 * values, explicit nulls), a shared zero-inclusive domain, a linear value
 * scale and keyed row geometry so tests can verify coordinates without
 * animation.
 */

export interface ChartRow {
  id: string;
  label: string;
  /** Finite number or explicit null (Not available). Never coerced to zero. */
  value: number | null;
  color?: string;
}

export interface Snapshot {
  id: string;
  label: string;
  unit: string;
  rows: ChartRow[];
}

export interface ChartDiagnostic {
  code: "units" | "duplicate-id" | "value" | "empty" | "domain";
  message: string;
}

export function validateSnapshots(snapshots: readonly Snapshot[]): ChartDiagnostic[] {
  const out: ChartDiagnostic[] = [];
  if (!snapshots.length) return [{ code: "empty", message: "No snapshots supplied." }];
  const units = new Set(snapshots.map((s) => s.unit));
  if (units.size > 1) out.push({ code: "units", message: `Snapshots use different units (${[...units].join(", ")}); normalise them outside the chart.` });
  const ids = new Set<string>();
  for (const s of snapshots) {
    if (ids.has(s.id)) out.push({ code: "duplicate-id", message: `Duplicate snapshot id "${s.id}".` });
    ids.add(s.id);
    const rowIds = new Set<string>();
    for (const r of s.rows) {
      if (rowIds.has(r.id)) out.push({ code: "duplicate-id", message: `Snapshot "${s.id}" lists "${r.id}" twice.` });
      rowIds.add(r.id);
      if (r.value !== null && !Number.isFinite(r.value)) out.push({ code: "value", message: `"${r.id}" in "${s.id}" has a non-finite value; use null for missing data.` });
    }
  }
  return out;
}

/** Min/max over every finite value across snapshots, always including zero (bars need a baseline). */
export function sharedDomain(snapshots: readonly Snapshot[]): [number, number] {
  let lo = 0;
  let hi = 0;
  for (const s of snapshots) for (const r of s.rows) if (r.value !== null && Number.isFinite(r.value)) {
    lo = Math.min(lo, r.value);
    hi = Math.max(hi, r.value);
  }
  if (lo === hi) hi = lo + 1;
  return [lo, hi];
}

export type SortMode = "input" | "ascending" | "descending";

/** Deterministic ordering: nulls last, ties by id. */
export function sortRows(rows: readonly ChartRow[], sort: SortMode): ChartRow[] {
  if (sort === "input") return [...rows];
  const dir = sort === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (a.value === null && b.value === null) return a.id < b.id ? -1 : 1;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return (a.value - b.value) * dir || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

export interface RowGeometry {
  id: string;
  label: string;
  value: number | null;
  index: number;
  y: number;
  /** Pixel x of zero and of the value (x1 < x0 for negatives). */
  x0: number;
  x1: number;
  /** True when the value sits outside the declared domain (drawn clipped with a marker). */
  overflow: boolean;
}

export function layoutRows(rows: readonly ChartRow[], opts: { domain: [number, number]; width: number; rowHeight: number; sort: SortMode }): RowGeometry[] {
  const [lo, hi] = opts.domain;
  const span = hi - lo || 1;
  const toX = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / span) * opts.width;
  return sortRows(rows, opts.sort).map((r, i) => ({
    id: r.id,
    label: r.label,
    value: r.value,
    index: i,
    y: i * opts.rowHeight,
    x0: toX(0),
    x1: r.value === null ? toX(0) : toX(r.value),
    overflow: r.value !== null && (r.value < lo || r.value > hi),
  }));
}

/** Nice axis ticks for a linear domain. */
export function valueTicks(domain: [number, number], count = 5): number[] {
  const [lo, hi] = domain;
  const raw = (hi - lo) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
