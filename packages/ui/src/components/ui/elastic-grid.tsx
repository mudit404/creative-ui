"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion as m, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getPointer, subscribePointer } from "@/lib/pointer-field";

export type ElasticGridMotion = "auto" | "reduced" | "off";
export type ElasticGridSpring = "soft" | "snappy" | "stiff";

export interface ElasticGridProps extends Omit<React.HTMLAttributes<HTMLUListElement>, "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  /** Fixed column count. When omitted, columns come from `minCellWidth` and the container width. */
  columns?: number;
  /** Minimum cell width in px used to derive the column count. */
  minCellWidth?: number;
  /** Maximum derived column count. */
  maxColumns?: number;
  /** Gap between cells, px. */
  gap?: number;
  /** 0–1. How much the column under the pointer grows (0.4 = 40% wider). */
  stretch?: number;
  /** Reach of the stretch in columns: neighbours within this distance yield proportionally. */
  reach?: number;
  spring?: ElasticGridSpring;
  /** `auto` follows prefers-reduced-motion; `reduced` keeps layout animation short and disables stretch; `off` is instant. */
  motion?: ElasticGridMotion;
  children?: React.ReactNode;
}

export interface ElasticGridItemProps extends Omit<React.LiHTMLAttributes<HTMLLIElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  /** CSS aspect ratio of the cell, e.g. "4 / 3". Omit for content-sized cells. */
  aspect?: string;
  children?: React.ReactNode;
}

interface Ctx {
  mode: "full" | "reduced" | "off";
  columns: number;
  setFocusColumn: (col: number | null) => void;
  activeColumn: number | null;
}

const GridContext = React.createContext<Ctx | null>(null);
const IndexContext = React.createContext(0);

const MAX_TRACKS = 12;
const SPRINGS: Record<ElasticGridSpring, { stiffness: number; damping: number }> = {
  soft: { stiffness: 140, damping: 18 },
  snappy: { stiffness: 260, damping: 24 },
  stiff: { stiffness: 420, damping: 32 },
};

/**
 * ElasticGrid — a catalog grid whose columns stretch toward the pointer and
 * settle back, with layout animation for filtering and sorting.
 *
 * Semantics: a `<ul>` of `<li>` cells; put links, buttons or cards inside.
 * The column tracks are `fr` weights on springs: the column under the pointer
 * (or holding keyboard focus) grows by `stretch`, columns within `reach` yield
 * proportionally, and everything returns to equal widths when the pointer
 * leaves. Cells are Motion `layout` elements, so reordering or filtering the
 * children animates them to their new places.
 */
