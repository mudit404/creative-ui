"use client";

import * as React from "react";
import { AnimatePresence, motion as m, type PanInfo } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type FlowStackGalleryMotion = "auto" | "reduced" | "off";
export type FlowStackGallerySpring = "soft" | "snappy" | "stiff";

export interface FlowStackItem {
  id: string;
  src: string;
  alt: string;
  /** Smaller image for the strip; defaults to `src`. */
  thumb?: string;
  caption?: React.ReactNode;
}

export interface FlowStackGalleryProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  items: FlowStackItem[];
  /** Accessible name of the gallery. */
  label: string;
  /** Controlled active index. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** How many following images peek out behind the active one. */
  stackDepth?: number;
  /** Aspect ratio of the viewer. */
  aspect?: string;
  /** Thumbnail size in px. */
  thumbSize?: number;
  /** Wrap from the last image to the first. */
  loop?: boolean;
  /** Allow horizontal drag on the viewer to move through the deck. */
  drag?: boolean;
  showCaptions?: boolean;
  spring?: FlowStackGallerySpring;
  /** `auto` follows prefers-reduced-motion. */
  motion?: FlowStackGalleryMotion;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SPRINGS: Record<FlowStackGallerySpring, { stiffness: number; damping: number }> = {
  soft: { stiffness: 150, damping: 22 },
  snappy: { stiffness: 260, damping: 28 },
  stiff: { stiffness: 420, damping: 36 },
};

/**
 * FlowStackGallery — a gallery where thumbnails flow into a stacked viewer.
 *
 * The strip is a `tablist` of thumbnails (arrow keys, Home/End); the viewer is
 * the `tabpanel`, showing the active image on top of a shallow deck of the
 * next ones. Choosing a thumbnail flies a copy of it from the strip into the
 * top of the deck; next/previous, arrow keys on the viewer and a horizontal
 * drag shuffle the deck instead. Reduced motion crossfades.
 */
