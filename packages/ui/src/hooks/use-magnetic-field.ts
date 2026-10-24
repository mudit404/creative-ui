"use client";

import { useEffect, type RefObject } from "react";
import { useMotionValue, useSpring, type MotionValue, type SpringOptions } from "motion/react";
import { getPointer, subscribePointer } from "@/lib/pointer-field";
import { magneticSample, IDLE_SAMPLE, type MagneticFieldOptions } from "@/lib/magnetic-field";

export interface UseMagneticFieldOptions extends MagneticFieldOptions {
  enabled?: boolean;
  spring?: SpringOptions;
  /** Called when the field becomes active or idle. */
  onActiveChange?: (active: boolean) => void;
}

export interface MagneticFieldValues {
  /** Sprung displacement, px. Bind to a motion element's `x`/`y`. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** Sprung 0–1 proximity. */
  proximity: MotionValue<number>;
}

const DEFAULT_SPRING: SpringOptions = { stiffness: 260, damping: 22, mass: 1 };

/**
 * Pulls an element toward the pointer while it is within `radius` of the
 * element's box. `anchorRef` must point at an element that does NOT move
 * (the static wrapper), so measurements never feed back into themselves.
 *
 * Cost when idle: one rAF-throttled `getBoundingClientRect` per pointer
 * move for visible instances, nothing while the pointer is still. Motion
 * drives the springs; no custom animation loop.
 */
export function useMagneticField(
  anchorRef: RefObject<HTMLElement | null>,
  { enabled = true, spring, onActiveChange, ...field }: UseMagneticFieldOptions,
): MagneticFieldValues {
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const targetP = useMotionValue(0);
  const x = useSpring(targetX, spring ?? DEFAULT_SPRING);
  const y = useSpring(targetY, spring ?? DEFAULT_SPRING);
  const proximity = useSpring(targetP, spring ?? DEFAULT_SPRING);

  const key = JSON.stringify(field);
  useEffect(() => {
    const el = anchorRef.current;
    if (!enabled || !el) {
      targetX.set(0);
      targetY.set(0);
      targetP.set(0);
      return;
    }
    const opts = JSON.parse(key) as MagneticFieldOptions;
    let raf = 0;
    let pending = false;
    let visible = true;
    let active = false;

    const apply = (sample: typeof IDLE_SAMPLE) => {
      targetX.set(sample.x);
      targetY.set(sample.y);
      targetP.set(sample.proximity);
      if (sample.active !== active) {
        active = sample.active;
        el.dataset.active = active ? "true" : "false";
        onActiveChange?.(active);
      }
    };

    const probe = () => {
      pending = false;
      const p = getPointer();
      if (!visible || !p.present || p.coarse) {
        if (active) apply(IDLE_SAMPLE);
        return;
      }
      const r = el.getBoundingClientRect();
      apply(magneticSample({ x: p.x, y: p.y }, { left: r.left, top: r.top, width: r.width, height: r.height }, opts));
    };

    const unsubscribe = subscribePointer(() => {
      // `pending` (not the frame id) guards re-entry so a synchronous rAF still works
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(probe);
    });
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            visible = entries[0]?.isIntersecting ?? true;
            if (!visible && active) apply(IDLE_SAMPLE);
          })
        : null;
    io?.observe(el);

    return () => {
      unsubscribe();
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      targetX.set(0);
      targetY.set(0);
      targetP.set(0);
      delete el.dataset.active;
    };
    // onActiveChange is read at call time; `key` captures the field options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, anchorRef, targetX, targetY, targetP]);

  return { x, y, proximity };
}
