"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { AnimatePresence, motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useMagneticField } from "@/hooks/use-magnetic-field";

export type MosaicMenuMotion = "auto" | "reduced" | "off";

export interface MosaicTile {
  id: string;
  href: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Tile accent (background) colour. */
  accent?: string;
  /** Text colour on the tile. */
  foreground?: string;
  /** Column span. */
  span?: 1 | 2;
  /** Marks the current route (aria-current="page"). */
  current?: boolean;
  /** Optional visual rendered behind the text (image, icon). */
  media?: React.ReactNode;
}

export interface MosaicMenuProps {
  tiles: MosaicTile[];
  /** Accessible name of the dialog. */
  label: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Minimum tile width; the mosaic auto-fills columns. */
  minTileWidth?: number;
  /** Gap in px. */
  gap?: number;
  /** Seconds between tile launches, ordered by distance from the centre. */
  stagger?: number;
  /** Link component for client-side routing (e.g. Next's Link). Receives href, className, children and aria props. */
  linkComponent?: React.ElementType;
  /** Called when a tile is activated; return false to keep the menu open. */
  onNavigate?: (tile: MosaicTile) => void | boolean;
  /** Content under the mosaic (contact, social, legal). */
  footer?: React.ReactNode;
  /** Subtle magnetic shift on tiles. */
  magnetic?: boolean;
  /** `auto` follows prefers-reduced-motion. */
  motion?: MosaicMenuMotion;
  className?: string;
  style?: React.CSSProperties;
  /** The trigger (use `MosaicMenu.Trigger`) and anything else rendered in place. */
  children?: React.ReactNode;
}

export interface MosaicMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

interface Ctx {
  open: boolean;
  setOpen: (o: boolean) => void;
  setTriggerEl: (el: HTMLButtonElement | null) => void;
  dialogId: string;
}

const MenuContext = React.createContext<Ctx | null>(null);

const subscribeNoop = () => () => {};
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * MosaicMenu — a full-screen route menu built from shifting mosaic tiles.
 *
 * The trigger opens a modal dialog rendered in a portal: a `nav` of route
 * tiles that assemble with staggered choreography radiating from the centre,
 * and scatter out on close. Focus is trapped, Escape and the backdrop close,
 * focus returns to the trigger, body scroll is locked. Arrow keys move across
 * the mosaic in two dimensions; the current route is marked.
 */
