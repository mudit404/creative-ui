"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  DOCK_SCHEMA_VERSION,
  allGroups,
  clampRatios,
  defaultLayout,
  groupOf,
  hitTest,
  layoutGeometry,
  minSizeOf,
  movePanel,
  panelsIn,
  placeMissing,
  removePanel,
  setActive,
  setRatios,
  validateLayout,
  type DockEdge,
  type DockLayout,
  type LayoutNode,
  type MinSizes,
  type MoveTarget,
  type Rect,
} from "@/lib/dock-layout";

export type { DockLayout, GroupNode, LayoutNode, MoveTarget, SplitNode } from "@/lib/dock-layout";
export { DOCK_SCHEMA_VERSION, defaultLayout as defaultDockLayout, validateLayout as validateDockLayout } from "@/lib/dock-layout";

export interface DockPanel {
  id: string;
  title: string;
  render: () => React.ReactNode;
  /** CSS px; defaults 120 × 80. */
  minWidth?: number;
  minHeight?: number;
  /** Defaults to true. */
  closable?: boolean;
}

export type LayoutChangeReason = "move" | "resize" | "close" | "activate" | "reset" | "recover";
export interface LayoutChangeMeta {
  reason: LayoutChangeReason;
  panelId?: string;
  /** Validation problems that forced a recovery. */
  problems?: string[];
}

export interface DockWorkspaceHandle {
  root: HTMLDivElement | null;
  focusPanel: (panelId: string) => void;
  resetLayout: () => void;
}

export interface DockWorkspaceProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  panels: readonly DockPanel[];
  layout?: DockLayout;
  defaultLayout?: DockLayout;
  /** One proposal per completed operation; previews never call it. */
  onLayoutChange?: (next: DockLayout, meta: LayoutChangeMeta) => void;
  /** Return false (sync or async) to keep the panel; it stays present until accepted. */
  onBeforeClose?: (panelId: string) => boolean | void | Promise<boolean | void>;
  activePanelId?: string;
  defaultActivePanelId?: string;
  onActivePanelChange?: (panelId: string) => void;
  /** Container width, in CSS px, below which the single-panel presentation is used. */
  compactBreakpoint?: number;
  /** Shape of the fallback layout when no layout is given. */
  variant?: "studio" | "analysis";
  /** Keyboard resize step in CSS px. */
  resizeStep?: number;
  label?: string;
  motion?: "auto" | "reduced" | "off";
  durationScale?: number;
}

const TAB_H = 32;
const HANDLE_PX = 8;
const DEFAULT_MIN = { minWidth: 120, minHeight: 80 };
const pct = (f: number) => `${(f * 100).toFixed(4)}%`;

function analysisLayout(ids: readonly string[]): DockLayout {
  if (ids.length < 2) return defaultLayout(ids);
  const left = ids.filter((_, i) => i % 2 === 0);
  const right = ids.filter((_, i) => i % 2 === 1);
  return {
    schemaVersion: DOCK_SCHEMA_VERSION,
    root: {
      type: "split",
      id: "s-root",
      direction: "row",
      ratios: [0.5, 0.5],
      children: [
        { type: "group", id: "g-left", tabs: left, active: left[0]! },
        { type: "group", id: "g-right", tabs: right, active: right[0]! },
      ],
    },
  };
}

/**
 * DockWorkspace — registered panels in split/tab groups with a versioned,
 * serializable layout.
 *
 * Independent limited implementation (no docking engine; see DECISIONS 017).
 * Panels render once in a flat list and are positioned from the layout tree's
 * ratios alone, so their content stays mounted across tab switches, resizes,
 * moves and compact mode. Drag shows only a preview; releasing over a legal
 * target proposes one next layout (controlled hosts stay authoritative), and
 * the panel menu offers the same moves without dragging. Closing asks
 * `onBeforeClose`; a declined close keeps the panel. Invalid persisted layouts
 * recover to the default with a visible reason. Narrow or over-constrained
 * containers switch to one active panel with a tab selector.
 */
