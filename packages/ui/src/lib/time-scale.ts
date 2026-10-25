/**
 * Time-scale utilities for TimeLens. Pure and timezone-honest: timestamps are
 * epoch milliseconds everywhere; display formatting takes an explicit IANA
 * zone through Intl and never shifts the stored values.
 */

export type TimeWindow = readonly [number, number];

export interface TimeEvent {
  id: string;
  startMs: number;
  endMs?: number;
  label: string;
  details?: string;
  severity?: string;
}

export interface EventDiagnostic {
  id: string;
  message: string;
}

export function validateEvents(events: readonly TimeEvent[]): { valid: TimeEvent[]; diagnostics: EventDiagnostic[] } {
  const valid: TimeEvent[] = [];
  const diagnostics: EventDiagnostic[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (!e || typeof e.id !== "string" || !e.id) {
      diagnostics.push({ id: String(e?.id ?? "?"), message: "Event without an id." });
      continue;
    }
    if (seen.has(e.id)) {
      diagnostics.push({ id: e.id, message: `Duplicate event id "${e.id}".` });
      continue;
    }
    if (!Number.isFinite(e.startMs)) {
      diagnostics.push({ id: e.id, message: `"${e.id}" has a non-finite start.` });
      continue;
    }
    if (e.endMs !== undefined && (!Number.isFinite(e.endMs) || e.endMs < e.startMs)) {
      diagnostics.push({ id: e.id, message: `"${e.id}" ends before it starts.` });
      continue;
    }
    seen.add(e.id);
    valid.push(e);
  }
  return { valid, diagnostics };
}

/** Sort by start, then end, then id (stable across renders). */
export function sortEvents(events: readonly TimeEvent[]): TimeEvent[] {
  return [...events].sort((a, b) => a.startMs - b.startMs || (a.endMs ?? a.startMs) - (b.endMs ?? b.startMs) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Greedy lane allocation over sorted intervals; deterministic. Point events get a minimum width in ms. */
export function allocateLanes(events: readonly TimeEvent[], minWidthMs = 0): Map<string, number> {
  const lanes: number[] = []; // end time per lane
  const out = new Map<string, number>();
  for (const e of sortEvents(events)) {
    const end = Math.max(e.endMs ?? e.startMs, e.startMs + minWidthMs);
    let lane = lanes.findIndex((laneEnd) => laneEnd <= e.startMs);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(end);
    } else lanes[lane] = end;
    out.set(e.id, lane);
  }
  return out;
}

export function validateDomain(domain: TimeWindow): string | null {
  if (!Number.isFinite(domain[0]) || !Number.isFinite(domain[1])) return "domain must be finite";
  if (domain[1] <= domain[0]) return "domain end must be after its start";
  return null;
}

/** Clamp a window inside the domain, enforce minSpan, keep the span when sliding. */
export function clampWindow(win: TimeWindow, domain: TimeWindow, minSpan: number): TimeWindow {
  const domSpan = domain[1] - domain[0];
  const span = Math.min(domSpan, Math.max(minSpan, win[1] - win[0]));
  let start = Math.max(domain[0], Math.min(win[0], domain[1] - span));
  const end = Math.min(domain[1], start + span);
  start = end - span;
  return [start, end];
}

/** Scale the span by `factor` around `center` (defaults to the window centre), then clamp. */
export function zoomWindow(win: TimeWindow, factor: number, domain: TimeWindow, minSpan: number, center?: number): TimeWindow {
  const c = center ?? (win[0] + win[1]) / 2;
  const span = (win[1] - win[0]) * factor;
  const half = span / 2;
  return clampWindow([c - half, c + half], domain, minSpan);
}

export function linearTimeScale(win: TimeWindow, width: number) {
  const span = win[1] - win[0] || 1;
  return {
    toX: (ms: number) => ((ms - win[0]) / span) * width,
    toMs: (x: number) => win[0] + (x / width) * span,
    span,
  };
}

const STEPS = [1e3, 5e3, 15e3, 30e3, 6e4, 5 * 6e4, 15 * 6e4, 30 * 6e4, 36e5, 3 * 36e5, 6 * 36e5, 12 * 36e5, 864e5, 7 * 864e5, 30 * 864e5, 90 * 864e5, 365 * 864e5];

/** Round tick positions (aligned to UTC multiples of a "nice" step) covering the window. */
export function ticksFor(win: TimeWindow, approxCount = 6): { ms: number; step: number }[] {
  const span = win[1] - win[0];
  const target = span / Math.max(1, approxCount);
  const step = STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1]!;
  const first = Math.ceil(win[0] / step) * step;
  const out: { ms: number; step: number }[] = [];
  for (let t = first; t <= win[1] && out.length < 100; t += step) out.push({ ms: t, step });
  return out;
}

/** Format in an explicit zone; detail level follows the tick step. Falls back to ISO on invalid zones. */
export function formatInZone(ms: number, timeZone: string, level: "date" | "datetime" | "time" | "full" = "datetime"): string {
  const opts: Intl.DateTimeFormatOptions =
    level === "date"
      ? { year: "numeric", month: "short", day: "2-digit" }
      : level === "time"
        ? { hour: "2-digit", minute: "2-digit", hour12: false }
        : level === "full"
          ? { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" }
          : { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone }).format(ms);
  } catch {
    return new Date(ms).toISOString();
  }
}

export function levelForStep(step: number): "date" | "datetime" | "time" {
  if (step >= 864e5) return "date";
  if (step >= 36e5) return "datetime";
  return "time";
}

/** Strict ISO-8601 with an explicit offset or Z; null otherwise (local-time input is ambiguous around DST). */
export function parseIsoWithOffset(text: string): number | null {
  const t = text.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(t)) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}
