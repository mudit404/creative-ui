"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useMagneticField } from "@/hooks/use-magnetic-field";

export type AdaptiveRailPlacement = "bottom" | "top" | "left" | "right";
export type AdaptiveRailBehavior = "collapse" | "hide" | "static";
export type AdaptiveRailMotion = "auto" | "reduced" | "off";

export interface AdaptiveRailProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  /** Accessible name of the toolbar. */
  label: string;
  placement?: AdaptiveRailPlacement;
  /** Alignment along the edge. */
  align?: "start" | "center" | "end";
  /** Distance from the edge, px. */
  offset?: number;
  /** `fixed` floats over the viewport; `absolute` floats inside a positioned ancestor (demos, panels). */
  position?: "fixed" | "absolute";
  /**
   * What happens while the user scrolls down: `collapse` keeps only priority
   * items, `hide` slides the rail off the edge, `static` ignores scrolling.
   */
  behavior?: AdaptiveRailBehavior;
  /** Scrollable element to observe instead of the window. */
  scrollContainer?: React.RefObject<HTMLElement | null>;
  /** Current context. Items with `contexts` are shown only when it matches. */
  context?: string;
  /** Render item labels next to icons while expanded. */
  showLabels?: boolean;
  /** Subtle magnetic pull on each item. */
  magnetic?: boolean;
  /** `auto` follows prefers-reduced-motion. */
  motion?: AdaptiveRailMotion;
  /** Force the expanded state (controlled), e.g. while a menu is open. */
  expanded?: boolean;
  children?: React.ReactNode;
}

export interface AdaptiveRailItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also the visible label when the rail shows labels. */
  label: string;
  /** Stays visible while the rail is collapsed. */
  priority?: boolean;
  /** Show only when the rail's `context` is one of these. */
  contexts?: string[];
  /** Marks the current/selected item (aria-pressed). */
  active?: boolean;
  /** Render a link instead of a button. */
  href?: string;
  /** Icon or content. */
  children?: React.ReactNode;
}

interface RailContextValue {
  collapsed: boolean;
  vertical: boolean;
  showLabels: boolean;
  context?: string;
  magnetic: boolean;
  mode: "full" | "reduced" | "off";
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  registerItem: (el: HTMLElement) => () => void;
}

const RailContext = React.createContext<RailContextValue | null>(null);

function useRail() {
  const ctx = React.useContext(RailContext);
  if (!ctx) throw new Error("AdaptiveRail.Item must be used inside AdaptiveRail");
  return ctx;
}

const PLACEMENT: Record<AdaptiveRailPlacement, (offset: number, align: "start" | "center" | "end") => React.CSSProperties> = {
  bottom: (o, a) => ({ bottom: o, ...alongX(a), flexDirection: "row" }),
  top: (o, a) => ({ top: o, ...alongX(a), flexDirection: "row" }),
  left: (o, a) => ({ left: o, ...alongY(a), flexDirection: "column" }),
  right: (o, a) => ({ right: o, ...alongY(a), flexDirection: "column" }),
};
function alongX(a: "start" | "center" | "end"): React.CSSProperties {
  if (a === "start") return { left: 16 };
  if (a === "end") return { right: 16 };
  return { left: "50%", x: "-50%" } as React.CSSProperties;
}
function alongY(a: "start" | "center" | "end"): React.CSSProperties {
  if (a === "start") return { top: 16 };
  if (a === "end") return { bottom: 16 };
  return { top: "50%", y: "-50%" } as React.CSSProperties;
}

/**
 * AdaptiveRail — a floating action rail that adapts to scroll and context.
 *
 * A `role="toolbar"` with roving arrow-key focus. While the user scrolls
 * down it collapses to its priority items (or hides); it expands on scroll
 * up, when scrolling stops, on hover and whenever it holds focus. Items can
 * be scoped to a context so the same rail serves browsing and selection.
 */