export const FlowStackGallery = React.forwardRef<HTMLDivElement, FlowStackGalleryProps>(function FlowStackGallery(
  {
    items,
    label,
    index: indexProp,
    defaultIndex = 0,
    onIndexChange,
    stackDepth = 3,
    aspect = "4 / 3",
    thumbSize = 64,
    loop = true,
    drag = true,
    showCaptions = true,
    spring = "snappy",
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const count = items.length;
  const isControlled = indexProp !== undefined;
  const [internal, setInternal] = React.useState(() => clampIndex(defaultIndex, count));
  const index = clampIndex(isControlled ? indexProp : internal, count);

  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const springCfg = SPRINGS[spring];

  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);
  const viewerRef = React.useRef<HTMLDivElement>(null);
  const thumbRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const uid = React.useId();
  const viewerId = `${uid}-viewer`;
  const tabId = (i: number) => `${uid}-tab-${i}`;

  /* the flying copy: a thumbnail on its way into the viewer */
  const [flight, setFlight] = React.useState<{ item: FlowStackItem; from: Rect; to: Rect } | null>(null);
  const [direction, setDirection] = React.useState<1 | -1>(1);

  const setIndex = React.useCallback(
    (next: number) => {
      if (!isControlled) setInternal(next);
      onIndexChange?.(next);
    },
    [isControlled, onIndexChange],
  );

  const go = React.useCallback(
    (next: number, opts: { flow?: boolean } = {}) => {
      if (count === 0) return;
      const target = loop ? ((next % count) + count) % count : clampIndex(next, count);
      if (target === index) return;
      setDirection(target > index ? 1 : -1);
      const item = items[target];
      if (opts.flow && mode === "full" && item && rootRef.current && viewerRef.current) {
        const root = rootRef.current.getBoundingClientRect();
        const thumb = thumbRefs.current[target]?.getBoundingClientRect();
        const viewer = viewerRef.current.getBoundingClientRect();
        if (thumb && thumb.width > 0 && viewer.width > 0) {
          setFlight({
            item,
            from: { left: thumb.left - root.left, top: thumb.top - root.top, width: thumb.width, height: thumb.height },
            to: { left: viewer.left - root.left, top: viewer.top - root.top, width: viewer.width, height: viewer.height },
          });
        }
      }
      setIndex(target);
    },
    [count, loop, index, items, mode, setIndex],
  );

  /* keep the active thumbnail in view when the index changes (never on mount, which would scroll the page;
     comparing against the last handled index also survives StrictMode's double effects) */
  const lastScrolled = React.useRef(index);
  React.useEffect(() => {
    if (lastScrolled.current === index) return;
    lastScrolled.current = index;
    thumbRefs.current[index]?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: mode === "full" ? "smooth" : "auto" });
  }, [index, mode]);

  const onStripKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, number | "home" | "end"> = { ArrowRight: 1, ArrowLeft: -1, Home: "home", End: "end" };
    const op = map[e.key];
    if (op === undefined) return;
    e.preventDefault();
    const target = op === "home" ? 0 : op === "end" ? count - 1 : index + op;
    go(target, { flow: true });
    requestAnimationFrame(() => thumbRefs.current[clampIndex(loop ? ((target % count) + count) % count : target, count)]?.focus());
  };

  const onViewerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    }
  };

  const onDragEnd = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -60 || velocity.x < -500) go(index + 1);
    else if (offset.x > 60 || velocity.x > 500) go(index - 1);
  };

  const canPrev = loop || index > 0;
  const canNext = loop || index < count - 1;
  const active = items[index];
  const transition = mode === "full" ? { type: "spring" as const, ...springCfg } : { duration: mode === "off" ? 0 : 0.18 };

  /* deck: active + following items */
  const deck: { item: FlowStackItem; offset: number }[] = [];
  for (let d = 0; d <= Math.min(stackDepth, count - 1); d++) {
    const i = loop ? (index + d) % count : index + d;
    const item = items[i];
    if (!item || (d > 0 && i === index)) break;
    deck.push({ item, offset: d });
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      data-slot="flow-stack-gallery"
      data-index={index}
      data-motion={mode}
      className={cn("relative flex w-full flex-col gap-3 text-[var(--fsg-foreground,#141311)]", className)}
      {...rest}
    >
      {/* viewer */}
      <div
        ref={viewerRef}
        id={viewerId}
        role="tabpanel"
        aria-labelledby={tabId(index)}
        tabIndex={0}
        data-slot="flow-stack-viewer"
        onKeyDown={onViewerKeyDown}
        className="relative w-full overflow-visible rounded-[var(--fsg-radius,18px)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--fsg-ring,#141311)] focus-visible:ring-offset-2"
        style={{ aspectRatio: aspect }}
      >
        <AnimatePresence initial={false} custom={direction}>
          {deck
            .slice()
            .reverse()
            .map(({ item, offset }) => {
              const top = offset === 0;
              const landing = top && flight?.item.id === item.id;
              return (
                <m.div
                  key={item.id}
                  custom={direction}
                  data-slot="flow-stack-card"
                  data-offset={offset}
                  initial={mode === "off" ? false : { opacity: 0, scale: 0.9, x: 0, y: offset * -10 }}
                  animate={{
                    opacity: landing ? 0 : 1 - offset * 0.18,
                    scale: 1 - offset * 0.05,
                    x: 0,
                    y: offset * -12,
                    zIndex: 10 - offset,
                  }}
                  variants={{
                    exit: (dir: number) =>
                      mode === "off"
                        ? { opacity: 0, transition: { duration: 0 } }
                        : { opacity: 0, x: dir > 0 ? -80 : 80, rotate: dir > 0 ? -4 : 4, scale: 0.96, transition: { duration: 0.22 } },
                  }}
                  exit="exit"
                  transition={transition}
                  drag={top && drag && mode !== "off" ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.25}
                  onDragEnd={top ? onDragEnd : undefined}
                  className={cn(
                    "absolute inset-0 overflow-hidden rounded-[var(--fsg-radius,18px)] bg-[var(--fsg-card,rgba(20,19,17,0.06))] shadow-[0_18px_40px_-20px_rgba(20,19,17,0.45),0_0_0_1px_rgba(20,19,17,0.06)]",
                    top && drag && mode !== "off" && "cursor-grab active:cursor-grabbing",
                  )}
                  style={{ transformOrigin: "50% 100%" }}
                >
                  <img
                    src={item.src}
                    alt={top ? item.alt : ""}
                    aria-hidden={!top || undefined}
                    draggable={false}
                    loading={offset <= 1 ? "eager" : "lazy"}
                    decoding="async"
                    className="pointer-events-none h-full w-full select-none object-cover"
                  />
                </m.div>
              );
            })}
        </AnimatePresence>

        {/* previous / next */}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              disabled={!canPrev}
              onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 inline-flex size-9 items-center justify-center rounded-full bg-[var(--fsg-control,rgba(250,249,246,0.85))] text-[var(--fsg-foreground,#141311)] shadow backdrop-blur-sm outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--fsg-ring,#141311)] disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next image"
              disabled={!canNext}
              onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 inline-flex size-9 items-center justify-center rounded-full bg-[var(--fsg-control,rgba(250,249,246,0.85))] text-[var(--fsg-foreground,#141311)] shadow backdrop-blur-sm outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--fsg-ring,#141311)] disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </>
        )}
        <span className="sr-only" aria-live="polite">
          {count ? `Image ${index + 1} of ${count}` : ""}
        </span>
      </div>

      {/* the flying thumbnail */}
      <AnimatePresence>
        {flight && (
          <m.img
            key={`flight-${flight.item.id}`}
            src={flight.item.src}
            alt=""
            aria-hidden
            data-slot="flow-stack-flight"
            initial={{ ...flight.from, opacity: 1, borderRadius: 10 }}
            animate={{ ...flight.to, opacity: 1, borderRadius: 18 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: "spring", ...springCfg, mass: 0.9 }}
            onAnimationComplete={() => setFlight(null)}
            className="pointer-events-none absolute z-30 object-cover shadow-[0_18px_40px_-20px_rgba(20,19,17,0.45)]"
          />
        )}
      </AnimatePresence>

      {showCaptions && active?.caption !== undefined && (
        <div className="text-[13px] text-[rgba(20,19,17,0.65)]" aria-live="polite">
          {active.caption}
        </div>
      )}

      {/* strip */}
      <div
        role="tablist"
        aria-label={`${label} thumbnails`}
        aria-orientation="horizontal"
        data-slot="flow-stack-strip"
        onKeyDown={onStripKeyDown}
        className="scroll-thin flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        {items.map((item, i) => {
          const selected = i === index;
          return (
            <button
              key={item.id}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              id={tabId(i)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={viewerId}
              aria-label={item.alt}
              tabIndex={selected ? 0 : -1}
              onClick={() => go(i, { flow: true })}
              data-selected={selected || undefined}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-[10px] outline-none ring-offset-2 transition-[opacity,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--fsg-ring,#141311)]",
                selected ? "ring-2 ring-[var(--fsg-ring,#141311)]" : "opacity-70 hover:opacity-100",
                flight?.item.id === item.id && "opacity-30",
              )}
              style={{ width: thumbSize, height: Math.round(thumbSize * 0.75) }}
            >
              <img src={item.thumb ?? item.src} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
});
FlowStackGallery.displayName = "FlowStackGallery";

function clampIndex(i: number, count: number) {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(i)));
}
