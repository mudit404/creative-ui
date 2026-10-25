"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { AnimatePresence, animate, motion as m, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useMagneticField } from "@/hooks/use-magnetic-field";

export type OrbitalMenuMotion = "auto" | "reduced" | "off";
export type OrbitalMenuSpring = "soft" | "snappy" | "stiff";

export interface OrbitalMenuProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Controlled open state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Distance from the trigger centre to item centres, px. */
  radius?: number;
  /** Angle of the first item in degrees; 0 is right, -90 is up, clockwise positive. */
  startAngle?: number;
  /** Degrees the items spread across. 360 is a full ring; 180 a half ring. */
  sweep?: number;
  /** Degrees the items swing through while flying out. */
  swing?: number;
  /** Seconds between each item's launch. */
  stagger?: number;
  spring?: OrbitalMenuSpring;
  /** Close after an item is selected. */
  closeOnSelect?: boolean;
  /** Subtle magnetic pull on items. */
  magnetic?: boolean;
  /** Render labels beside items. */
  showLabels?: boolean;
  /** `auto` follows prefers-reduced-motion. */
  motion?: OrbitalMenuMotion;
  children?: React.ReactNode;
}

export interface OrbitalMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Use the child element as the trigger. */
  asChild?: boolean;
}

export interface OrbitalMenuItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  /** Accessible name; visible when the menu shows labels. */
  label: string;
  onSelect?: () => void;
  href?: string;
  children?: React.ReactNode;
}

interface Ctx {
  open: boolean;
  setOpen: (o: boolean) => void;
  mode: "full" | "reduced" | "off";
  radius: number;
  startAngle: number;
  sweep: number;
  swing: number;
  stagger: number;
  spring: { stiffness: number; damping: number };
  closeOnSelect: boolean;
  magnetic: boolean;
  showLabels: boolean;
  menuId: string;
  /** Callback ref the trigger attaches so the root can return focus to it. */
  setTriggerEl: (el: HTMLButtonElement | null) => void;
  registerItem: (el: HTMLElement) => () => void;
}

const ItemIndexContext = React.createContext<{ index: number; total: number }>({ index: 0, total: 1 });

const SPRINGS: Record<OrbitalMenuSpring, { stiffness: number; damping: number }> = {
  soft: { stiffness: 170, damping: 16 },
  snappy: { stiffness: 300, damping: 20 },
  stiff: { stiffness: 480, damping: 30 },
};

const MenuContext = React.createContext<Ctx | null>(null);
function useMenu(name: string) {
  const ctx = React.useContext(MenuContext);
  if (!ctx) throw new Error(`${name} must be used inside OrbitalMenu`);
  return ctx;
}

/**
 * OrbitalMenu — actions that orbit a trigger and settle into reach.
 *
 * Semantics: the trigger is a button with `aria-haspopup="menu"` and
 * `aria-expanded`; the ring is `role="menu"` with `role="menuitem"` controls.
 * Arrow keys move around the ring, Home/End jump, Escape closes and returns
 * focus, Tab and outside clicks close. Items launch from the trigger on
 * staggered springs, swinging through `swing` degrees into position, then
 * each one leans toward the pointer. Reduced motion fades them in place.
 */
