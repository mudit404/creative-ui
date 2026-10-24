"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getPointer, subscribePointer } from "@/lib/pointer-field";
import { StrandField, type StrandFieldConfig } from "@/lib/strand-field";
import { renderStrandField, type StrandRenderOptions } from "@/lib/strand-renderer";

export interface UseStrandFieldOptions {
  /** Element whose box is the goo body. */
  bodyRef: RefObject<HTMLElement | null>;
  /** Overlay canvas, positioned at (-bleed, -bleed) relative to the body. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Element whose computed CSS variables give the render colours. */
  themeRef?: RefObject<HTMLElement | null>;
  config: Partial<StrandFieldConfig>;
  /** Corner radius of the body, or "pill" for fully rounded ends. */
  radius: number | "pill";
  /** Margin around the body covered by the canvas. */
  bleed: number;
  enabled: boolean;
  /** Render colours. Any value of the form `var(--name)` is resolved from `themeRef`. */
  render: StrandRenderOptions;
  /** Called every frame with the slab displacement toward the pointer. */
  onBow?: (x: number, y: number) => void;
  /** Called every frame with the field (read-only). */
  onFrame?: (field: StrandField) => void;
  /** Called when the loop stops (nothing left to animate). */
  onSettle?: () => void;
}

export interface StrandFieldHandle {
  /** Spawn idle-style strands around the outline (press feedback, attention). */
  burst: (count?: number, opts?: { spread?: "cluster" | "ring"; peak?: number }) => void;
  /** Make every reaching strand let go. */
  release: () => void;
  field: () => StrandField | null;
}

const MAX_DPR = 2;
const VAR_RE = /^var\((--[\w-]+)\)$/;

/**
 * Everything stateful lives in this plain controller so the React hook stays a
 * thin lifecycle wrapper. `opts()` always returns the latest options.
 */