export function MosaicMenu({
  tiles,
  label,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  minTileWidth = 220,
  gap = 10,
  stagger = 0.035,
  linkComponent,
  onNavigate,
  footer,
  magnetic = true,
  motion = "auto",
  className,
  style,
  children,
}: MosaicMenuProps) {
  const isControlled = openProp !== undefined;
  const [internal, setInternal] = React.useState(defaultOpen);
  const open = isControlled ? openProp : internal;
  const setOpen = React.useCallback(
    (o: boolean) => {
      if (!isControlled) setInternal(o);
      onOpenChange?.(o);
    },
    [isControlled, onOpenChange],
  );

  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const setTriggerEl = React.useCallback((el: HTMLButtonElement | null) => {
    triggerRef.current = el;
  }, []);
  const dialogId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLUListElement>(null);
  const mounted = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  /* scroll lock + initial focus + focus return */
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const t = setTimeout(() => {
        const current = dialogRef.current?.querySelector<HTMLElement>('[data-mosaic-tile][aria-current="page"]');
        const first = current ?? dialogRef.current?.querySelector<HTMLElement>("[data-mosaic-tile]") ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        first?.focus({ preventScroll: true });
      }, 20);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = prevOverflow;
      };
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  /* Escape closes even before focus has moved into the dialog */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  /** Tiles on the first row = column count; robust to spans and to environments without layout. */
  const columns = (items: HTMLElement[]) => {
    if (items.length < 2) return 1;
    const top = items[0]!.getBoundingClientRect().top;
    const n = items.filter((el) => Math.abs(el.getBoundingClientRect().top - top) < 2).length;
    return Math.max(1, n);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") return; // handled at the document level
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (e.key === "Tab") {
      const list = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("hidden"));
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      const items = Array.from(dialog.querySelectorAll<HTMLElement>("[data-mosaic-tile]"));
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (current === -1) return;
      e.preventDefault();
      const cols = columns(items);
      const next =
        e.key === "ArrowRight"
          ? Math.min(items.length - 1, current + 1)
          : e.key === "ArrowLeft"
            ? Math.max(0, current - 1)
            : e.key === "ArrowDown"
              ? Math.min(items.length - 1, current + cols)
              : e.key === "ArrowUp"
                ? Math.max(0, current - cols)
                : e.key === "Home"
                  ? 0
                  : items.length - 1;
      items[next]?.focus();
    }
  };

  const ctx = React.useMemo<Ctx>(() => ({ open, setOpen, setTriggerEl, dialogId }), [open, setOpen, setTriggerEl, dialogId]);

  /* choreography: order by distance from the centre of the list */
  const n = tiles.length;
  const centre = (n - 1) / 2;
  const delayFor = (i: number) => Math.abs(i - centre) * stagger;
  const vectorFor = (i: number): { x: number; y: number } => {
    // deterministic scatter direction from the index
    const a = (i * 137.5 * Math.PI) / 180;
    return { x: Math.cos(a) * 60, y: Math.sin(a) * 60 };
  };

  const overlay = (
    <AnimatePresence>
      {open && (
        <m.div
          key="mosaic-overlay"
          data-slot="mosaic-menu-overlay"
          data-motion={mode}
          initial={mode === "off" ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: mode === "off" ? 0 : 0.2, delay: mode === "full" ? 0.12 : 0 } }}
          transition={{ duration: mode === "off" ? 0 : 0.25 }}
          className={cn("fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[var(--mm-backdrop,rgba(20,19,17,0.92))] text-[var(--mm-foreground,#f3f1ec)] backdrop-blur-sm", className)}
          style={style}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            data-slot="mosaic-menu"
            onKeyDown={onKeyDown}
            className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-5 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">{label}</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-current/30 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-current"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <nav aria-label={label} className="flex-1">
              <ul
                ref={gridRef}
                data-slot="mosaic-grid"
                className="m-0 grid list-none p-0"
                style={{ gap, gridTemplateColumns: `repeat(auto-fill, minmax(min(${minTileWidth}px, 100%), 1fr))`, gridAutoFlow: "dense" }}
              >
                {tiles.map((tile, i) => (
                  <Tile
                    key={tile.id}
                    tile={tile}
                    index={i}
                    mode={mode}
                    delay={delayFor(i)}
                    vector={vectorFor(i)}
                    magnetic={magnetic && mode === "full"}
                    linkComponent={linkComponent}
                    onActivate={() => {
                      const keep = onNavigate?.(tile);
                      if (keep !== false) setOpen(false);
                    }}
                  />
                ))}
              </ul>
            </nav>
            {footer && (
              <m.div
                initial={mode === "full" ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: mode === "full" ? 0.25 : 0, duration: 0.25 }}
                className="text-[13px] opacity-70"
              >
                {footer}
              </m.div>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );

  return (
    <MenuContext.Provider value={ctx}>
      {children}
      {mounted ? createPortal(overlay, document.body) : null}
    </MenuContext.Provider>
  );
}
MosaicMenu.displayName = "MosaicMenu";

/* ───────────────────────────── trigger ───────────────────────────── */

