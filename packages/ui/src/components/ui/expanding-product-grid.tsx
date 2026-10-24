"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type ExpandingProductGridMotion = "auto" | "reduced" | "off";
export type ExpandingProductGridSpring = "soft" | "snappy" | "stiff";

export interface ExpandingProductGridProps
  extends Omit<React.HTMLAttributes<HTMLUListElement>, "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  /** Controlled id of the expanded card (null for none). */
  expandedId?: string | null;
  defaultExpandedId?: string | null;
  onExpandedChange?: (id: string | null) => void;
  /** Minimum card width; the grid auto-fills columns from it. */
  minCardWidth?: number;
  /** Gap in px. */
  gap?: number;
  /** Where the detail goes in an expanded card: beside the media, or below it. */
  detailLayout?: "side" | "stack";
  spring?: ExpandingProductGridSpring;
  /** Scroll the expanded card into view. */
  scrollIntoView?: boolean;
  /** `auto` follows prefers-reduced-motion. */
  motion?: ExpandingProductGridMotion;
  children?: React.ReactNode;
}

export interface ExpandingProductCardProps
  extends Omit<React.LiHTMLAttributes<HTMLLIElement>, "title" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  id: string;
  /** Card title; also the accessible name of the expand button. */
  title: React.ReactNode;
  /** Image or visual. Shown in both states and morphs between them. */
  media?: React.ReactNode;
  /** Collapsed-state content under the title (price, meta). */
  summary?: React.ReactNode;
  /** Expanded-state content (description, options, actions). */
  detail?: React.ReactNode;
  /** Aspect ratio of the media in the collapsed state. */
  mediaAspect?: string;
  disabled?: boolean;
}

interface Ctx {
  expandedId: string | null;
  setExpanded: (id: string | null, source?: "trigger" | "close" | "escape") => void;
  mode: "full" | "reduced" | "off";
  spring: { stiffness: number; damping: number };
  detailLayout: "side" | "stack";
  scrollIntoView: boolean;
}

const SPRINGS: Record<ExpandingProductGridSpring, { stiffness: number; damping: number }> = {
  soft: { stiffness: 160, damping: 22 },
  snappy: { stiffness: 280, damping: 28 },
  stiff: { stiffness: 440, damping: 36 },
};

const GridContext = React.createContext<Ctx | null>(null);

/**
 * ExpandingProductGrid — product cards that expand in place into a detail view.
 *
 * A `<ul>` of `<li><article>` cards. Activating a card's header button expands
 * it to span the full row; its media morphs to the new size and a detail
 * region appears beside (or below) it while the other cards reflow around it
 * with layout animation. One card is open at a time. Escape or the close
 * button collapses it and focus returns to the header.
 */
