"use client";

import * as React from "react";
import { motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { buildAdjacency, fitViewBox, forceLayout, seedPositions, validateGraph, type GraphEdge, type GraphNode, type Position, type ViewBox } from "@/lib/graph-model";

export type { GraphEdge, GraphNode, Position } from "@/lib/graph-model";

export interface FocusGraphHandle {
  root: HTMLDivElement | null;
  focusNode: (id: string) => void;
  fitViewport: () => void;
}

export interface FocusGraphProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  directed?: boolean;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelectedIdChange?: (id: string | null, reason: "canvas" | "list" | "neighbor" | "clear" | "removed") => void;
  layout?: "seeded-force" | "authored";
  seed?: number;
  /** Iteration cap for the synchronous layout (bounded settling). */
  settleBudget?: number;
  /** Required for `authored`; optional pins otherwise. */
  positions?: Record<string, Position>;
  renderDetails?: (node: GraphNode, neighbors: { outbound: GraphNode[]; inbound: GraphNode[]; all: GraphNode[] }) => React.ReactNode;
  nodeLabel?: (node: GraphNode) => string;
  nodeDescription?: (node: GraphNode) => string | undefined;
  /** Category → colour; the legend is generated from it. */
  categoryColors?: Record<string, string>;
  variant?: "dependencies" | "knowledge" | "authored";
  /** Below this root width the list is shown first and the graph on request. */
  narrowBreakpoint?: number;
  label?: string;
  motion?: "auto" | "reduced" | "off";
}

const W = 720;
const H = 480;
const PALETTE = ["#ff4d1c", "#1d2a6b", "#1f7a4f", "#c8a000", "#7a4fff", "#0f8b8d", "#b5176b", "#5c6b73"];

/**
 * FocusGraph — a searchable constellation with a semantic list, neighbour
 * details and a bounded, deterministic layout.
 *
 * The list, search, details and neighbour lists work from the data alone;
 * the SVG is an enhancement. The seeded force layout runs synchronously with
 * an iteration cap and settles; under full motion the nodes animate from
 * their seed positions to the settled ones once, under reduced motion they
 * appear settled. Zoom, pan and focus only move the viewBox.
 */
