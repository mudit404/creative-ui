/**
 * Graph model for FocusGraph: validation with diagnostics, adjacency maps
 * built once per revision, directed/undirected neighbourhoods, a small
 * deterministic seeded force layout with a bounded iteration budget, and
 * viewport fitting. Pure; no DOM.
 */

export interface GraphNode {
  id: string;
  label: string;
  category?: string;
  description?: string;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

export interface ValidEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphDiagnostic {
  message: string;
}

export function validateGraph(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): { nodes: GraphNode[]; edges: ValidEdge[]; diagnostics: GraphDiagnostic[] } {
  const diagnostics: GraphDiagnostic[] = [];
  const seen = new Set<string>();
  const okNodes: GraphNode[] = [];
  for (const n of nodes) {
    if (!n?.id) {
      diagnostics.push({ message: "Node without an id was ignored." });
      continue;
    }
    if (seen.has(n.id)) {
      diagnostics.push({ message: `Duplicate node id "${n.id}" was ignored.` });
      continue;
    }
    seen.add(n.id);
    okNodes.push(n);
  }
  const okEdges: ValidEdge[] = [];
  const edgeIds = new Set<string>();
  edges.forEach((e, i) => {
    const id = e.id ?? `${e.source}->${e.target}#${i}`;
    if (edgeIds.has(id)) {
      diagnostics.push({ message: `Duplicate edge id "${id}" was ignored.` });
      return;
    }
    if (!seen.has(e.source) || !seen.has(e.target)) {
      diagnostics.push({ message: `Edge "${id}" references a missing node (${!seen.has(e.source) ? e.source : e.target}).` });
      return;
    }
    edgeIds.add(id);
    okEdges.push({ id, source: e.source, target: e.target, label: e.label });
  });
  return { nodes: okNodes, edges: okEdges, diagnostics };
}

export interface Neighborhood {
  outbound: string[];
  inbound: string[];
  /** Union, de-duplicated, in first-seen order. */
  all: string[];
}

export type Adjacency = Map<string, Neighborhood>;

export function buildAdjacency(nodes: readonly GraphNode[], edges: readonly ValidEdge[]): Adjacency {
  const adj: Adjacency = new Map(nodes.map((n) => [n.id, { outbound: [], inbound: [], all: [] }]));
  const push = (list: string[], id: string) => {
    if (!list.includes(id)) list.push(id);
  };
  for (const e of edges) {
    const s = adj.get(e.source)!;
    const t = adj.get(e.target)!;
    push(s.outbound, e.target);
    push(t.inbound, e.source);
    push(s.all, e.target);
    push(t.all, e.source);
  }
  return adj;
}

export interface Position {
  x: number;
  y: number;
}

/** Mulberry32: deterministic across platforms. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic seed positions on a jittered ring, so SSR and client agree. */
export function seedPositions(nodes: readonly GraphNode[], seed: number, width: number, height: number): Record<string, Position> {
  const rand = rng(seed || 1);
  const out: Record<string, Position> = {};
  const r = Math.min(width, height) * 0.38;
  nodes.forEach((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2 + rand() * 0.3;
    const rr = r * (0.7 + rand() * 0.3);
    out[n.id] = { x: width / 2 + Math.cos(a) * rr, y: height / 2 + Math.sin(a) * rr };
  });
  return out;
}

export interface LayoutOptions {
  seed?: number;
  width: number;
  height: number;
  /** Hard iteration cap: the simulation never runs past it (bounded settling). */
  maxIterations?: number;
  /** Stop early when the largest displacement per step falls below this. */
  settleThreshold?: number;
  /** Positions to keep fixed (pinned by the user). */
  pinned?: Record<string, Position>;
}

/**
 * Small Fruchterman–Reingold style layout: repulsion between all nodes, spring
 * attraction along edges, mild gravity to the centre, cooling temperature.
 * Synchronous and bounded; returns settled positions and the iterations used.
 */
export function forceLayout(nodes: readonly GraphNode[], edges: readonly ValidEdge[], opts: LayoutOptions): { positions: Record<string, Position>; iterations: number; settled: boolean } {
  const { width, height } = opts;
  const maxIter = opts.maxIterations ?? 300;
  const threshold = opts.settleThreshold ?? 0.15;
  const pos = seedPositions(nodes, opts.seed ?? 1, width, height);
  for (const [id, p] of Object.entries(opts.pinned ?? {})) if (pos[id]) pos[id] = { ...p };
  const ids = nodes.map((n) => n.id);
  const n = ids.length;
  if (n === 0) return { positions: {}, iterations: 0, settled: true };
  const area = width * height;
  const k = Math.sqrt(area / n) * 0.8;
  let temp = Math.min(width, height) / 8;
  const cool = temp / maxIter;
  let iterations = 0;
  let settled = false;
  const disp = new Map<string, Position>();
  for (let it = 0; it < maxIter; it++) {
    iterations = it + 1;
    for (const id of ids) disp.set(id, { x: 0, y: 0 });
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[ids[i]!]!;
        const b = pos[ids[j]!]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          dx = 0.01 * (i % 2 ? 1 : -1);
          dy = 0.01;
          d = 0.0141;
        }
        const f = (k * k) / d;
        const da = disp.get(ids[i]!)!;
        const db = disp.get(ids[j]!)!;
        da.x += (dx / d) * f;
        da.y += (dy / d) * f;
        db.x -= (dx / d) * f;
        db.y -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = pos[e.source]!;
      const b = pos[e.target]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const f = (d * d) / k;
      const da = disp.get(e.source)!;
      const db = disp.get(e.target)!;
      da.x -= (dx / d) * f;
      da.y -= (dy / d) * f;
      db.x += (dx / d) * f;
      db.y += (dy / d) * f;
    }
    let maxMove = 0;
    for (const id of ids) {
      if (opts.pinned?.[id]) continue;
      const p = pos[id]!;
      const dv = disp.get(id)!;
      // gravity toward the centre keeps disconnected nodes in view
      dv.x += (width / 2 - p.x) * 0.05;
      dv.y += (height / 2 - p.y) * 0.05;
      const d = Math.max(0.01, Math.hypot(dv.x, dv.y));
      const step = Math.min(d, temp);
      const nx = Math.max(20, Math.min(width - 20, p.x + (dv.x / d) * step));
      const ny = Math.max(20, Math.min(height - 20, p.y + (dv.y / d) * step));
      maxMove = Math.max(maxMove, Math.hypot(nx - p.x, ny - p.y));
      p.x = nx;
      p.y = ny;
    }
    temp = Math.max(0.05, temp - cool);
    if (maxMove < threshold) {
      settled = true;
      break;
    }
    if (it === maxIter - 1 && maxMove < 1) settled = true; // within a pixel at the budget: good enough to call settled
  }
  const out: Record<string, Position> = {};
  for (const id of ids) out[id] = { x: Math.round(pos[id]!.x * 100) / 100, y: Math.round(pos[id]!.y * 100) / 100 };
  return { positions: out, iterations, settled };
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A viewBox that contains every position with padding, preserving the viewport aspect ratio. */
export function fitViewBox(positions: Record<string, Position>, viewport: { width: number; height: number }, padding = 40): ViewBox {
  const pts = Object.values(positions);
  if (!pts.length) return { x: 0, y: 0, w: viewport.width || 1, h: viewport.height || 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  let w = Math.max(1, maxX - minX + padding * 2);
  let h = Math.max(1, maxY - minY + padding * 2);
  const aspect = (viewport.width || 1) / (viewport.height || 1);
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