export const ExpandingProductGrid = React.forwardRef<HTMLUListElement, ExpandingProductGridProps>(function ExpandingProductGrid(
  {
    expandedId: expandedProp,
    defaultExpandedId = null,
    onExpandedChange,
    minCardWidth = 200,
    gap = 16,
    detailLayout = "side",
    spring = "snappy",
    scrollIntoView = true,
    motion = "auto",
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const isControlled = expandedProp !== undefined;
  const [internal, setInternal] = React.useState<string | null>(defaultExpandedId);
  const expandedId = isControlled ? expandedProp : internal;
  const setExpanded = React.useCallback(
    (id: string | null) => {
      if (!isControlled) setInternal(id);
      onExpandedChange?.(id);
    },
    [isControlled, onExpandedChange],
  );

  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  const ctx = React.useMemo<Ctx>(
    () => ({ expandedId, setExpanded, mode, spring: SPRINGS[spring], detailLayout, scrollIntoView }),
    [expandedId, setExpanded, mode, spring, detailLayout, scrollIntoView],
  );

  return (
    <GridContext.Provider value={ctx}>
      <LayoutGroup>
        <ul
          ref={ref}
          data-slot="expanding-product-grid"
          data-expanded={expandedId ?? undefined}
          data-motion={mode}
          className={cn("grid list-none m-0 p-0", className)}
          style={{ gap, gridTemplateColumns: `repeat(auto-fill, minmax(min(${minCardWidth}px, 100%), 1fr))`, ...style }}
          {...rest}
        >
          {children}
        </ul>
      </LayoutGroup>
    </GridContext.Provider>
  );
});
ExpandingProductGrid.displayName = "ExpandingProductGrid";

/* ───────────────────────────── card ───────────────────────────── */

export const ExpandingProductCard = React.forwardRef<HTMLLIElement, ExpandingProductCardProps>(function ExpandingProductCard(
  { id, title, media, summary, detail, mediaAspect = "4 / 5", disabled, className, children, onKeyDown, ...rest },
  ref,
) {
  const grid = React.useContext(GridContext);
  if (!grid) throw new Error("ExpandingProductGrid.Card must be used inside ExpandingProductGrid");
  const expanded = grid.expandedId === id;
  const headerId = React.useId();
  const regionId = React.useId();
  const liRef = React.useRef<HTMLLIElement>(null);
  React.useImperativeHandle(ref, () => liRef.current as HTMLLIElement);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const wasExpanded = React.useRef(expanded);

  /* focus management + scroll */
  React.useEffect(() => {
    if (expanded && !wasExpanded.current) {
      wasExpanded.current = true;
      const t = setTimeout(() => {
        closeRef.current?.focus({ preventScroll: true });
        if (grid.scrollIntoView) liRef.current?.scrollIntoView?.({ block: "nearest", behavior: grid.mode === "full" ? "smooth" : "auto" });
      }, 20);
      return () => clearTimeout(t);
    }
    if (!expanded && wasExpanded.current) {
      wasExpanded.current = false;
      if (liRef.current?.contains(document.activeElement) || document.activeElement === document.body) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
  }, [expanded, grid.mode, grid.scrollIntoView]);

  const toggle = () => {
    if (disabled) return;
    grid.setExpanded(expanded ? null : id);
  };

  const spring = { type: "spring" as const, ...grid.spring };
  const layoutOn = grid.mode !== "off";
  const t = grid.mode === "full" ? spring : { duration: grid.mode === "off" ? 0 : 0.15 };
  const side = grid.detailLayout === "side";

  return (
    <m.li
      ref={liRef}
      layout={layoutOn}
      transition={t}
      data-slot="expanding-product-card"
      data-state={expanded ? "expanded" : "collapsed"}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[var(--epg-radius,16px)] bg-[var(--epg-card,#faf9f6)] text-[var(--epg-foreground,#141311)] shadow-[0_1px_2px_rgba(20,19,17,0.06),0_12px_32px_-16px_rgba(20,19,17,0.25)]",
        expanded && "z-10 ring-1 ring-[var(--epg-ring,rgba(20,19,17,0.12))]",
        className,
      )}
      style={expanded ? { gridColumn: "1 / -1" } : undefined}
      onKeyDown={(e: React.KeyboardEvent<HTMLLIElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Escape" && expanded) {
          e.preventDefault();
          grid.setExpanded(null);
        }
      }}
      {...(rest as Omit<React.ComponentProps<typeof m.li>, "ref">)}
    >
      <article className={cn("flex h-full", expanded && side ? "flex-col md:flex-row" : "flex-col")} aria-labelledby={headerId}>
        {media !== undefined && (
          <m.div
            layout={layoutOn}
            transition={t}
            className={cn("relative shrink-0 overflow-hidden bg-[var(--epg-media,rgba(20,19,17,0.06))]", expanded && side ? "md:w-[45%]" : "w-full")}
            style={{ aspectRatio: expanded && side ? undefined : mediaAspect, minHeight: expanded && side ? 260 : undefined }}
          >
            <div className="absolute inset-0 [&>img]:h-full [&>img]:w-full [&>img]:object-cover">{media}</div>
          </m.div>
        )}
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <h3 id={headerId} className="m-0 text-[15px] font-semibold leading-snug">
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={expanded}
              aria-controls={expanded ? regionId : undefined}
              disabled={disabled}
              onClick={toggle}
              className="w-full text-left outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 disabled:opacity-50"
            >
              {title}
            </button>
          </h3>
          {!expanded && summary !== undefined && <div className="mt-1 text-[13px] text-[rgba(20,19,17,0.65)]">{summary}</div>}
          <AnimatePresence initial={false}>
            {expanded && (
              <m.section
                key="detail"
                id={regionId}
                role="region"
                aria-labelledby={headerId}
                initial={grid.mode === "full" ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={grid.mode === "off" ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.12 } }}
                transition={grid.mode === "full" ? { delay: 0.12, duration: 0.25 } : { duration: 0 }}
                className="mt-3 flex min-h-0 flex-1 flex-col gap-3 text-[14px] leading-relaxed"
              >
                <div className="min-w-0 flex-1">{detail}</div>
                <div className="flex justify-end">
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => grid.setExpanded(null)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--epg-ring,rgba(20,19,17,0.2))] px-3 text-[13px] font-medium outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--epg-foreground,#141311)] focus-visible:ring-offset-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                    Close
                  </button>
                </div>
              </m.section>
            )}
          </AnimatePresence>
          {children}
        </div>
      </article>
    </m.li>
  );
});
ExpandingProductCard.displayName = "ExpandingProductGrid.Card";