export const AdaptiveRail = React.forwardRef<HTMLDivElement, AdaptiveRailProps>(function AdaptiveRail(
  {
    label,
    placement = "bottom",
    align = "center",
    offset = 24,
    position = "fixed",
    behavior = "collapse",
    scrollContainer,
    context,
    showLabels = false,
    magnetic = true,
    motion = "auto",
    expanded: expandedProp,
    className,
    style,
    children,
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const vertical = placement === "left" || placement === "right";

  const scroll = useScrollDirection({ container: scrollContainer, enabled: behavior !== "static", idleMs: 320 });
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const scrollingDown = behavior !== "static" && scroll.direction === "down" && !scroll.atStart;
  const held = hovered || focused || expandedProp === true;
  const collapsed = behavior === "collapse" && scrollingDown && !held;
  const hidden = behavior === "hide" && scrollingDown && !held;

  /* roving tabindex */
  const [activeIndex, setActiveIndex] = React.useState(0);
  const items = React.useRef<HTMLElement[]>([]);
  const registerItem = React.useCallback((el: HTMLElement) => {
    items.current.push(el);
    return () => {
      items.current = items.current.filter((x) => x !== el);
    };
  }, []);
  const focusable = () =>
    items.current
      .filter((el) => el.isConnected && !el.hasAttribute("hidden") && !(el as HTMLButtonElement).disabled)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const next = vertical ? "ArrowDown" : "ArrowRight";
    const prev = vertical ? "ArrowUp" : "ArrowLeft";
    if (![next, prev, "Home", "End"].includes(e.key)) return;
    const list = focusable();
    if (!list.length) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    const target =
      e.key === next
        ? (current + 1) % list.length
        : e.key === prev
          ? (current - 1 + list.length) % list.length
          : e.key === "Home"
            ? 0
            : list.length - 1;
    e.preventDefault();
    list[target]?.focus();
  };

  const ctx = React.useMemo<RailContextValue>(
    () => ({ collapsed, vertical, showLabels, context, magnetic: magnetic && mode === "full", mode, activeIndex, setActiveIndex, registerItem }),
    [collapsed, vertical, showLabels, context, magnetic, mode, activeIndex, registerItem],
  );

  const place = PLACEMENT[placement](offset, align);
  const { x, y, ...placeStyle } = place as React.CSSProperties & { x?: string; y?: string };
  const hideOffset = placement === "bottom" ? { y: "140%" } : placement === "top" ? { y: "-140%" } : placement === "left" ? { x: "-140%" } : { x: "140%" };
  const restOffset = { x: x ?? 0, y: y ?? 0 };
  const transition = mode === "full" ? { type: "spring" as const, stiffness: 380, damping: 32 } : { duration: mode === "off" ? 0 : 0.15 };

  return (
    <RailContext.Provider value={ctx}>
      <LayoutGroup>
        <m.div
          ref={ref}
          role="toolbar"
          aria-label={label}
          aria-orientation={vertical ? "vertical" : "horizontal"}
          data-slot="adaptive-rail"
          data-state={hidden ? "hidden" : collapsed ? "collapsed" : "expanded"}
          data-motion={mode}
          layout={mode === "full" ? "size" : false}
          initial={false}
          animate={hidden ? { ...restOffset, ...hideOffset, opacity: 0 } : { ...restOffset, opacity: 1 }}
          transition={transition}
          className={cn(
            "z-40 flex items-center gap-1 rounded-full border p-1.5",
            "border-[var(--ar-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] bg-[var(--ar-surface,light-dark(rgba(250,249,246,0.82),rgba(31,31,28,0.88)))] text-[var(--ar-foreground,light-dark(#141311,#ecebe6))] shadow-[0_12px_32px_-12px_rgba(20,19,17,0.35)] backdrop-blur-md",
            position === "fixed" ? "fixed" : "absolute",
            className,
          )}
          style={{ ...placeStyle, ...style }}
          onPointerEnter={(e) => {
            onPointerEnter?.(e);
            if (e.pointerType !== "touch") setHovered(true);
          }}
          onPointerLeave={(e) => {
            onPointerLeave?.(e);
            setHovered(false);
          }}
          onFocus={(e) => {
            onFocus?.(e);
            setFocused(true);
          }}
          onBlur={(e) => {
            onBlur?.(e);
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
          }}
          onKeyDown={handleKeyDown}
          {...(rest as Omit<React.ComponentProps<typeof m.div>, "ref">)}
        >
          {children}
        </m.div>
      </LayoutGroup>
    </RailContext.Provider>
  );
});
AdaptiveRail.displayName = "AdaptiveRail";