export const MosaicMenuTrigger = React.forwardRef<HTMLButtonElement, MosaicMenuTriggerProps>(function MosaicMenuTrigger(
  { asChild = false, className, children, onClick, ...rest },
  ref,
) {
  const ctx = React.useContext(MenuContext);
  if (!ctx) throw new Error("MosaicMenu.Trigger must be used inside MosaicMenu");
  const local = React.useRef<HTMLButtonElement | null>(null);
  React.useImperativeHandle(ref, () => local.current as HTMLButtonElement);
  const attach = React.useCallback(
    (el: HTMLButtonElement | null) => {
      local.current = el;
      ctx.setTriggerEl(el);
    },
    [ctx],
  );
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={attach}
      type={asChild ? undefined : "button"}
      aria-haspopup="dialog"
      aria-expanded={ctx.open}
      aria-controls={ctx.open ? ctx.dialogId : undefined}
      data-slot="mosaic-menu-trigger"
      data-state={ctx.open ? "open" : "closed"}
      className={cn(
        !asChild &&
          "inline-flex h-11 items-center gap-2 rounded-full border border-[var(--mm-trigger-border,light-dark(rgba(20,19,17,0.25),rgba(236,235,230,0.25)))] bg-[var(--mm-trigger,transparent)] px-4 text-[14px] font-medium text-[var(--mm-trigger-foreground,light-dark(#141311,#ecebe6))] outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06))] focus-visible:ring-2 focus-visible:ring-[var(--mm-ring,light-dark(#141311,#ecebe6))] focus-visible:ring-offset-2",
        className,
      )}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx.setOpen(!ctx.open);
      }}
      {...rest}
    >
      {children ?? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" />
          </svg>
          Menu
        </>
      )}
    </Comp>
  );
});
MosaicMenuTrigger.displayName = "MosaicMenu.Trigger";

/* ───────────────────────────── tile ───────────────────────────── */

function Tile({
  tile,
  index,
  mode,
  delay,
  vector,
  magnetic,
  linkComponent,
  onActivate,
}: {
  tile: MosaicTile;
  index: number;
  mode: "full" | "reduced" | "off";
  delay: number;
  vector: { x: number; y: number };
  magnetic: boolean;
  linkComponent?: React.ElementType;
  onActivate: () => void;
}) {
  const anchor = React.useRef<HTMLLIElement>(null);
  const { x, y } = useMagneticField(anchor, { enabled: magnetic, radius: 40, strength: 0.25, maxOffset: 4, spring: { stiffness: 300, damping: 24 } });
  const Link = linkComponent ?? "a";
  const t =
    mode === "full"
      ? { type: "spring" as const, stiffness: 260, damping: 26, delay }
      : { duration: mode === "off" ? 0 : 0.15 };
  return (
    <m.li
      ref={anchor}
      data-slot="mosaic-tile-cell"
      data-index={index}
      initial={mode === "full" ? { opacity: 0, scale: 0.86, x: vector.x, y: vector.y } : mode === "reduced" ? { opacity: 0 } : false}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={mode === "full" ? { opacity: 0, scale: 0.9, x: vector.x * 0.5, y: vector.y * 0.5, transition: { duration: 0.16, delay: delay * 0.4 } } : { opacity: 0, transition: { duration: mode === "off" ? 0 : 0.1 } }}
      transition={t}
      className="min-w-0"
      style={{ gridColumn: tile.span === 2 ? "span 2" : undefined }}
    >
      <m.div style={{ x, y }} className="h-full">
        <Link
          href={tile.href}
          data-mosaic-tile
          aria-current={tile.current ? "page" : undefined}
          onClick={onActivate}
          className={cn(
            "group relative flex h-full min-h-[120px] flex-col justify-end overflow-hidden rounded-[var(--mm-radius,16px)] p-4 no-underline outline-none transition-[transform,box-shadow] duration-200",
            "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.7)] focus-visible:ring-2 focus-visible:ring-[var(--mm-foreground,#f3f1ec)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(20,19,17,0.9)]",
            "aria-[current=page]:ring-2 aria-[current=page]:ring-[var(--mm-foreground,#f3f1ec)]/60",
          )}
          style={{ background: tile.accent ?? "var(--mm-tile, rgba(255,255,255,0.08))", color: tile.foreground ?? "inherit" }}
        >
          {tile.media && <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80 [&>img]:h-full [&>img]:w-full [&>img]:object-cover">{tile.media}</div>}
          <span className="relative text-[clamp(1.1rem,2.2vw,1.6rem)] font-semibold leading-tight tracking-[-0.01em]">{tile.title}</span>
          {tile.description && <span className="relative mt-1 text-[13px] opacity-75">{tile.description}</span>}
        </Link>
      </m.div>
    </m.li>
  );
}
