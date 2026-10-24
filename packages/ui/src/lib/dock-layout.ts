/**
 * Layout model for DockWorkspace: a versioned tree of splits and tab groups
 * addressed by stable panel ids. Validation (unknown/duplicate ids, ratio
 * bounds, structure), a default layout, pure moves, removal, ratio clamping
 * against minimum sizes and normalisation. No React, no DOM.
 */

export const DOCK_SCHEMA_VERSION = 1;

export interface GroupNode {
  type: "group";
  id: string;
  tabs: string[];
  active: string;
}

export interface SplitNode {
  type: "split";
  id: string;
  direction: "row" | "column";
  ratios: number[];
  children: LayoutNode[];
}

export type LayoutNode = GroupNode | SplitNode;

export interface DockLayout {
  schemaVersion: number;
  root: LayoutNode;
}

export type DockEdge = "left" | "right" | "top" | "bottom";
export type MoveTarget = { groupId: string; placement: DockEdge | "tab" };

let idCounter = 0;
const nid = (prefix: string) => `${prefix}-${++idCounter}`;

export function defaultLayout(panelIds: readonly string[]): DockLayout {
  const [main, ...rest] = panelIds;
  const groups: GroupNode[] = [];
  if (main) groups.push({ type: "group", id: "g-main", tabs: [main], active: main });
  if (rest.length) groups.push({ type: "group", id: "g-side", tabs: [...rest], active: rest[0]! });
  const root: LayoutNode = groups.length === 2 ? { type: "split", id: "s-root", direction: "row", ratios: [0.7, 0.3], children: groups } : groups[0] ?? { type: "group", id: "g-main", tabs: [], active: "" };
  return { schemaVersion: DOCK_SCHEMA_VERSION, root };
}

/** Problems that make a layout unusable; empty means valid (C59-T05). */
export function validateLayout(layout: unknown, panelIds: readonly string[]): string[] {
  const out: string[] = [];
  const l = layout as DockLayout | null;
  if (!l || typeof l !== "object" || !l.root) return ["Layout is missing a root."];
  if (l.schemaVersion !== DOCK_SCHEMA_VERSION) out.push(`Unsupported schemaVersion ${String(l.schemaVersion)} (expected ${DOCK_SCHEMA_VERSION}).`);
  const known = new Set(panelIds);
  const seenPanels = new Set<string>();
  const seenNodes = new Set<string>();
  const visit = (n: LayoutNode, depth: number) => {
    if (depth > 32) {
      out.push("Layout is too deep (cycle or runaway nesting).");
      return;
    }
    if (!n || typeof n !== "object" || !("type" in n)) {
      out.push("Malformed node.");
      return;
    }
    if (seenNodes.has(n.id)) {
      out.push(`Node id "${n.id}" appears twice (cycle).`);
      return;
    }
    seenNodes.add(n.id);
    if (n.type === "group") {
      if (!Array.isArray(n.tabs)) {
        out.push(`Group "${n.id}" has no tabs array.`);
        return;
      }
      for (const t of n.tabs) {
        if (!known.has(t)) out.push(`Unknown panel id "${t}".`);
        if (seenPanels.has(t)) out.push(`Duplicate panel id "${t}".`);
        seenPanels.add(t);
      }
      if (n.tabs.length && !n.tabs.includes(n.active)) out.push(`Group "${n.id}" activates "${n.active}", which it does not contain.`);
    } else if (n.type === "split") {
      if (!Array.isArray(n.children) || n.children.length < 2) out.push(`Split "${n.id}" needs at least two children.`);
      else {
        if (!Array.isArray(n.ratios) || n.ratios.length !== n.children.length || n.ratios.some((r) => !Number.isFinite(r) || r <= 0)) out.push(`Split "${n.id}" has invalid ratios.`);
        else if (Math.abs(n.ratios.reduce((a, b) => a + b, 0) - 1) > 0.01) out.push(`Split "${n.id}" ratios must sum to 1.`);
        n.children.forEach((c) => visit(c, depth + 1));
      }
    } else out.push(`Unknown node type.`);
  };
  visit(l.root, 0);
  return out;
}

export function allGroups(node: LayoutNode): GroupNode[] {
  return node.type === "group" ? [node] : node.children.flatMap(allGroups);
}

export function groupOf(layout: DockLayout, panelId: string): GroupNode | null {
  return allGroups(layout.root).find((g) => g.tabs.includes(panelId)) ?? null;
}

export function panelsIn(layout: DockLayout): string[] {
  return allGroups(layout.root).flatMap((g) => g.tabs);
}