function createController(latest: RefObject<UseStrandFieldOptions>) {
  const opts = () => latest.current;
  // Config and colours are applied by the hook's effects; nothing is read here.
  const field = new StrandField();
  let raf = 0;
  let probe = 0;
  let probing = false;
  let last = 0;
  let running = false;
  let visible = true;
  let idle: ReturnType<typeof setTimeout> | 0 = 0;
  let colors: StrandRenderOptions = { goo: "#000", highlight: "#fff", shadow: "#000", baseRadius: 1.5 };
  let disposed = false;

  const canvas = () => opts().canvasRef.current;

  function resolveColors() {
    const r = opts().render;
    const theme = opts().themeRef?.current;
    const resolve = (v: string) => {
      const m = VAR_RE.exec(v);
      if (!m || !theme) return v;
      const val = getComputedStyle(theme).getPropertyValue(m[1]).trim();
      return val || v;
    };
    colors = { ...r, goo: resolve(r.goo), highlight: resolve(r.highlight), shadow: resolve(r.shadow) };
  }

  function draw() {
    const c = canvas();
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    renderStrandField(ctx, field, colors);
  }

  function clear() {
    const c = canvas();
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function cancelIdle() {
    if (idle) clearTimeout(idle);
    idle = 0;
  }

  function scheduleIdle() {
    cancelIdle();
    if (disposed || !opts().enabled || !field.config.idle || !visible) return;
    const [min, max] = field.config.idleInterval;
    const wait = (min + Math.random() * (max - min)) * 1000;
    idle = setTimeout(() => {
      idle = 0;
      if (disposed || !opts().enabled || !visible || document.visibilityState === "hidden") {
        scheduleIdle();
        return;
      }
      // never burst while the pointer is engaging the control
      if (field.pointer && field.distance < field.config.awareness) {
        scheduleIdle();
        return;
      }
      field.burst(2 + Math.round(Math.random()));
      start();
    }, wait);
  }

  function frame(now: number) {
    const c = canvas();
    if (disposed || !c || !opts().enabled) {
      running = false;
      raf = 0;
      return;
    }
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;

    const ps = getPointer();
    if (ps.present) {
      const rect = c.getBoundingClientRect();
      field.setPointer({ x: ps.x - rect.left, y: ps.y - rect.top });
    } else {
      field.setPointer(null);
    }
    field.update(dt);
    draw();
    const o = opts();
    o.onBow?.(field.bow.x, field.bow.y);
    o.onFrame?.(field);

    if (field.isActive() && visible) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
      raf = 0;
      last = 0;
      clear();
      o.onBow?.(0, 0);
      o.onSettle?.();
      scheduleIdle();
    }
  }

  function start() {
    if (running || disposed || !opts().enabled) return;
    cancelIdle();
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    if (probe) cancelAnimationFrame(probe);
    raf = 0;
    probe = 0;
    probing = false;
    running = false;
    last = 0;
    cancelIdle();
    clear();
  }

  function measure() {
    const o = opts();
    const body = o.bodyRef.current;
    const c = canvas();
    if (!body || !c) return;
    const { bleed, radius } = o;
    const w = body.offsetWidth;
    const h = body.offsetHeight;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const cw = w + bleed * 2;
    const ch = h + bleed * 2;
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    c.style.width = `${cw}px`;
    c.style.height = `${ch}px`;
    c.style.left = `${-bleed}px`;
    c.style.top = `${-bleed}px`;
    field.setBody({ x: bleed, y: bleed, w, h, r: radius === "pill" ? h / 2 : radius });
    resolveColors();
    if (running) draw();
  }

  /** Pointer moved while idle: check proximity at most once per frame. */
  function onPointer() {
    if (running || !visible || probing || disposed) return;
    probing = true;
    probe = requestAnimationFrame(() => {
      probing = false;
      probe = 0;
      const c = canvas();
      const ps = getPointer();
      if (!c || !ps.present) return;
      const rect = c.getBoundingClientRect();
      const x = ps.x - rect.left;
      const y = ps.y - rect.top;
      const b = field.body;
      const a = field.config.awareness;
      if (x < b.x - a || y < b.y - a || x > b.x + b.w + a || y > b.y + b.h + a) return;
      field.setPointer({ x, y });
      field.update(0);
      if (field.distance < a && !field.inside) start();
    });
  }

  function setVisible(v: boolean) {
    visible = v;
    if (!v) {
      stop();
      opts().onBow?.(0, 0);
    } else if (field.isActive()) {
      start();
    } else {
      scheduleIdle();
    }
  }

  /** Attach observers and the pointer subscription. Returns a teardown. */
  function mount(): () => void {
    const o = opts();
    const body = o.bodyRef.current;
    const c = canvas();
    if (!o.enabled || !body || !c) {
      clear();
      field.reset();
      return () => {};
    }
    disposed = false;
    field.reset();
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(body);
    visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              const e = entries[0];
              if (e) setVisible(e.isIntersecting);
            },
            { rootMargin: "64px" },
          )
        : null;
    io?.observe(body);
    const unsubscribe = subscribePointer(onPointer);
    scheduleIdle();
    return () => {
      disposed = true;
      unsubscribe();
      ro?.disconnect();
      io?.disconnect();
      stop();
      field.reset();
    };
  }

  return {
    field,
    mount,
    setConfig: (c: Partial<StrandFieldConfig>) => field.setConfig(c),
    burst(count = 5, options: { spread?: "cluster" | "ring"; peak?: number } = { spread: "ring" }) {
      if (!opts().enabled) return;
      field.burst(count, options);
      start();
    },
    release: () => field.release(),
  };
}

/**
 * Binds a StrandField to a canvas overlay. Runs the animation loop only while
 * something is moving, gates on viewport visibility, shares one window pointer
 * listener across instances, and cleans up everything on unmount.
 */
export function useStrandField(options: UseStrandFieldOptions): StrandFieldHandle {
  // The controller reads the latest options through this ref at call time.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  // The "latest ref" pattern: the controller only dereferences it inside
  // effects, frames and event callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [controller] = useState(() => createController(latest));

  // Keep the simulation config in sync without remounting observers.
  const cfgKey = JSON.stringify(options.config);
  useEffect(() => {
    controller.setConfig(latest.current.config);
  }, [cfgKey, controller]);

  useEffect(() => {
    return controller.mount();
  }, [controller, options.enabled, options.bleed, options.radius]);

  return useMemo(
    () => ({
      burst: (count, opts) => controller.burst(count, opts),
      release: () => controller.release(),
      field: () => controller.field,
    }),
    [controller],
  );
}
