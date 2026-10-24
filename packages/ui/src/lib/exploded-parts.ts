/**
 * Part mapping and explode math for ExplodedProduct. Works on Three.js
 * Object3D trees without a renderer, so it is unit-testable in Node:
 * resolve named node paths uniquely, reject overlapping part roots, snapshot
 * rest transforms once, and derive every position from rest + offset ×
 * progress (never accumulating deltas).
 */
import { Object3D, Vector3 } from "three";

export interface PartDefinition {
  id: string;
  /** Slash-separated node names from the model root, e.g. "Body/Shell". */
  nodePath: string;
  label: string;
  description?: string;
  /** Parent-local displacement at progress 1, in the asset's units. */
  offset: [number, number, number];
}

export interface PartDiagnostic {
  partId: string;
  message: string;
}

export interface ResolvedParts {
  resolved: Map<string, Object3D>;
  diagnostics: PartDiagnostic[];
}

/** Find a child by a slash path of names; returns null when any segment is missing or ambiguous. */
export function resolveNodePath(root: Object3D, nodePath: string): { node: Object3D | null; reason?: string } {
  const segments = nodePath.split("/").filter(Boolean);
  if (!segments.length) return { node: null, reason: "empty path" };
  let current: Object3D = root;
  for (const seg of segments) {
    const matches = current.children.filter((c) => c.name === seg);
    if (matches.length === 0) return { node: null, reason: `no child named "${seg}" under "${current.name || "root"}"` };
    if (matches.length > 1) return { node: null, reason: `"${seg}" is ambiguous under "${current.name || "root"}" (${matches.length} matches)` };
    current = matches[0]!;
  }
  return { node: current };
}

function isAncestor(a: Object3D, b: Object3D): boolean {
  let p: Object3D | null = b.parent;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  return false;
}

export function validateParts(root: Object3D, parts: readonly PartDefinition[]): ResolvedParts {
  const resolved = new Map<string, Object3D>();
  const diagnostics: PartDiagnostic[] = [];
  const seenIds = new Set<string>();
  for (const p of parts) {
    if (seenIds.has(p.id)) {
      diagnostics.push({ partId: p.id, message: `Duplicate part id "${p.id}".` });
      continue;
    }
    seenIds.add(p.id);
    if (!p.offset || p.offset.length !== 3 || !p.offset.every(Number.isFinite)) {
      diagnostics.push({ partId: p.id, message: `Part "${p.id}" needs a finite [x, y, z] offset.` });
      continue;
    }
    const { node, reason } = resolveNodePath(root, p.nodePath);
    if (!node) {
      diagnostics.push({ partId: p.id, message: `Part "${p.id}": path "${p.nodePath}" did not resolve (${reason}).` });
      continue;
    }
    if ([...resolved.values()].includes(node)) {
      diagnostics.push({ partId: p.id, message: `Part "${p.id}" resolves to the same node as another part.` });
      continue;
    }
    resolved.set(p.id, node);
  }
  // ancestor/descendant overlap would double-move geometry
  for (const [idA, a] of resolved) {
    for (const [idB, b] of resolved) {
      if (idA !== idB && isAncestor(a, b)) {
        diagnostics.push({ partId: idB, message: `Part "${idB}" is inside part "${idA}"; nested part roots are not supported.` });
        resolved.delete(idB);
      }
    }
  }
  return { resolved, diagnostics };
}

export type RestTransforms = Map<string, Vector3>;

/** Snapshot each part's rest position once (parent-local). */
export function snapshotRest(resolved: ReadonlyMap<string, Object3D>): RestTransforms {
  const out: RestTransforms = new Map();
  for (const [id, node] of resolved) out.set(id, node.position.clone());
  return out;
}

/** Derive every position from its rest transform; safe to call any number of times (C51-T01). */
export function applyProgress(resolved: ReadonlyMap<string, Object3D>, rest: RestTransforms, parts: readonly PartDefinition[], progress: number): void {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  for (const def of parts) {
    const node = resolved.get(def.id);
    const r = rest.get(def.id);
    if (!node || !r) continue;
    node.position.set(r.x + def.offset[0] * p, r.y + def.offset[1] * p, r.z + def.offset[2] * p);
  }
}

/** Restore exact rest positions. */
export function restoreRest(resolved: ReadonlyMap<string, Object3D>, rest: RestTransforms): void {
  for (const [id, node] of resolved) {
    const r = rest.get(id);
    if (r) node.position.copy(r);
  }
}