export const OrbitalMenu = React.forwardRef<HTMLDivElement, OrbitalMenuProps>(function OrbitalMenu(
  {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    radius = 96,
    startAngle = -90,
    sweep = 360,
    swing = 40,
    stagger = 0.045,
    spring = "snappy",
    closeOnSelect = true,
    magnetic = true,
    motion = "auto",
    showLabels = false,
    className,
    children,
    onKeyDown,
    ...rest
  },
  ref,
) {
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

  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const setTriggerEl = React.useCallback((el: HTMLButtonElement | null) => {
    triggerRef.current = el;
  }, []);
  const menuId = React.useId();

  /* registered items, in DOM order */
  const items = React.useRef<HTMLElement[]>([]);
  const registerItem = React.useCallback((el: HTMLElement) => {
    items.current.push(el);
    return () => {
      items.current = items.current.filter((x) => x !== el);
    };
  }, []);
  const ordered = () =>
    items.current
      .filter((el) => el.isConnected && !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true")
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  /* focus first item when opened via keyboard; return focus on close */
  const wasOpen = React.useRef(open);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      const t = setTimeout(() => ordered()[0]?.focus(), 30);
      wasOpen.current = true;
      return () => clearTimeout(t);
    }
    if (!open && wasOpen.current) {
      wasOpen.current = false;
      if (rootRef.current?.contains(document.activeElement) || document.activeElement === document.body) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
  }, [open]);

  /* outside click closes */
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, setOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "Tab" && open) {
      setOpen(false);
      return;
    }
    if (!open) return;
    const list = ordered();
    if (!list.length) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    let target: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") target = (current + 1) % list.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = (current - 1 + list.length) % list.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = list.length - 1;
    if (target === null) return;
    e.preventDefault();
    list[target]?.focus();
  };

  const ctx = React.useMemo<Ctx>(
    () => ({
      open,
      setOpen,
      mode,
      radius,
      startAngle,
      sweep,
      swing,
      stagger,
      spring: SPRINGS[spring],
      closeOnSelect,
      magnetic: magnetic && mode === "full",
      showLabels,
      menuId,
      setTriggerEl,
      registerItem,
    }),
    [open, setOpen, mode, radius, startAngle, sweep, swing, stagger, spring, closeOnSelect, magnetic, showLabels, menuId, setTriggerEl, registerItem],
  );

  return (
    <MenuContext.Provider value={ctx}>
      <div
        ref={rootRef}
        data-slot="orbital-menu"
        data-state={open ? "open" : "closed"}
        data-motion={mode}
        className={cn("relative inline-flex items-center justify-center", className)}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
});
OrbitalMenu.displayName = "OrbitalMenu";

/* ───────────────────────────── trigger ───────────────────────────── */

export const OrbitalMenuTrigger = React.forwardRef<HTMLButtonElement, OrbitalMenuTriggerProps>(function OrbitalMenuTrigger(
  { asChild = false, className, children, onClick, onKeyDown, ...rest },
  ref,
) {
  const menu = useMenu("OrbitalMenu.Trigger");
  const local = React.useRef<HTMLButtonElement | null>(null);
  React.useImperativeHandle(ref, () => local.current as HTMLButtonElement);
  const attach = React.useCallback(
    (el: HTMLButtonElement | null) => {
      local.current = el;
      menu.setTriggerEl(el);
    },
    [menu],
  );
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={attach}
      type={asChild ? undefined : "button"}
      aria-haspopup="menu"
      aria-expanded={menu.open}
      aria-controls={menu.open ? menu.menuId : undefined}
      data-slot="orbital-menu-trigger"
      data-state={menu.open ? "open" : "closed"}
      className={cn(
        !asChild &&
          "relative z-10 inline-flex size-14 items-center justify-center rounded-full bg-[var(--om-trigger,light-dark(#141311,#ecebe6))] text-[var(--om-trigger-foreground,light-dark(#f3f1ec,#141311))] shadow-[0_10px_24px_-10px_rgba(20,19,17,0.6)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[var(--om-ring,light-dark(#141311,#ecebe6))] focus-visible:ring-offset-2 active:scale-95",
        className,
      )}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) menu.setOpen(!menu.open);
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !menu.open) {
          e.preventDefault();
          menu.setOpen(true);
        }
      }}
      {...rest}
    >
      {children ?? (
        <m.svg
          aria-hidden
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          animate={{ rotate: menu.open ? 45 : 0 }}
          transition={menu.mode === "full" ? { type: "spring", stiffness: 400, damping: 24 } : { duration: menu.mode === "off" ? 0 : 0.15 }}
        >
          <path d="M12 5v14M5 12h14" />
        </m.svg>
      )}
    </Comp>
  );
});
OrbitalMenuTrigger.displayName = "OrbitalMenu.Trigger";

/* ───────────────────────────── ring ───────────────────────────── */

