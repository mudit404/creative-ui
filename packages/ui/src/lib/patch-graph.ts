/**
 * Connection model for CablePatchbay. Pure: port/connection validation with
 * human-readable reasons, diagnostics for invalid existing edges, nearest
 * compatible socket search and the cable path geometry.
 */

export type PortDirection = "input" | "output";

export interface Port {
  id: string;
  nodeId: string;
  label: string;
  direction: PortDirection;
  dataType: string;
}

export interface Connection {
  id: string;
  sourcePortId: string;
  targetPortId: string;
}

export interface Candidate {
  sourcePortId: string;
  targetPortId: string;
  /** When reconnecting, the connection being replaced is exempt from duplicate/capacity checks. */
  replaceConnectionId?: string;
}

export interface Verdict {
  allowed: boolean;
  reason?: string;
}

export interface ValidationOptions {
  maxConnectionsPerInput?: number;
  /** Host rule evaluated after structural checks pass. */
  custom?: (candidate: Candidate, ctx: { source: Port; target: Port; connections: readonly Connection[] }) => boolean | Verdict;
}

export function portMap(ports: readonly Port[]): Map<string, Port> {
  return new Map(ports.map((p) => [p.id, p]));
}

/** Structural checks first, then the host rule. Reasons are meant to be shown to the user. */
export function validateCandidate(ports: readonly Port[] | Map<string, Port>, connections: readonly Connection[], c: Candidate, opts: ValidationOptions = {}): Verdict {
  const map = ports instanceof Map ? ports : portMap(ports);
  const source = map.get(c.sourcePortId);
  const target = map.get(c.targetPortId);
  if (!source) return { allowed: false, reason: "The source port no longer exists." };
  if (!target) return { allowed: false, reason: "The target port no longer exists." };
  if (source.id === target.id) return { allowed: false, reason: "A port cannot connect to itself." };
  if (source.direction !== "output") return { allowed: false, reason: `${source.label} is not an output.` };
  if (target.direction !== "input") return { allowed: false, reason: `${target.label} is not an input.` };
  if (source.dataType !== target.dataType) return { allowed: false, reason: `Type mismatch: ${source.dataType} → ${target.dataType}.` };
  const live = connections.filter((x) => x.id !== c.replaceConnectionId);
  if (live.some((x) => x.sourcePortId === c.sourcePortId && x.targetPortId === c.targetPortId)) return { allowed: false, reason: "Already connected." };
  const cap = opts.maxConnectionsPerInput ?? 1;
  if (live.filter((x) => x.targetPortId === c.targetPortId).length >= cap) return { allowed: false, reason: cap === 1 ? `${target.label} is already occupied.` : `${target.label} accepts at most ${cap} connections.` };
  if (opts.custom) {
    const r = opts.custom(c, { source, target, connections: live });
    if (typeof r === "boolean") return r ? { allowed: true } : { allowed: false, reason: "Not allowed by the host rule." };
    return r;
  }
  return { allowed: true };
}

export interface ConnectionDiagnostic {
  connectionId: string;
  message: string;
}

/** Split existing connections into drawable ones and diagnostics (never silently dropped). */
export function validateConnections(ports: readonly Port[], connections: readonly Connection[], opts: ValidationOptions = {}): { valid: Connection[]; diagnostics: ConnectionDiagnostic[] } {
  const map = portMap(ports);
  const valid: Connection[] = [];
  const diagnostics: ConnectionDiagnostic[] = [];
  const seen = new Set<string>();
  for (const c of connections) {
    if (seen.has(c.id)) {
      diagnostics.push({ connectionId: c.id, message: `Duplicate connection id "${c.id}".` });
      continue;
    }
    seen.add(c.id);
    // capacity/duplicates are checked against the already-accepted set so the first edge wins deterministically
    const v = validateCandidate(map, valid, { sourcePortId: c.sourcePortId, targetPortId: c.targetPortId }, { maxConnectionsPerInput: opts.maxConnectionsPerInput });
    if (!v.allowed) {
      diagnostics.push({ connectionId: c.id, message: v.reason ?? "Invalid connection." });
      continue;
    }
    valid.push(c);
  }
  return { valid, diagnostics };
}

export interface Point {
  x: number;
  y: number;
}

/** Nearest point within `radius` (Euclidean); null when none. Ties resolve to the first in order. */
export function nearestWithin<T extends { id: string; point: Point }>(p: Point, candidates: readonly T[], radius: number): T | null {
  let best: T | null = null;
  let bestD = radius;
  for (const c of candidates) {
    const d = Math.hypot(c.point.x - p.x, c.point.y - p.y);
    if (d <= bestD && (best === null || d < bestD)) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/**
 * Cable path from an output socket to an input socket. `slack` is a fraction
 * of the endpoint distance added as downward sag (clamped to `maxSlackPx`).
 * `mapping` draws a gentle S-curve without sag.
 */
export function cablePath(a: Point, b: Point, opts: { slack?: number; maxSlackPx?: number; style?: "patch" | "mapping" } = {}): string {
  const style = opts.style ?? "patch";
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (style === "mapping") {
    const cx = Math.max(24, Math.abs(dx) * 0.4);
    return `M ${r(a.x)} ${r(a.y)} C ${r(a.x + cx)} ${r(a.y)}, ${r(b.x - cx)} ${r(b.y)}, ${r(b.x)} ${r(b.y)}`;
  }
  const sag = Math.min(opts.maxSlackPx ?? 120, dist * (opts.slack ?? 0.18));
  const c1 = { x: a.x + dx * 0.3, y: a.y + dy * 0.3 + sag };
  const c2 = { x: a.x + dx * 0.7, y: a.y + dy * 0.7 + sag };
  return `M ${r(a.x)} ${r(a.y)} C ${r(c1.x)} ${r(c1.y)}, ${r(c2.x)} ${r(c2.y)}, ${r(b.x)} ${r(b.y)}`;
}

const r = (n: number) => Math.round(n * 10) / 10;
