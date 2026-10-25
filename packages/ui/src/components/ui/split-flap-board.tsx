"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { DEFAULT_CHARACTER_SET, changedCells, fitCells, formatNumeric, graphemes, needsWholeContent, staggerSchedule, supportedByCharacterSet } from "@/lib/flap-cells";

export interface SplitFlapBoardHandle {
  root: HTMLDivElement | null;
  /** The element holding the single accessible string. */
  text: HTMLSpanElement | null;
}

export interface SplitFlapBoardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The truthful current value. */
  value: string | number;
  characterSet?: readonly string[];
  variant?: "characters" | "whole" | "numeric";
  /** Fixed number of cells; defaults to the value's length (numeric right-aligns). */
  cells?: number;
  /** Total flip time per cell (front half + settle), ms. */
  flipDuration?: number;
  stagger?: number;
  maxSettle?: number;
  animateOnMount?: boolean;
  /** Pauses decorative animation; data still updates. */
  paused?: boolean;
  overflow?: "wrap" | "scroll" | "ellipsis";
  announce?: "off" | "polite";
  placeholder?: string;
  /** Decorative completion only. */
  onSettled?: (value: string) => void;
  label?: string;
  motion?: "auto" | "reduced" | "off";
}

interface CellState {
  /** Glyph currently shown on the settled faces. */
  shown: string;
  /** Glyph the cell is flipping toward (null when settled). */
  next: string | null;
  /** 0 = settled, 1 = front half rotating down, 2 = lower half settling. */
  phase: 0 | 1 | 2;
}

/**
 * SplitFlapBoard — mechanical split-flap cells for changing status values.
 *
 * The accessible string is a single element that always holds the latest
 * source value; the flaps are aria-hidden decoration. Only changed cells
 * animate, each with a 100 ms front half, a glyph swap at the hidden
 * midpoint and a 100 ms settle, staggered but capped so the board settles
 * within `maxSettle`. Newer values replace the pending target (queue of
 * one). Shaped scripts and unsupported glyphs use whole-content rendering.
 */