/** The ring: renders items while open. Place it after the trigger. */
export function OrbitalMenuRing({ children, className }: { children?: React.ReactNode; className?: string }) {
  const menu = useMenu("OrbitalMenu.Ring");
  const kids = React.Children.toArray(children).filter(React.isValidElement);
  const total = kids.length;
  return (
    <AnimatePresence>
      {menu.open && (
        <div
          id={menu.menuId}
          role="menu"
          aria-orientation="horizontal"
          data-slot="orbital-menu-ring"
          className={cn("absolute left-1/2 top-1/2 size-0 overflow-visible", className)}
        >
          {kids.map((child, index) => (
            <ItemIndexContext.Provider key={child.key ?? index} value={{ index, total }}>
              {child}
            </ItemIndexContext.Provider>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

/* ───────────────────────────── item ───────────────────────────── */

export const OrbitalMenuItem = React.forwardRef<HTMLButtonElement, OrbitalMenuItemProps>(function OrbitalMenuItem(
  { label, onSelect, href, disabled, className, children, onClick, ...rest },
  ref,
) {
  const menu = useMenu("OrbitalMenu.Item");
  const { index, total } = React.useContext(ItemIndexContext);
  const n = Math.max(1, total);
  const full = menu.sweep >= 360;
  const step = full ? menu.sweep / n : n > 1 ? menu.sweep / (n - 1) : 0;
  const angle = menu.startAngle + index * step;

  /* orbit progress 0 → 1 with spring overshoot; angle swings in, radius grows */
  const p = useMotionValue(0);
  const rad = (a: number) => (a * Math.PI) / 180;
  const x = useTransform(p, (v) => Math.cos(rad(angle - (1 - v) * menu.swing)) * v * menu.radius);
  const y = useTransform(p, (v) => Math.sin(rad(angle - (1 - v) * menu.swing)) * v * menu.radius);
  const scale = useTransform(p, (v) => 0.4 + 0.6 * Math.min(1.08, v));
  const opacity = useTransform(p, (v) => Math.max(0, Math.min(1, v * 2.2)));

  React.useEffect(() => {
    if (menu.mode === "off") {
      p.jump(1);
      return;
    }
    const controls =
      menu.mode === "full"
        ? animate(p, 1, { type: "spring", ...menu.spring, delay: index * menu.stagger })
        : animate(p, 1, { duration: 0.15, ease: "easeOut" });
    return () => controls.stop();
  }, [p, menu.mode, menu.spring, menu.stagger, index]);

  const anchor = React.useRef<HTMLSpanElement>(null);
  const magnet = useMagneticField(anchor, { enabled: menu.magnetic && !disabled, radius: 48, strength: 0.35, maxOffset: 6 });

  const holder = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = holder.current?.querySelector<HTMLElement>("[data-orbital-item]");
    if (!el) return;
    return menu.registerItem(el);
  }, [menu]);

  const select = () => {
    if (disabled) return;
    onSelect?.();
    if (menu.closeOnSelect) menu.setOpen(false);
  };

  const control = React.createElement(
    href ? "a" : "button",
    {
      ref,
      href: disabled ? undefined : href,
      type: href ? undefined : "button",
      role: "menuitem",
      tabIndex: -1,
      "aria-label": label,
      "aria-disabled": disabled || undefined,
      disabled: href ? undefined : disabled,
      "data-orbital-item": true,
      className: cn(
        "inline-flex size-11 items-center justify-center rounded-full bg-[var(--om-item,light-dark(#faf9f6,#1f1f1c))] text-[var(--om-item-foreground,light-dark(#141311,#ecebe6))] shadow-[0_8px_20px_-10px_rgba(20,19,17,0.5),0_0_0_1px_light-dark(rgba(20,19,17,0.08),rgba(236,235,230,0.08))] outline-none transition-colors",
        "hover:bg-[var(--om-item-hover,light-dark(#141311,#ecebe6))] hover:text-[var(--om-item-hover-foreground,light-dark(#f3f1ec,#141311))] focus-visible:ring-2 focus-visible:ring-[var(--om-ring,light-dark(#141311,#ecebe6))] focus-visible:ring-offset-2",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 [&>svg]:size-5",
        className,
      ),
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (disabled) {
          e.preventDefault();
          return;
        }
        select();
      },
      ...rest,
    },
    children,
  );

  const exit = menu.mode === "off" ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.5, transition: { duration: menu.mode === "full" ? 0.18 : 0.12 } };

  return (
    <m.span
      className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2"
      style={{ x, y, scale, opacity }}
      exit={exit}
    >
      <span ref={anchor} className="relative block">
        <m.span ref={holder} className="relative flex flex-col items-center gap-1" style={{ x: magnet.x, y: magnet.y }}>
          {control}
          {menu.showLabels && (
            <span aria-hidden className="pointer-events-none whitespace-nowrap rounded-full bg-[var(--om-label,light-dark(#141311,#ecebe6))] px-2 py-0.5 text-[11px] font-medium text-[var(--om-label-foreground,light-dark(#f3f1ec,#141311))]">
              {label}
            </span>
          )}
        </m.span>
      </span>
    </m.span>
  );
});
OrbitalMenuItem.displayName = "OrbitalMenu.Item";