/** Remove a panel; empty groups collapse and single-child splits unwrap. */
export function removePanel(layout: DockLayout, panelId: string): DockLayout {
  const prune = (n: LayoutNode): LayoutNode | null => {
    if (n.type === "group") {
      if (!n.tabs.includes(panelId)) return n;
      const tabs = n.tabs.filter((t) => t !== panelId);
      if (!tabs.length) return null;
      return { ...n, tabs, active: tabs.includes(n.active) ? n.active : tabs[0]! };
    }
    const kept: { node: LayoutNode; ratio: number }[] = [];
    n.children.forEach((c, i) => {
      const p = prune(c);
      if (p) kept.push({ node: p, ratio: n.ratios[i]! });
    });
    if (!kept.length) return null;
    if (kept.length === 1) return kept[0]!.node;
    const total = kept.reduce((a, k) => a + k.ratio, 0);
    return { ...n, children: kept.map((k) => k.node), ratios: kept.map((k) => k.ratio / total) };
  };
  const root = prune(layout.root);
  return { schemaVersion: layout.schemaVersion, root: root ?? { type: "group", id: "g-empty", tabs: [], active: "" } };
}

/**
 * Move a panel next to / into a target group. Pure; returns the same layout
 * when the move is a no-op (C59-T02: menu and drag share this).
 */
export function movePanel(layout: DockLayout, panelId: string, target: MoveTarget): DockLayout {
  const from = groupOf(layout, panelId);
  if (!from) return layout;
  if (target.placement === "tab" && from.id === target.groupId) return layout;
  if (target.placement !== "tab" && from.id === target.groupId && from.tabs.length === 1) return layout; // alone already
  const without = removePanel(layout, panelId);
  const targetStillExists = allGroups(without.root).some((g) => g.id === target.groupId);
  if (!targetStillExists) return layout;
  const insert = (n: LayoutNode): LayoutNode => {
    if (n.type === "group") {
      if (n.id !== target.groupId) return n;
      if (target.placement === "tab") return { ...n, tabs: [...n.tabs, panelId], active: panelId };
      const newGroup: GroupNode = { type: "group", id: nid("g"), tabs: [panelId], active: panelId };
      const direction = target.placement === "left" || target.placement === "right" ? "row" : "column";
      const first = target.placement === "left" || target.placement === "top";
      return { type: "split", id: nid("s"), direction, ratios: [0.5, 0.5], children: first ? [newGroup, n] : [n, newGroup] };
    }
    return { ...n, children: n.children.map(insert) };
  };
  return normalize({ ...without, root: insert(without.root) });
}

/** Merge nested splits of the same direction so ratios stay meaningful. */
export function normalize(layout: DockLayout): DockLayout {
  const norm = (n: LayoutNode): LayoutNode => {
    if (n.type === "group") return n;
    const children: LayoutNode[] = [];
    const ratios: number[] = [];
    n.children.forEach((c, i) => {
      const nc = norm(c);
      if (nc.type === "split" && nc.direction === n.direction) {
        nc.children.forEach((gc, j) => {
          children.push(gc);
          ratios.push(n.ratios[i]! * nc.ratios[j]!);
        });
      } else {
        children.push(nc);
        ratios.push(n.ratios[i]!);
      }
    });
    return { ...n, children, ratios };
  };
  return { ...layout, root: norm(layout.root) };
}

export function setRatios(layout: DockLayout, splitId: string, ratios: number[]): DockLayout {
  const total = ratios.reduce((a, b) => a + b, 0) || 1;
  const next = ratios.map((r) => r / total);
  const walk = (n: LayoutNode): LayoutNode => (n.type === "group" ? n : n.id === splitId ? { ...n, ratios: next } : { ...n, children: n.children.map(walk) });
  return { ...layout, root: walk(layout.root) };
}

export function setActive(layout: DockLayout, panelId: string): DockLayout {
  const walk = (n: LayoutNode): LayoutNode => (n.type === "group" ? (n.tabs.includes(panelId) ? { ...n, active: panelId } : n) : { ...n, children: n.children.map(walk) });
  return { ...layout, root: walk(layout.root) };
}

export interface MinSizes {
  [panelId: string]: { minWidth?: number; minHeight?: number };
}

/** Minimum size a node needs (sum along the split direction, max across it). */
export function minSizeOf(n: LayoutNode, mins: MinSizes): { width: number; height: number } {
  if (n.type === "group") {
    let w = 0;
    let h = 0;
    for (const t of n.tabs) {
      w = Math.max(w, mins[t]?.minWidth ?? 0);
      h = Math.max(h, mins[t]?.minHeight ?? 0);
    }
    return { width: w, height: h };
  }
  const sizes = n.children.map((c) => minSizeOf(c, mins));
  return n.direction === "row" ? { width: sizes.reduce((a, s) => a + s.width, 0), height: Math.max(...sizes.map((s) => s.height)) } : { width: Math.max(...sizes.map((s) => s.width)), height: sizes.reduce((a, s) => a + s.height, 0) };
}

/**
 * Clamp every split's ratios so each child keeps its minimum size inside the
 * container (C59-T03, C59-T06). Returns `fits: false` when the minimums
 * cannot fit at all (callers switch to compact mode).
 */