/* ───────────────────────────── item ───────────────────────────── */

export const AdaptiveRailItem = React.forwardRef<HTMLButtonElement, AdaptiveRailItemProps>(function AdaptiveRailItem(
  { label, priority = false, contexts, active, href, className, children, onFocus, ...rest },
  ref,
) {
  const rail = useRail();
  const inContext = !contexts || (rail.context !== undefined && contexts.includes(rail.context));
  const visible = inContext && (!rail.collapsed || priority);
  const anchor = React.useRef<HTMLSpanElement>(null);
  const { x, y } = useMagneticField(anchor, { enabled: rail.magnetic && visible, radius: 44, strength: 0.3, maxOffset: 5, spring: { stiffness: 320, damping: 24 } });
  const transition = rail.mode === "full" ? { type: "spring" as const, stiffness: 420, damping: 30 } : { duration: rail.mode === "off" ? 0 : 0.12 };

  const control = React.createElement(
    href ? "a" : "button",
    {
      ref,
      href,
      type: href ? undefined : "button",
      "aria-label": label,
      "aria-pressed": !href && active !== undefined ? active : undefined,
      "aria-current": href && active ? "page" : undefined,
      "data-rail-item": true,
      "data-active": active || undefined,
      className: cn(
        "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium outline-none transition-colors",
        "hover:bg-[var(--ar-item-hover,light-dark(rgba(20,19,17,0.08),rgba(236,235,230,0.08)))] focus-visible:ring-2 focus-visible:ring-[var(--ar-ring,light-dark(#141311,#ecebe6))] focus-visible:ring-offset-1",
        "data-[active]:bg-[var(--ar-item-active,light-dark(#141311,#ecebe6))] data-[active]:text-[var(--ar-item-active-foreground,light-dark(#f3f1ec,#141311))]",
        "disabled:opacity-40",
        className,
      ),
      onFocus,
      ...rest,
    },
    <span aria-hidden className="inline-flex size-5 items-center justify-center [&>svg]:size-5">
      {children}
    </span>,
    rail.showLabels && !rail.collapsed ? <span className="pr-1 whitespace-nowrap">{label}</span> : null,
  );
  const content = <RegisteredItem register={rail.registerItem}>{control}</RegisteredItem>;

  // No presence animation when motion is off: unmount synchronously.
  if (rail.mode === "off") {
    return visible ? (
      <span ref={anchor} className="relative inline-flex">
        {content}
      </span>
    ) : null;
  }

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <m.span
          ref={anchor}
          layout={rail.mode === "full" ? "position" : false}
          initial={rail.mode === "full" ? { scale: 0.6, opacity: 0, width: 0 } : false}
          animate={{ scale: 1, opacity: 1, width: "auto" }}
          exit={rail.mode === "full" ? { scale: 0.6, opacity: 0, width: 0 } : { opacity: 0 }}
          transition={transition}
          className="relative inline-flex overflow-hidden"
        >
          <m.span className="inline-flex" style={{ x, y }}>
            {content}
          </m.span>
        </m.span>
      )}
    </AnimatePresence>
  );
});
AdaptiveRailItem.displayName = "AdaptiveRail.Item";

/** Registers the rendered control with the toolbar's roving focus list. */
function RegisteredItem({ register, children }: { register: (el: HTMLElement) => () => void; children: React.ReactElement }) {
  const holder = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = holder.current?.querySelector<HTMLElement>("[data-rail-item]");
    if (!el) return;
    return register(el);
  }, [register]);
  return (
    <span ref={holder} className="contents">
      {children}
    </span>
  );
}

export function AdaptiveRailSeparator({ className }: { className?: string }) {
  const rail = useRail();
  if (rail.collapsed) return null;
  return (
    <span
      role="separator"
      aria-orientation={rail.vertical ? "horizontal" : "vertical"}
      className={cn(rail.vertical ? "my-0.5 h-px w-5" : "mx-0.5 h-5 w-px", "shrink-0 bg-[var(--ar-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))]", className)}
    />
  );
}