export const FocusGraph = React.forwardRef<FocusGraphHandle, FocusGraphProps>(function FocusGraph(
  {
    nodes: nodesProp,
    edges: edgesProp,
    directed = false,
    selectedId: selectedProp,
    defaultSelectedId = null,
    onSelectedIdChange,
    layout = "seeded-force",
    seed = 1,
    settleBudget = 300,
    positions: positionsProp,
    renderDetails,
    nodeLabel,
    nodeDescription,
    categoryColors,
    variant = "knowledge",
    narrowBreakpoint = 640,
    label = "Graph",
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const authored = layout === "authored" || variant === "authored";

  /* data: validated once per revision (C56-T01) */
  const graph = React.useMemo(() => validateGraph(nodesProp, edgesProp), [nodesProp, edgesProp]);
  const adj = React.useMemo(() => buildAdjacency(graph.nodes, graph.edges), [graph]);
  const byId = React.useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const nameOf = (n: GraphNode) => (nodeLabel ? nodeLabel(n) : n.label);
  const categories = React.useMemo(() => [...new Set(graph.nodes.map((n) => n.category).filter((c): c is string => !!c))], [graph]);
  const colorOf = (n: GraphNode) => (n.category ? (categoryColors?.[n.category] ?? PALETTE[categories.indexOf(n.category) % PALETTE.length]!) : "var(--cui-graph-node, #141311)");

  /* layout: synchronous and bounded (C56-T04); authored positions are used verbatim (C56-T08) */
  const [pins, setPins] = React.useState<Record<string, Position>>({});
  const computed = React.useMemo(() => {
    if (authored) {
      const pos: Record<string, Position> = {};
      for (const n of graph.nodes) pos[n.id] = positionsProp?.[n.id] ?? seedPositions([n], seed + n.id.length, W, H)[n.id]!;
      return { positions: pos, iterations: 0, settled: true };
    }
    return forceLayout(graph.nodes, graph.edges, { seed, width: W, height: H, maxIterations: settleBudget, pinned: { ...positionsProp, ...pins } });
  }, [authored, graph, positionsProp, seed, settleBudget, pins]);
  const seeds = React.useMemo(() => (authored ? computed.positions : seedPositions(graph.nodes, seed, W, H)), [authored, computed, graph, seed]);
  const positions = computed.positions;

  /* selection (controlled or local); a removed selection is announced and cleared (C56-T05) */
  const [internalSel, setInternalSel] = React.useState<string | null>(defaultSelectedId);
  const selectedId = selectedProp !== undefined ? selectedProp : internalSel;
  const [notice, setNotice] = React.useState("");
  const [seenNodes, setSeenNodes] = React.useState(graph.nodes);
  const [removed, setRemoved] = React.useState<{ id: string; key: number } | null>(null);
  if (seenNodes !== graph.nodes) {
    setSeenNodes(graph.nodes);
    if (selectedId && !byId.has(selectedId)) {
      setNotice(`The selected node "${selectedId}" was removed.`);
      setRemoved((r) => ({ id: selectedId, key: (r?.key ?? 0) + 1 }));
      if (selectedProp === undefined) setInternalSel(null);
    }
  }
  const onSelRef = React.useRef(onSelectedIdChange);
  React.useEffect(() => {
    onSelRef.current = onSelectedIdChange;
  });
  React.useEffect(() => {
    if (removed) onSelRef.current?.(null, "removed");
  }, [removed]);
  const select = (id: string | null, reason: "canvas" | "list" | "neighbor" | "clear") => {
    if (selectedProp === undefined) setInternalSel(id);
    onSelectedIdChange?.(id, reason);
    if (id) setNotice("");
  };
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const hood = selected ? adj.get(selected.id)! : null;
  const neighborSet = new Set(hood?.all ?? []);

  /* viewport: a viewBox, animated under full motion only; relationships never change (C56-T06) */
  const [view, setView] = React.useState<ViewBox>({ x: 0, y: 0, w: W, h: H });
  const fit = () => setView(fitViewBox(positions, { width: W, height: H }, 60));
  const zoomBy = (f: number) => setView((v) => ({ x: v.x + (v.w - v.w * f) / 2, y: v.y + (v.h - v.h * f) / 2, w: v.w * f, h: v.h * f }));
  const pan = (dx: number, dy: number) => setView((v) => ({ ...v, x: v.x + dx * v.w, y: v.y + dy * v.h }));
  const focusNode = (id: string) => {
    const p = positions[id];
    if (!p) return;
    setView((v) => ({ x: p.x - v.w / 2, y: p.y - v.h / 2, w: v.w, h: v.h }));
  };
  const viewBox = `${r(view.x)} ${r(view.y)} ${r(view.w)} ${r(view.h)}`;

  /* node drag pins a local position without touching data; Reset discards pins */
  const svgRef = React.useRef<SVGSVGElement>(null);
  const drag = React.useRef<{ id: string; pointerId: number; el: Element; moved: boolean } | null>(null);
  const toGraph = (clientX: number, clientY: number): Position => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return { x: clientX, y: clientY };
    return { x: view.x + ((clientX - rect.left) / rect.width) * view.w, y: view.y + ((clientY - rect.top) / rect.height) * view.h };
  };
  const onNodeDown = (id: string) => (e: React.PointerEvent<SVGGElement>) => {
    if (authored || e.button !== 0) return;
    drag.current = { id, pointerId: e.pointerId, el: e.currentTarget, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onNodeMove = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.moved = true;
    const p = toGraph(e.clientX, e.clientY);
    setPins((prev) => ({ ...prev, [d.id]: p }));
  };
  const onNodeUp = (e: React.PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      d.el.releasePointerCapture(d.pointerId);
    } catch {
      /* released */
    }
    drag.current = null;
  };

  /* narrow: list first (mobile) */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = React.useState(false);
  const [graphRequested, setGraphRequested] = React.useState(false);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < narrowBreakpoint));
    ro.observe(el);
    return () => ro.disconnect();
  }, [narrowBreakpoint]);
  const showGraph = !narrow || graphRequested;

  /* search filters the list only (C56-T07) */
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const listed = q ? graph.nodes.filter((n) => nameOf(n).toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) : graph.nodes;

  const listButtonRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusNode: (id) => { select(id, "list"); focusNode(id); listButtonRefs.current.get(id)?.focus(); }, fitViewport: fit }));

  const uid = React.useId();
  const neighborNodes = (ids: string[]) => ids.map((id) => byId.get(id)).filter((n): n is GraphNode => !!n);
  const edgeMuted = (e: { source: string; target: string }) => !!selected && e.source !== selected.id && e.target !== selected.id;
  const full = mode === "full";
  const transition = { type: "spring" as const, duration: 0.6, bounce: 0 };

  return (
    <div
      ref={rootRef}
      data-slot="focus-graph"
      data-variant={variant}
      data-motion={mode}
      data-layout={authored ? "authored" : "seeded-force"}
      data-settled={computed.settled || undefined}
      data-narrow={narrow || undefined}
      role="group"
      aria-label={label}
      className={cn("grid w-full gap-3 text-[var(--cui-graph-text,#141311)]", showGraph && !narrow && "md:grid-cols-[260px_1fr]", className)}
      {...rest}
    >
      {/* semantic panel: search, list, details */}
      <div className="flex min-w-0 flex-col gap-2">
        <input type="search" aria-label="Search nodes" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 rounded-md border border-[var(--cui-graph-edge,rgba(20,19,17,0.25))] bg-transparent px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-graph-selected,#141311)]" />
        <p className="m-0 text-[11px] opacity-70">
          {listed.length} of {graph.nodes.length} nodes{q ? " match" : ""} · {graph.edges.length} edges
          {graph.diagnostics.length ? ` · ${graph.diagnostics.length} invalid` : ""}
        </p>
        <ul aria-label="Nodes" className="m-0 max-h-56 list-none overflow-y-auto p-0 text-[13px]">
          {listed.map((n) => (
            <li key={n.id}>
              <button
                ref={(el) => {
                  if (el) listButtonRefs.current.set(n.id, el);
                  else listButtonRefs.current.delete(n.id);
                }}
                type="button"
                aria-pressed={n.id === selectedId}
                onClick={() => select(n.id === selectedId ? null : n.id, n.id === selectedId ? "clear" : "list")}
                className={cn("flex w-full items-center gap-2 rounded px-1.5 py-1 text-left outline-none hover:bg-[rgba(20,19,17,0.05)] focus-visible:ring-2 focus-visible:ring-[var(--cui-graph-selected,#141311)]", n.id === selectedId && "bg-[rgba(20,19,17,0.08)] font-medium", neighborSet.has(n.id) && "underline decoration-dotted")}
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(n) }} />
                <span className="truncate">{nameOf(n)}</span>
              </button>
            </li>
          ))}
        </ul>
        {graph.diagnostics.length > 0 && (
          <div role="note" className="rounded-lg border border-[var(--cui-graph-error,#c8360d)] p-2 text-[11px] text-[var(--cui-graph-error,#c8360d)]">
            {graph.diagnostics.map((d, i) => (
              <div key={i}>{d.message}</div>
            ))}
          </div>
        )}
        <div data-details aria-live="polite" className="rounded-xl border border-[var(--cui-graph-edge,rgba(20,19,17,0.15))] p-3 text-[13px]">
          {notice && <p className="m-0 mb-1 text-[12px] text-[var(--cui-graph-error,#c8360d)]">{notice}</p>}
          {selected && hood ? (
            renderDetails ? (
              renderDetails(selected, { outbound: neighborNodes(hood.outbound), inbound: neighborNodes(hood.inbound), all: neighborNodes(hood.all) })
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <strong>{nameOf(selected)}</strong>
                  {showGraph && (
                    <button type="button" onClick={() => focusNode(selected.id)} className={BTN}>
                      Focus
                    </button>
                  )}
                </div>
                {(nodeDescription?.(selected) ?? selected.description) && <p className="m-0 mt-1 opacity-80">{nodeDescription?.(selected) ?? selected.description}</p>}
                {directed ? (
                  <>
                    <NeighborList title="Depends on" ids={hood.outbound} byId={byId} nameOf={nameOf} onPick={(id) => select(id, "neighbor")} />
                    <NeighborList title="Used by" ids={hood.inbound} byId={byId} nameOf={nameOf} onPick={(id) => select(id, "neighbor")} />
                  </>
                ) : (
                  <NeighborList title="Connected to" ids={hood.all} byId={byId} nameOf={nameOf} onPick={(id) => select(id, "neighbor")} />
                )}
              </>
            )
          ) : (
            <span className="opacity-60">Select a node to see its neighbours.</span>
          )}
        </div>
        {narrow && (
          <button type="button" aria-pressed={graphRequested} onClick={() => setGraphRequested((v) => !v)} className={BTN}>
            {graphRequested ? "Hide graph" : "Show graph"}
          </button>
        )}
      </div>

      {/* graph canvas (enhancement) */}
      {showGraph && (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1 text-[12px]">
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(0.8)} className={BTN}>
              +
            </button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1.25)} className={BTN}>
              −
            </button>
            <button type="button" onClick={fit} className={BTN}>
              Fit
            </button>
            <button type="button" aria-label="Pan left" onClick={() => pan(-0.2, 0)} className={BTN}>
              ←
            </button>
            <button type="button" aria-label="Pan right" onClick={() => pan(0.2, 0)} className={BTN}>
              →
            </button>
            <button type="button" aria-label="Pan up" onClick={() => pan(0, -0.2)} className={BTN}>
              ↑
            </button>
            <button type="button" aria-label="Pan down" onClick={() => pan(0, 0.2)} className={BTN}>
              ↓
            </button>
            {!authored && (
              <button type="button" onClick={() => setPins({})} disabled={!Object.keys(pins).length} className={BTN}>
                Reset layout
              </button>
            )}
            {categories.length > 0 && (
              <ul aria-label="Legend" className="m-0 ml-auto flex list-none flex-wrap gap-2 p-0">
                {categories.map((c) => (
                  <li key={c} className="flex items-center gap-1">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: categoryColors?.[c] ?? PALETTE[categories.indexOf(c) % PALETTE.length] }} />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <m.svg
            ref={svgRef}
            data-canvas
            role="img"
            aria-labelledby={`${uid}-title`}
            {...(full ? { initial: false, animate: { viewBox }, transition: { duration: 0.26, ease: "easeOut" as const } } : {})}
            viewBox={viewBox}
            className="aspect-[3/2] w-full select-none rounded-2xl border border-[var(--cui-graph-edge,rgba(20,19,17,0.12))] bg-[var(--cui-graph-bg,#faf9f6)]"
          >
            <title id={`${uid}-title`}>
              {label}: {graph.nodes.length} nodes, {graph.edges.length} edges
            </title>
            {directed && (
              <defs>
                <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="22" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cui-graph-edge, rgba(20,19,17,0.45))" />
                </marker>
              </defs>
            )}
            <g data-edges>
              {graph.edges.map((e) => {
                const a = positions[e.source]!;
                const b = positions[e.target]!;
                const sa = seeds[e.source] ?? a;
                const sb = seeds[e.target] ?? b;
                const muted = edgeMuted(e);
                const style = {
                  stroke: muted ? "var(--cui-graph-muted, rgba(20,19,17,0.12))" : selected ? "var(--cui-graph-selected, #141311)" : "var(--cui-graph-edge, rgba(20,19,17,0.35))",
                  strokeWidth: !muted && selected ? 2 : 1.2,
                  markerEnd: directed ? `url(#${uid}-arrow)` : undefined,
                };
                // reduced/off: plain SVG (synchronous geometry); full: one settle animation from the seeds
                return full ? (
                  <m.line key={e.id} data-edge={e.id} initial={{ x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y }} animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }} transition={transition} {...style} />
                ) : (
                  <line key={e.id} data-edge={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...style} />
                );
              })}
            </g>
            <g data-nodes>
              {graph.nodes.map((n) => {
                const p = positions[n.id]!;
                const s = seeds[n.id] ?? p;
                const isSel = n.id === selectedId;
                const near = neighborSet.has(n.id);
                const muted = !!selected && !isSel && !near;
                const handlers = {
                  onPointerDown: onNodeDown(n.id),
                  onPointerMove: onNodeMove,
                  onPointerUp: onNodeUp,
                  onPointerCancel: onNodeUp,
                  onClick: () => {
                    if (drag.current?.moved) return;
                    select(isSel ? null : n.id, isSel ? "clear" : "canvas");
                  },
                };
                const shared = { "data-node": n.id, "data-selected": isSel || undefined, "data-muted": muted || undefined };
                const Wrap = full ? m.g : "g";
                const motionProps = full ? { initial: { x: s.x, y: s.y }, animate: { x: p.x, y: p.y }, transition, style: { cursor: authored ? "pointer" : "grab" } } : { style: { cursor: authored ? "pointer" : "grab", transform: `translateX(${p.x}px) translateY(${p.y}px)` } };
                return (
                  <Wrap key={n.id} {...shared} {...handlers} {...(motionProps as object)}>
                    <circle r={isSel ? 11 : 8} fill={colorOf(n)} opacity={muted ? 0.25 : 1} stroke={isSel ? "var(--cui-graph-selected, #141311)" : "none"} strokeWidth={3} />
                    {(isSel || near || graph.nodes.length <= 24) && (
                      <text y={-14} textAnchor="middle" fontSize={11} fill="var(--cui-graph-text, #141311)" opacity={muted ? 0.3 : 1} className="pointer-events-none">
                        {nameOf(n)}
                      </text>
                    )}
                  </Wrap>
                );
              })}
            </g>
          </m.svg>
        </div>
      )}
      <div role="status" className="sr-only">
        {selected ? `${nameOf(selected)} selected, ${hood?.all.length ?? 0} neighbours.` : notice}
      </div>
    </div>
  );
});
FocusGraph.displayName = "FocusGraph";

const r = (n: number) => Math.round(n * 10) / 10;
const BTN =
  "inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--cui-graph-edge,rgba(20,19,17,0.25))] px-2 text-[12px] outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-graph-selected,#141311)] disabled:opacity-40";

function NeighborList({ title, ids, byId, nameOf, onPick }: { title: string; ids: string[]; byId: Map<string, GraphNode>; nameOf: (n: GraphNode) => string; onPick: (id: string) => void }) {
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
        {title} ({ids.length})
      </div>
      {ids.length === 0 ? (
        <p className="m-0 text-[12px] opacity-60">None.</p>
      ) : (
        <ul aria-label={title} className="m-0 flex list-none flex-wrap gap-1 p-0">
          {ids.map((id) => {
            const n = byId.get(id);
            if (!n) return null;
            return (
              <li key={id}>
                <button type="button" onClick={() => onPick(id)} className="rounded-full border border-[var(--cui-graph-edge,rgba(20,19,17,0.2))] px-2 py-0.5 text-[12px] outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-graph-selected,#141311)]">
                  {nameOf(n)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