export function clampRatios(layout: DockLayout, container: { width: number; height: number }, mins: MinSizes): { layout: DockLayout; fits: boolean } {
  let fits = true;
  const walk = (n: LayoutNode, size: { width: number; height: number }): LayoutNode => {
    if (n.type === "group") {
      const m = minSizeOf(n, mins);
      if (m.width > size.width + 0.5 || m.height > size.height + 0.5) fits = false;
      return n;
    }
    const along = n.direction === "row" ? size.width : size.height;
    const minimums = n.children.map((c) => (n.direction === "row" ? minSizeOf(c, mins).width : minSizeOf(c, mins).height));
    const totalMin = minimums.reduce((a, b) => a + b, 0);
    let ratios = [...n.ratios];
    if (totalMin > along + 0.5) {
      fits = false;
    } else {
      // raise children below their minimum, take the difference from the largest surplus
      for (let iter = 0; iter < 8; iter++) {
        let changed = false;
        ratios = ratios.map((r, i) => {
          const px = r * along;
          if (px < minimums[i]!) {
            changed = true;
            return minimums[i]! / along;
          }
          return r;
        });
        const sum = ratios.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) < 1e-6 && !changed) break;
        const surplusIdx = ratios.map((r, i) => r * along - minimums[i]!);
        const totalSurplus = surplusIdx.reduce((a, b) => a + Math.max(0, b), 0) || 1;
        const excess = sum - 1;
        ratios = ratios.map((r, i) => r - (Math.max(0, surplusIdx[i]!) / totalSurplus) * excess);
      }
    }
    const children = n.children.map((c, i) => walk(c, n.direction === "row" ? { width: ratios[i]! * size.width, height: size.height } : { width: size.width, height: ratios[i]! * size.height }));
    return { ...n, ratios, children };
  };
  return { layout: { ...layout, root: walk(layout.root, container) }, fits };
}

/* ---------------------------------------------------------------- geometry */

/** Fractions (0–1) of the container. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface HandleGeometry {
  splitId: string;
  index: number;
  direction: "row" | "column";
  /** Position of the boundary line as a fraction along the split's axis, inside the split's rect. */
  rect: Rect;
}
export interface LayoutGeometry {
  groups: Map<string, Rect>;
  splits: Map<string, Rect>;
  handles: HandleGeometry[];
}

/**
 * Every group's rect, every split's rect and every resize handle derived from
 * the ratios alone — no DOM measurement, so panels can be positioned
 * absolutely and never remount when they move (C59-T09).
 */
export function layoutGeometry(root: LayoutNode, container: Rect = { x: 0, y: 0, w: 1, h: 1 }): LayoutGeometry {
  const groups = new Map<string, Rect>();
  const splits = new Map<string, Rect>();
  const handles: HandleGeometry[] = [];
  const walk = (n: LayoutNode, r: Rect) => {
    if (n.type === "group") {
      groups.set(n.id, r);
      return;
    }
    splits.set(n.id, r);
    let offset = 0;
    n.children.forEach((c, i) => {
      const f = n.ratios[i] ?? 0;
      const child: Rect = n.direction === "row" ? { x: r.x + offset * r.w, y: r.y, w: f * r.w, h: r.h } : { x: r.x, y: r.y + offset * r.h, w: r.w, h: f * r.h };
      walk(c, child);
      offset += f;
      if (i < n.children.length - 1) {
        handles.push({ splitId: n.id, index: i, direction: n.direction, rect: n.direction === "row" ? { x: r.x + offset * r.w, y: r.y, w: 0, h: r.h } : { x: r.x, y: r.y + offset * r.h, w: r.w, h: 0 } });
      }
    });
  };
  walk(root, container);
  return { groups, splits, handles };
}

/** Which group and placement a pointer (container fractions) is over; null outside every group. */
export function hitTest(geometry: LayoutGeometry, px: number, py: number): MoveTarget | null {
  for (const [groupId, r] of geometry.groups) {
    if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) continue;
    const u = r.w ? (px - r.x) / r.w : 0.5;
    const v = r.h ? (py - r.y) / r.h : 0.5;
    if (u >= 0.25 && u <= 0.75 && v >= 0.25 && v <= 0.75) return { groupId, placement: "tab" };
    const d: [number, DockEdge][] = [
      [u, "left"],
      [1 - u, "right"],
      [v, "top"],
      [1 - v, "bottom"],
    ];
    d.sort((a, b) => a[0] - b[0]);
    return { groupId, placement: d[0]![1] };
  }
  return null;
}

/** Add registered panels that no group holds to the first group (unknown-panel handling, C59-T05). */
export function placeMissing(layout: DockLayout, panelIds: readonly string[], skip: ReadonlySet<string> = new Set()): DockLayout {
  const present = new Set(panelsIn(layout));
  const missing = panelIds.filter((id) => !present.has(id) && !skip.has(id));
  if (!missing.length) return layout;
  const groups = allGroups(layout.root);
  if (!groups.length) return { ...layout, root: { type: "group", id: "g-main", tabs: [...missing], active: missing[0]! } };
  const first = groups[0]!;
  const walk = (n: LayoutNode): LayoutNode => (n.type === "group" ? (n.id === first.id ? { ...n, tabs: [...n.tabs, ...missing], active: n.active || missing[0]! } : n) : { ...n, children: n.children.map(walk) });
  return { ...layout, root: walk(layout.root) };
}