export const SplitFlapBoard = React.forwardRef<SplitFlapBoardHandle, SplitFlapBoardProps>(function SplitFlapBoard(
  {
    value,
    characterSet = DEFAULT_CHARACTER_SET,
    variant = "characters",
    cells: cellsProp,
    flipDuration = 200,
    stagger = 20,
    maxSettle = 600,
    animateOnMount = false,
    paused = false,
    overflow = "wrap",
    announce = "off",
    placeholder = "—",
    onSettled,
    label,
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const text = formatNumeric(value, placeholder);
  const whole = variant === "whole" || needsWholeContent(text) || (variant === "characters" && !supportedByCharacterSet(graphemes(text), characterSet));
  const target = React.useMemo(() => {
    if (whole) return [text];
    const g = graphemes(text);
    const n = cellsProp ?? g.length;
    return fitCells(g, n, variant === "numeric" ? "right" : "left");
  }, [text, whole, cellsProp, variant]);
  const animated = mode === "full" && !paused;

  /* mechanical state: initialised to the SSR value (no spinning blanks, C47-T07) */
  const [cells, setCells] = React.useState<CellState[]>(() => target.map((g) => ({ shown: animateOnMount ? " " : g, next: null, phase: 0 })));
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const pendingRef = React.useRef<string[] | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const onSettledRef = React.useRef(onSettled);
  React.useEffect(() => {
    onSettledRef.current = onSettled;
  });
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, text: textRef.current }));

  const targetKey = target.join("\u0000");
  const cellsRef = React.useRef(cells);
  React.useEffect(() => {
    cellsRef.current = cells;
  });
  const [pending, setPending] = React.useState(false);

  /** Flip one cell: front half down, glyph swap at the hidden midpoint (to whatever is latest), lower half settles. */
  const flipCell = React.useCallback(
    (i: number, glyph: string) => {
      const t = timers.current;
      setCells((cs) => cs.map((c, j) => (j === i ? { ...c, next: glyph, phase: 1 } : c)));
      t.set(
        i,
        setTimeout(() => {
          setCells((cs) => cs.map((c, j) => (j === i ? { shown: pendingRef.current?.[i] ?? glyph, next: null, phase: 2 } : c)));
          t.set(
            i,
            setTimeout(() => {
              t.delete(i);
              setCells((cs) => cs.map((c, j) => (j === i ? { ...c, phase: 0 } : c)));
            }, flipDuration / 2),
          );
        }, flipDuration / 2),
      );
    },
    [flipDuration],
  );
  /** Route settled cells that differ from `latest` toward it, staggered within the budget. */
  const routeTo = React.useCallback(
    (latest: string[], base: CellState[]) => {
      const current = base.map((c) => (c.phase === 0 ? c.shown : (c.next ?? c.shown)));
      const changed = changedCells(current, latest).filter((i) => (base[i]?.phase ?? 0) === 0);
      const delays = staggerSchedule(changed, flipDuration, stagger, maxSettle);
      for (const i of changed) {
        const delay = delays.get(i) ?? 0;
        if (delay) timers.current.set(i, setTimeout(() => flipCell(i, latest[i]!), delay));
        else flipCell(i, latest[i]!);
      }
    },
    [flipCell, flipDuration, stagger, maxSettle],
  );

  React.useEffect(() => {
    const t = timers.current;
    if (!animated) {
      // reduced motion / paused / off: show the latest value immediately (C47-T06)
      t.forEach(clearTimeout);
      t.clear();
      pendingRef.current = null;
      setPending(false);
      setCells(target.map((g) => ({ shown: g, next: null, phase: 0 })));
      return;
    }
    pendingRef.current = target; // queue of one: the latest target wins (C47-T01)
    setPending(true);
    let base = cellsRef.current;
    if (base.length !== target.length) {
      base = target.map((g, i) => base[i] ?? { shown: g, next: null, phase: 0 });
      setCells(base);
    }
    routeTo(target, base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, animated]);

  // when every cell has settled, either finish or re-route to a newer target that arrived mid-flip
  const settled = cells.every((c) => c.phase === 0);
  const shownKey = cells.map((c) => c.shown).join("\u0000");
  React.useEffect(() => {
    if (!animated || !settled) return;
    const latest = pendingRef.current;
    if (!latest) return;
    if (changedCells(cells.map((c) => c.shown), latest).length === 0) {
      pendingRef.current = null;
      setPending(false);
      onSettledRef.current?.(latest.join(""));
      return;
    }
    routeTo(latest, cells);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, shownKey, animated]);

  React.useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
      t.clear();
    };
  }, []);
  // document hidden: pause decoration, restore the latest state on return
  React.useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        timers.current.forEach(clearTimeout);
        timers.current.clear();
      } else {
        const latest = pendingRef.current;
        if (latest) setCells(latest.map((g) => ({ shown: g, next: null, phase: 0 })));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const half = flipDuration / 2;
  return (
    <div
      ref={rootRef}
      data-slot="split-flap-board"
      data-variant={whole ? "whole" : variant}
      data-motion={mode}
      data-state={pending ? "flipping" : "settled"}
      data-paused={paused || undefined}
      className={cn("inline-flex max-w-full flex-col gap-1 text-[var(--cui-flap-glyph,light-dark(#141311,#ecebe6))]", className)}
      {...rest}
    >
      {/* the one accessible string (C47-T03) */}
      <span ref={textRef} className="sr-only" aria-label={label} role={announce === "polite" ? "status" : undefined} aria-live={announce === "polite" ? "polite" : undefined} aria-atomic="true">
        {text}
      </span>
      <div
        aria-hidden
        data-faces
        className={cn("flex gap-[3px]", overflow === "wrap" && "flex-wrap", overflow === "scroll" && "overflow-x-auto", overflow === "ellipsis" && "overflow-hidden", whole && "flex-nowrap")}
        style={{ perspective: 600 }}
      >
        {cells.map((c, i) => (
          <span
            key={i}
            data-cell
            data-phase={c.phase}
            className={cn(
              "relative inline-block select-none overflow-hidden rounded-[4px] bg-[var(--cui-flap-face,light-dark(#faf9f6,#2a2a27))] font-mono tabular-nums shadow-[inset_0_0_0_1px_light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15))]",
              whole ? "px-3" : "",
            )}
            style={{ width: whole ? "auto" : "var(--cui-flap-width, 36px)", height: "var(--cui-flap-height, 52px)", fontSize: "calc(var(--cui-flap-height, 52px) * 0.6)", lineHeight: "var(--cui-flap-height, 52px)", textAlign: "center"} as React.CSSProperties}
          >
            {/* static halves */}
            <span className="absolute inset-x-0 top-0 h-1/2 overflow-hidden" data-top>
              <span className="block">{c.phase === 1 ? c.next : c.shown}</span>
            </span>
            <span className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden" data-bottom>
              <span className="block" style={{ transform: "translateY(-100%)" }}>
                {c.shown}
              </span>
            </span>
            {/* moving flap: rotates down from the top in phase 1, then the lower half lands in phase 2 */}
            {c.phase !== 0 && (
              <span
                data-flap
                className="absolute inset-x-0 overflow-hidden bg-[var(--cui-flap-face,light-dark(#faf9f6,#2a2a27))]"
                style={{
                  top: c.phase === 1 ? 0 : "50%",
                  height: "50%",
                  transformOrigin: c.phase === 1 ? "bottom" : "top",
                  animation: `${c.phase === 1 ? "cui-flap-down" : "cui-flap-land"} ${half}ms linear forwards`,
                  backfaceVisibility: "hidden",
                }}
              >
                <span className="block" style={{ transform: c.phase === 1 ? undefined : "translateY(-100%)" }}>
                  {c.phase === 1 ? c.shown : c.shown}
                </span>
              </span>
            )}
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--cui-flap-hinge,light-dark(rgba(20,19,17,0.35),rgba(236,235,230,0.35)))]" />
          </span>
        ))}
      </div>
      <style>{`@keyframes cui-flap-down{from{transform:rotateX(0deg)}to{transform:rotateX(-90deg)}}@keyframes cui-flap-land{from{transform:rotateX(90deg)}to{transform:rotateX(0deg)}}`}</style>
    </div>
  );
});
SplitFlapBoard.displayName = "SplitFlapBoard";