export const ElasticGrid = React.forwardRef<HTMLUListElement, ElasticGridProps>(function ElasticGrid(
  {
    columns: columnsProp,
    minCellWidth = 180,
    maxColumns = 6,
    gap = 12,
    stretch = 0.4,
    reach = 1.5,
    spring = "snappy",
    motion = "auto",
    className,
    style,
    children,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  const listRef = React.useRef<HTMLUListElement>(null);
  React.useImperativeHandle(ref, () => listRef.current as HTMLUListElement);

  /* ── column count ── */
  const [derived, setDerived] = React.useState(1);
  React.useEffect(() => {
    if (columnsProp) return;
    const el = listRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      const n = Math.max(1, Math.min(maxColumns, Math.floor((w + gap) / (minCellWidth + gap))));
      setDerived(n);
    };
    compute();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [columnsProp, minCellWidth, maxColumns, gap]);
  const columns = Math.max(1, Math.min(MAX_TRACKS, columnsProp ?? derived));

  /* ── elastic track weights (fixed pool so hook count is constant) ── */
  const targets = useTrackValues();
  const sprung = useTrackSprings(targets, SPRINGS[spring]);
  const template = useTransform(sprung, (ws: number[]) =>
    ws
      .slice(0, columns)
      .map((w) => `${Math.max(0.2, w).toFixed(4)}fr`)
      .join(" "),
  );

  const [activeColumn, setActiveColumn] = React.useState<number | null>(null);
  const focusColumn = React.useRef<number | null>(null);
  const applyWeights = React.useCallback(
    (xFrac: number | null) => {
      for (let i = 0; i < MAX_TRACKS; i++) {
        let w = 1;
        if (xFrac !== null && i < columns) {
          const center = (i + 0.5) / columns;
          const dCols = Math.abs(xFrac - center) * columns;
          const t = Math.max(0, 1 - dCols / reach);
          w = 1 + stretch * t * t;
        }
        targets[i]!.set(w);
      }
    },
    [columns, reach, stretch, targets],
  );

  React.useEffect(() => {
    const el = listRef.current;
    if (!el || mode !== "full") {
      applyWeights(null);
      return;
    }
    let raf = 0;
    let pending = false;
    let inside = false;
    const probe = () => {
      pending = false;
      const p = getPointer();
      if (focusColumn.current !== null) return; // keyboard focus wins
      if (!p.present || p.coarse) {
        if (inside) {
          inside = false;
          applyWeights(null);
          setActiveColumn(null);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      const within = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
      if (!within) {
        if (inside) {
          inside = false;
          applyWeights(null);
          setActiveColumn(null);
        }
        return;
      }
      inside = true;
      const x = (p.x - r.left) / Math.max(1, r.width);
      applyWeights(x);
      const col = Math.min(columns - 1, Math.floor(x * columns));
      setActiveColumn((c) => (c === col ? c : col));
    };
    const unsubscribe = subscribePointer(() => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(probe);
    });
    return () => {
      unsubscribe();
      if (raf) cancelAnimationFrame(raf);
      applyWeights(null);
    };
  }, [mode, columns, applyWeights]);

  const setFocusColumn = React.useCallback(
    (col: number | null) => {
      focusColumn.current = col;
      if (mode !== "full") return;
      applyWeights(col === null ? null : (col + 0.5) / columns);
      setActiveColumn(col);
    },
    [applyWeights, columns, mode],
  );

  const ctx = React.useMemo<Ctx>(() => ({ mode, columns, setFocusColumn, activeColumn }), [mode, columns, setFocusColumn, activeColumn]);
  const kids = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <GridContext.Provider value={ctx}>
      <LayoutGroup>
        <m.ul
          ref={listRef}
          data-slot="elastic-grid"
          data-columns={columns}
          data-motion={mode}
          data-active-column={activeColumn ?? undefined}
          className={cn("grid list-none p-0 m-0", className)}
          style={{ gap, gridTemplateColumns: mode === "full" ? template : `repeat(${columns}, minmax(0, 1fr))`, ...style }}
          onFocus={onFocus}
          onBlur={onBlur}
          {...(rest as Omit<React.ComponentProps<typeof m.ul>, "ref">)}
        >
          {mode === "off" ? (
            kids.map((child, index) => (
              <IndexContext.Provider key={child.key ?? index} value={index}>
                {child}
              </IndexContext.Provider>
            ))
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {kids.map((child, index) => (
                <IndexContext.Provider key={child.key ?? index} value={index}>
                  {child}
                </IndexContext.Provider>
              ))}
            </AnimatePresence>
          )}
        </m.ul>
      </LayoutGroup>
    </GridContext.Provider>
  );
});
ElasticGrid.displayName = "ElasticGrid";

/** Twelve motion values, created once. */
function useTrackValues(): MotionValue<number>[] {
  const a = useMotionValue(1), b = useMotionValue(1), c = useMotionValue(1), d = useMotionValue(1);
  const e = useMotionValue(1), f = useMotionValue(1), g = useMotionValue(1), h = useMotionValue(1);
  const i = useMotionValue(1), j = useMotionValue(1), k = useMotionValue(1), l = useMotionValue(1);
  return React.useMemo(() => [a, b, c, d, e, f, g, h, i, j, k, l], [a, b, c, d, e, f, g, h, i, j, k, l]);
}
function useTrackSprings(values: MotionValue<number>[], cfg: { stiffness: number; damping: number }): MotionValue<number>[] {
  const s0 = useSpring(values[0]!, cfg), s1 = useSpring(values[1]!, cfg), s2 = useSpring(values[2]!, cfg), s3 = useSpring(values[3]!, cfg);
  const s4 = useSpring(values[4]!, cfg), s5 = useSpring(values[5]!, cfg), s6 = useSpring(values[6]!, cfg), s7 = useSpring(values[7]!, cfg);
  const s8 = useSpring(values[8]!, cfg), s9 = useSpring(values[9]!, cfg), s10 = useSpring(values[10]!, cfg), s11 = useSpring(values[11]!, cfg);
  return React.useMemo(() => [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11], [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11]);
}

/* ───────────────────────────── item ───────────────────────────── */

export const ElasticGridItem = React.forwardRef<HTMLLIElement, ElasticGridItemProps>(function ElasticGridItem(
  { aspect, className, style, children, onFocus, onBlur, ...rest },
  ref,
) {
  const grid = React.useContext(GridContext);
  if (!grid) throw new Error("ElasticGrid.Item must be used inside ElasticGrid");
  const index = React.useContext(IndexContext);
  const col = index % grid.columns;
  const hovered = grid.activeColumn === col;
  const t = grid.mode === "full" ? { type: "spring" as const, stiffness: 320, damping: 30 } : { duration: grid.mode === "off" ? 0 : 0.15 };

  return (
    <m.li
      ref={ref}
      layout={grid.mode === "off" ? false : "position"}
      initial={grid.mode === "off" ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={grid.mode === "off" ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.92, transition: { duration: 0.16 } }}
      transition={t}
      data-slot="elastic-grid-item"
      data-column={col}
      data-hovered={hovered || undefined}
      className={cn("relative min-w-0 overflow-hidden rounded-[var(--eg-radius,14px)] bg-[var(--eg-cell,rgba(20,19,17,0.06))] outline-none", className)}
      style={{ aspectRatio: aspect, ...style }}
      onFocus={(e: React.FocusEvent<HTMLLIElement>) => {
        onFocus?.(e);
        grid.setFocusColumn(col);
      }}
      onBlur={(e: React.FocusEvent<HTMLLIElement>) => {
        onBlur?.(e);
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) grid.setFocusColumn(null);
      }}
      {...(rest as Omit<React.ComponentProps<typeof m.li>, "ref">)}
    >
      {children}
    </m.li>
  );
});
ElasticGridItem.displayName = "ElasticGrid.Item";