export const DockWorkspace = React.forwardRef<DockWorkspaceHandle, DockWorkspaceProps>(function DockWorkspace(
  {
    panels,
    layout: layoutProp,
    defaultLayout: defaultLayoutProp,
    onLayoutChange,
    onBeforeClose,
    activePanelId: activeProp,
    defaultActivePanelId,
    onActivePanelChange,
    compactBreakpoint = 768,
    variant = "studio",
    resizeStep = 24,
    label = "Workspace",
    motion = "auto",
    durationScale = 1,
    className,
    style,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const ids = React.useMemo(() => panels.map((p) => p.id), [panels]);
  const idsKey = ids.join("\u0000");
  const fallback = React.useMemo(() => (variant === "analysis" ? analysisLayout(ids) : defaultLayout(ids)), [variant, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const mins = React.useMemo<MinSizes>(() => Object.fromEntries(panels.map((p) => [p.id, { minWidth: p.minWidth ?? DEFAULT_MIN.minWidth, minHeight: p.minHeight ?? DEFAULT_MIN.minHeight }])), [panels]);
  const byId = React.useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels]);

  /* ----------------------------------------------------------- layout state */
  const [internal, setInternal] = React.useState<DockLayout>(() => defaultLayoutProp ?? fallback);
  const [closed, setClosed] = React.useState<ReadonlySet<string>>(() => new Set());
  const source = layoutProp ?? internal;
  const problems = React.useMemo(() => validateLayout(source, ids), [source, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const recovered = problems.length > 0;
  const base = recovered ? fallback : source;
  const placed = React.useMemo(() => placeMissing(base, ids, closed), [base, idsKey, closed]); // eslint-disable-line react-hooks/exhaustive-deps

  /* container size */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const clamped = React.useMemo(() => (size.width > 0 ? clampRatios(placed, size, mins) : { layout: placed, fits: true }), [placed, size, mins]);
  const compact = size.width > 0 && (size.width < compactBreakpoint || !clamped.fits);

  /* previews (never persisted, C59-T08) */
  const [resizePreview, setResizePreview] = React.useState<DockLayout | null>(null);
  const [drag, setDrag] = React.useState<{ panelId: string; target: MoveTarget | null; valid: boolean; next: DockLayout | null; x: number; y: number } | null>(null);
  const shown = resizePreview ?? clamped.layout;
  const geometry = React.useMemo(() => layoutGeometry(shown.root), [shown]);

  /* active panel */
  const [internalActive, setInternalActive] = React.useState<string>(() => defaultActivePanelId ?? ids[0] ?? "");
  const activeId = activeProp ?? internalActive;
  const setActivePanel = (id: string) => {
    if (activeProp === undefined) setInternalActive(id);
    onActivePanelChange?.(id);
  };

  const latest = React.useRef({ onLayoutChange, onBeforeClose, panels, shown, clamped: clamped.layout, size, mins, geometry, controlled: layoutProp !== undefined });
  React.useEffect(() => {
    latest.current = { onLayoutChange, onBeforeClose, panels, shown, clamped: clamped.layout, size, mins, geometry, controlled: layoutProp !== undefined };
  });

  /** Propose one accepted layout (uncontrolled applies, controlled waits). */
  const [recoveredFrom, setRecoveredFrom] = React.useState<string | null>(null);
  const propose = (next: DockLayout, meta: LayoutChangeMeta) => {
    if (!latest.current.controlled) setInternal(next);
    setRecoveredFrom(null);
    latest.current.onLayoutChange?.(next, meta);
  };
  // recovery is reported once per invalid layout identity (C59-T05)
  const reportedRef = React.useRef<DockLayout | null>(null);
  React.useEffect(() => {
    if (!recovered || reportedRef.current === source) return;
    reportedRef.current = source;
    setRecoveredFrom(problems[0] ?? "invalid layout");
    if (!latest.current.controlled) setInternal(fallback);
    latest.current.onLayoutChange?.(fallback, { reason: "recover", problems });
  }, [recovered, source, fallback, problems]);

  /* status + focus bookkeeping */
  const [notice, setNotice] = React.useState<string | null>(null);
  const [closePending, setClosePending] = React.useState<string | null>(null);
  const focusPending = React.useRef<{ kind: "tab"; panelId: string } | { kind: "group"; groupId: string } | null>(null);
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useEffect(() => {
    const f = focusPending.current;
    if (!f) return;
    focusPending.current = null;
    if (f.kind === "tab") tabRefs.current.get(f.panelId)?.focus();
    else {
      const g = allGroups(latest.current.shown.root).find((x) => x.id === f.groupId) ?? allGroups(latest.current.shown.root)[0];
      const id = g?.active || g?.tabs[0];
      if (id) tabRefs.current.get(id)?.focus();
      else rootRef.current?.focus();
    }
  });

  /* ------------------------------------------------------------ operations */
  const activate = (panelId: string) => {
    setActivePanel(panelId);
    const g = groupOf(latest.current.clamped, panelId);
    if (g && g.active !== panelId) propose(setActive(latest.current.clamped, panelId), { reason: "activate", panelId });
  };
  const fitsAfter = (next: DockLayout) => {
    const { size: s, mins: m } = latest.current;
    return s.width === 0 || clampRatios(next, s, m).fits;
  };
  const tryMove = (panelId: string, target: MoveTarget): { next: DockLayout; valid: boolean } => {
    const cur = latest.current.clamped;
    const next = movePanel(cur, panelId, target);
    return { next, valid: next !== cur && fitsAfter(next) };
  };
  const commitMove = (panelId: string, target: MoveTarget) => {
    const { next, valid } = tryMove(panelId, target);
    if (!valid) return false;
    focusPending.current = { kind: "tab", panelId }; // focus follows the moved panel (C59-T07)
    setActivePanel(panelId);
    propose(next, { reason: "move", panelId });
    return true;
  };
  const close = async (panelId: string) => {
    const g = groupOf(latest.current.clamped, panelId);
    setClosePending(panelId);
    let allowed: boolean | void;
    try {
      allowed = await latest.current.onBeforeClose?.(panelId);
    } catch {
      allowed = false;
    }
    setClosePending(null);
    if (allowed === false) {
      setNotice(`"${byId.get(panelId)?.title ?? panelId}" was kept: the host declined the close.`);
      focusPending.current = { kind: "tab", panelId };
      return false;
    }
    setClosed((c) => new Set([...c, panelId]));
    const next = removePanel(latest.current.clamped, panelId);
    const remaining = g?.tabs.filter((t) => t !== panelId) ?? [];
    const neighbour = remaining[Math.min(remaining.length - 1, Math.max(0, (g?.tabs.indexOf(panelId) ?? 0)))];
    if (neighbour) {
      focusPending.current = { kind: "tab", panelId: neighbour };
      if (activeId === panelId) setActivePanel(neighbour);
    } else {
      focusPending.current = { kind: "group", groupId: allGroups(next.root)[0]?.id ?? "" };
      const first = panelsIn(next)[0];
      if (first && activeId === panelId) setActivePanel(first);
    }
    setNotice(null);
    propose(next, { reason: "close", panelId });
    return true;
  };
  const reset = () => {
    setClosed(new Set());
    setNotice(null);
    propose(fallback, { reason: "reset" });
  };
  React.useImperativeHandle(ref, () => ({
    root: rootRef.current,
    focusPanel: (id) => {
      const g = groupOf(latest.current.clamped, id);
      if (g) activate(id);
      focusPending.current = { kind: "tab", panelId: id };
      tabRefs.current.get(id)?.focus();
    },
    resetLayout: reset,
  }));

  /* ------------------------------------------------------------ tab drag */
  const dragRef = React.useRef<{ panelId: string; startX: number; startY: number; moved: boolean; rect: DOMRect; el: HTMLElement } | null>(null);
  const onTabPointerDown = (panelId: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || compact) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { panelId, startX: e.clientX, startY: e.clientY, moved: false, rect, el: e.currentTarget };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onTabPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
    d.moved = true;
    const px = (e.clientX - d.rect.left) / (d.rect.width || 1);
    const py = (e.clientY - d.rect.top) / (d.rect.height || 1);
    const inside = px >= 0 && px <= 1 && py >= 0 && py <= 1;
    const target = inside ? hitTest(latest.current.geometry, px, py) : null;
    const attempt = target ? tryMove(d.panelId, target) : null;
    setDrag({ panelId: d.panelId, target, valid: !!attempt?.valid, next: attempt?.valid ? attempt.next : null, x: px, y: py });
  };
  const endDrag = (commit: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag((cur) => {
      if (commit && cur && cur.target && cur.valid && d) commitMove(d.panelId, cur.target);
      return null;
    });
    if (d?.moved) suppressClick.current = true;
  };
  const suppressClick = React.useRef(false);
  const onTabPointerUp = () => endDrag(true);
  const onTabPointerCancel = () => endDrag(false);
  React.useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const d = dragRef.current;
        if (d?.el.hasPointerCapture?.(1)) d.el.releasePointerCapture(1);
        dragRef.current = null;
        setDrag(null);
        suppressClick.current = true;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drag]);

  /* ------------------------------------------------------------ resizing */
  const resizeRef = React.useRef<{ splitId: string; index: number; direction: "row" | "column"; start: number; ratios: number[]; along: number; base: DockLayout } | null>(null);
  const splitById = (id: string): { node: LayoutNode; along: number } | null => {
    const r = latest.current.geometry.splits.get(id);
    const find = (n: LayoutNode): LayoutNode | null => (n.type === "group" ? null : n.id === id ? n : n.children.map(find).find(Boolean) ?? null);
    const node = find(latest.current.shown.root);
    if (!r || !node || node.type !== "split") return null;
    return { node, along: node.direction === "row" ? r.w * latest.current.size.width : r.h * latest.current.size.height };
  };
  const stepRatios = (node: LayoutNode & { type: "split" }, index: number, deltaPx: number, along: number): number[] | null => {
    if (along <= 0) return null;
    const ratios = [...node.ratios];
    const a = node.children[index]!;
    const b = node.children[index + 1]!;
    const minA = (node.direction === "row" ? minSizeOf(a, latest.current.mins).width : minSizeOf(a, latest.current.mins).height) / along;
    const minB = (node.direction === "row" ? minSizeOf(b, latest.current.mins).width : minSizeOf(b, latest.current.mins).height) / along;
    const pair = ratios[index]! + ratios[index + 1]!;
    let next = ratios[index]! + deltaPx / along;
    next = Math.min(Math.max(next, minA), pair - minB);
    if (!Number.isFinite(next) || next < 0 || pair - next < 0) return null;
    ratios[index] = next;
    ratios[index + 1] = pair - next;
    return ratios;
  };
  const onHandlePointerDown = (h: { splitId: string; index: number; direction: "row" | "column" }) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const s = splitById(h.splitId);
    if (!s || s.node.type !== "split") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.focus();
    resizeRef.current = { ...h, start: h.direction === "row" ? e.clientX : e.clientY, ratios: s.node.ratios, along: s.along, base: latest.current.clamped };
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    const s = splitById(r.splitId);
    if (!s || s.node.type !== "split") return;
    const delta = (r.direction === "row" ? e.clientX : e.clientY) - r.start;
    const ratios = stepRatios({ ...s.node, ratios: r.ratios }, r.index, delta, r.along);
    if (ratios) setResizePreview(setRatios(r.base, r.splitId, ratios));
  };
  const onHandlePointerUp = () => {
    const r = resizeRef.current;
    resizeRef.current = null;
    setResizePreview((preview) => {
      if (preview && r) propose(preview, { reason: "resize" });
      return null;
    });
  };
  const onHandleKeyDown = (h: { splitId: string; index: number; direction: "row" | "column" }) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const s = splitById(h.splitId);
    if (!s || s.node.type !== "split") return;
    const dec = h.direction === "row" ? "ArrowLeft" : "ArrowUp";
    const inc = h.direction === "row" ? "ArrowRight" : "ArrowDown";
    let delta: number;
    if (e.key === dec) delta = -(e.shiftKey ? s.along * 0.1 : resizeStep);
    else if (e.key === inc) delta = e.shiftKey ? s.along * 0.1 : resizeStep;
    else if (e.key === "Home") delta = -s.along;
    else if (e.key === "End") delta = s.along;
    else if (e.key === "Enter") delta = (s.node.ratios[h.index]! + s.node.ratios[h.index + 1]!) * 0.5 * s.along - s.node.ratios[h.index]! * s.along; // click-step: even split
    else return;
    e.preventDefault();
    const ratios = stepRatios(s.node, h.index, delta, s.along);
    if (ratios) propose(setRatios(latest.current.clamped, h.splitId, ratios), { reason: "resize" });
  };

  /* ------------------------------------------------------------ menu */
  const [menu, setMenu] = React.useState<{ panelId: string; groupId: string; x: number; y: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuReturn = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
        menuReturn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  const openMenu = (panelId: string, groupId: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const b = e.currentTarget.getBoundingClientRect();
    menuReturn.current = e.currentTarget;
    setMenu({ panelId, groupId, x: b.left - (rect?.left ?? 0), y: b.bottom - (rect?.top ?? 0) });
  };
  const menuItems = React.useMemo(() => {
    if (!menu) return [];
    const items: { label: string; disabled: boolean; run: () => void }[] = [];
    if (!compact) {
      for (const edge of ["left", "right", "top", "bottom"] as DockEdge[]) {
        const t: MoveTarget = { groupId: menu.groupId, placement: edge };
        items.push({ label: `Move ${edge}`, disabled: !tryMove(menu.panelId, t).valid, run: () => commitMove(menu.panelId, t) });
      }
      for (const g of allGroups(shown.root)) {
        if (g.id === menu.groupId) continue;
        const t: MoveTarget = { groupId: g.id, placement: "tab" };
        const title = g.tabs.map((id) => byId.get(id)?.title ?? id).join(", ");
        items.push({ label: `Join ${title}`, disabled: !tryMove(menu.panelId, t).valid, run: () => commitMove(menu.panelId, t) });
      }
    }
    if (byId.get(menu.panelId)?.closable !== false) items.push({ label: "Close", disabled: closePending === menu.panelId, run: () => void close(menu.panelId) });
    items.push({ label: "Reset workspace", disabled: false, run: reset });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, compact, shown, byId, closePending]);

  /* ------------------------------------------------------------ render */
  const uid = React.useId();
  const groups = allGroups(shown.root);
  const placedIds = new Set(panelsIn(shown));
  const dur = mode === "full" ? Math.round(180 * durationScale) : 0;
  const animating = dur > 0 && !resizePreview && !drag;
  const transition = animating ? `left ${dur}ms ease-out, top ${dur}ms ease-out, width ${dur}ms ease-out, height ${dur}ms ease-out` : undefined;
  const state = drag ? "previewing" : closePending ? "close-pending" : compact ? "compact" : "ready";
  const compactActive = placedIds.has(activeId) ? activeId : panelsIn(shown)[0] ?? "";
  const previewRect = (): Rect | null => {
    if (!drag?.target) return null;
    const r = geometry.groups.get(drag.target.groupId);
    if (!r) return null;
    switch (drag.target.placement) {
      case "tab":
        return r;
      case "left":
        return { ...r, w: r.w / 2 };
      case "right":
        return { ...r, x: r.x + r.w / 2, w: r.w / 2 };
      case "top":
        return { ...r, h: r.h / 2 };
      case "bottom":
        return { ...r, y: r.y + r.h / 2, h: r.h / 2 };
    }
  };
  const pr = previewRect();

  const renderTabs = (g: { id: string; tabs: string[]; active: string }, rect: Rect | null) => (
    <div
      key={g.id}
      role="tablist"
      aria-label={compact ? `${label} panels` : `Group ${g.tabs.map((t) => byId.get(t)?.title ?? t).join(", ")}`}
      data-group={g.id}
      className="absolute flex items-stretch gap-px overflow-x-auto border-b border-[var(--cui-dock-divider,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] bg-[var(--cui-dock-tab,light-dark(#e9e5dc,#2a2a27))] text-[12px]"
      style={rect ? { left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: TAB_H, transition } : { left: 0, top: 0, right: 0, height: TAB_H }}
    >
      {g.tabs.map((id) => {
        const p = byId.get(id);
        const selected = compact ? id === compactActive : id === g.active;
        return (
          <div key={id} className={cn("flex shrink-0 items-stretch", selected && "bg-[var(--cui-dock-active,light-dark(#faf9f6,#1f1f1c))]")} data-tab={id} data-selected={selected || undefined}>
            <button
              ref={(el) => {
                if (el) tabRefs.current.set(id, el);
                else tabRefs.current.delete(id);
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              draggable={false}
              onPointerDown={onTabPointerDown(id)}
              onPointerMove={onTabPointerMove}
              onPointerUp={onTabPointerUp}
              onPointerCancel={onTabPointerCancel}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                activate(id);
              }}
              onKeyDown={(e) => {
                const i = g.tabs.indexOf(id);
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const n = g.tabs[(i + (e.key === "ArrowRight" ? 1 : g.tabs.length - 1)) % g.tabs.length]!;
                  activate(n);
                  focusPending.current = { kind: "tab", panelId: n };
                } else if (e.key === "Delete" && p?.closable !== false) {
                  e.preventDefault();
                  void close(id);
                }
              }}
              className={cn("touch-none select-none px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cui-dock-focus,light-dark(#141311,#ecebe6))]", drag?.panelId === id && "opacity-50")}
            >
              {p?.title ?? id}
            </button>
            <button type="button" aria-label={`${p?.title ?? id} panel menu`} aria-haspopup="menu" aria-expanded={menu?.panelId === id} onClick={openMenu(id, g.id)} className="px-1.5 text-[11px] text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))] outline-none hover:text-[var(--cui-dock-text,light-dark(#141311,#ecebe6))] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cui-dock-focus,light-dark(#141311,#ecebe6))]">
              ▾
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      ref={rootRef}
      data-slot="dock-workspace"
      data-motion={mode}
      data-state={state}
      data-compact={compact || undefined}
      data-measured={size.width > 0 || undefined}
      data-recovered={recovered || !!recoveredFrom || undefined}
      role="group"
      aria-label={label}
      tabIndex={-1}
      className={cn("relative isolate h-[480px] w-full overflow-hidden rounded-xl border border-[var(--cui-dock-divider,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] bg-[var(--cui-dock-active,light-dark(#faf9f6,#1f1f1c))] text-[13px] text-[var(--cui-dock-text,light-dark(#141311,#ecebe6))] outline-none", className)}
      style={style}
      {...rest}
    >
      {/* tab strips */}
      {compact ? renderTabs({ id: "compact", tabs: panelsIn(shown), active: compactActive }, null) : groups.map((g) => renderTabs(g, geometry.groups.get(g.id) ?? null))}

      {/* panels: one flat list, positioned by geometry, mounted once (C59-T09) */}
      {panels.map((p) => {
        const g = groupOf(shown, p.id);
        const rect = g ? geometry.groups.get(g.id) : null;
        const visible = !!g && placedIds.has(p.id) && (compact ? p.id === compactActive : g.active === p.id);
        const pos: React.CSSProperties = compact
          ? { left: 0, top: TAB_H, right: 0, bottom: 0 }
          : rect
            ? { left: pct(rect.x), top: `calc(${pct(rect.y)} + ${TAB_H}px)`, width: pct(rect.w), height: `calc(${pct(rect.h)} - ${TAB_H}px)`, transition }
            : { left: 0, top: TAB_H, width: 0, height: 0 };
        return (
          <div key={p.id} role="tabpanel" id={`${uid}-panel-${p.id}`} aria-labelledby={`${uid}-tab-${p.id}`} data-panel={p.id} data-closing={closePending === p.id || undefined} hidden={!visible} className="absolute overflow-auto border-r border-[var(--cui-dock-divider,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] p-3" style={pos}>
            {p.render()}
          </div>
        );
      })}

      {/* resize handles */}
      {!compact &&
        geometry.handles.map((h) => {
          const sNode = (() => {
            const find = (n: LayoutNode): LayoutNode | null => (n.type === "group" ? null : n.id === h.splitId ? n : n.children.map(find).find(Boolean) ?? null);
            return find(shown.root);
          })();
          const before = sNode?.type === "split" ? sNode.ratios[h.index]! : 0;
          const pair = sNode?.type === "split" ? sNode.ratios[h.index]! + sNode.ratios[h.index + 1]! : 1;
          const style: React.CSSProperties =
            h.direction === "row"
              ? { left: `calc(${pct(h.rect.x)} - ${HANDLE_PX / 2}px)`, top: pct(h.rect.y), width: HANDLE_PX, height: pct(h.rect.h), cursor: "col-resize", transition }
              : { left: pct(h.rect.x), top: `calc(${pct(h.rect.y)} - ${HANDLE_PX / 2}px)`, width: pct(h.rect.w), height: HANDLE_PX, cursor: "row-resize", transition };
          return (
            <div
              key={`${h.splitId}-${h.index}`}
              role="separator"
              tabIndex={0}
              aria-orientation={h.direction === "row" ? "vertical" : "horizontal"}
              aria-label={`Resize ${h.direction === "row" ? "columns" : "rows"}`}
              aria-valuenow={Math.round((before / pair) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              data-handle={`${h.splitId}:${h.index}`}
              onPointerDown={onHandlePointerDown(h)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              onKeyDown={onHandleKeyDown(h)}
              className="absolute z-10 touch-none outline-none before:absolute before:inset-0 before:m-auto before:bg-[var(--cui-dock-divider,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] before:content-[''] hover:before:bg-[var(--cui-dock-focus,light-dark(#141311,#ecebe6))] focus-visible:before:bg-[var(--cui-dock-focus,light-dark(#141311,#ecebe6))] data-[orientation=vertical]:before:w-px data-[orientation=horizontal]:before:h-px"
              data-orientation={h.direction === "row" ? "vertical" : "horizontal"}
              style={style}
            />
          );
        })}

      {/* docking preview (decorative; never a layout) */}
      {drag && (
        <div aria-hidden data-preview data-valid={drag.valid} className={cn("pointer-events-none absolute z-20 rounded-md border-2", drag.valid ? "border-[var(--cui-dock-preview,light-dark(#1a6b45,#5fcf8f))] bg-[var(--cui-dock-preview,light-dark(#1a6b45,#5fcf8f))]/15" : "border-dashed border-[var(--cui-dock-error,light-dark(#b8310c,#ff8a65))] bg-[var(--cui-dock-error,light-dark(#b8310c,#ff8a65))]/10")} style={pr ? { left: pct(pr.x), top: pct(pr.y), width: pct(pr.w), height: pct(pr.h) } : { left: pct(drag.x), top: pct(drag.y), width: 80, height: 32, transform: "translate(-50%, -50%)" }}>
          {!drag.valid && <span className="absolute left-1 top-1 rounded bg-[var(--cui-dock-active,light-dark(#faf9f6,#1f1f1c))] px-1 text-[11px]">{drag.target ? "Unavailable" : "Release outside to cancel"}</span>}
        </div>
      )}

      {/* panel menu */}
      {menu && (
        <div ref={menuRef} role="menu" aria-label={`${byId.get(menu.panelId)?.title ?? menu.panelId} actions`} className="absolute z-30 min-w-40 rounded-lg border border-[var(--cui-dock-divider,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] bg-[var(--cui-dock-active,light-dark(#faf9f6,#1f1f1c))] p-1 shadow-lg" style={{ left: Math.max(0, menu.x), top: menu.y }}>
          {menuItems.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              aria-disabled={it.disabled || undefined}
              onClick={() => {
                if (it.disabled) return;
                setMenu(null);
                it.run();
              }}
              className={cn("block w-full rounded px-2 py-1 text-left text-[12px] outline-none hover:bg-[var(--cui-dock-tab,light-dark(#e9e5dc,#2a2a27))] focus-visible:bg-[var(--cui-dock-tab,light-dark(#e9e5dc,#2a2a27))]", it.disabled && "opacity-40")}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}

      {/* status */}
      <div role="status" className="pointer-events-none absolute bottom-1 right-2 z-10 max-w-[70%] truncate text-right text-[11px] opacity-70" data-status>
        {notice ?? (recovered || recoveredFrom ? `Saved layout could not be restored (${problems[0] ?? recoveredFrom}); showing the default.` : compact ? (size.width < compactBreakpoint ? "Compact: one panel at a time." : "Panels do not fit at this size; showing one at a time.") : "")}
      </div>
    </div>
  );
});
DockWorkspace.displayName = "DockWorkspace";
