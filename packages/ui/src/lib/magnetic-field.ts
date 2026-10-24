/**
 * Magnetic field math: how far an element should move toward a pointer that
 * is within `radius` px of its box. Pure, framework-free, testable.
 */

import { clamp, ease } from "@/lib/springs";

export interface MagneticFieldOptions {
  /** Distance from the element's edge (px) at which the pull begins. */
  radius: number;
  /** 0–1. Fraction of the pointer's offset from the centre that the element follows. */
  strength: number;
  /** Cap on the displacement vector length (px). */
  maxOffset: number;
  /** Restrict movement to one axis. */
  axis?: "both" | "x" | "y";
}

export interface MagneticSample {
  /** Displacement to apply (px). */
  x: number;
  y: number;
  /** 0 outside the field, 1 at the edge of the element and inside it. */
  proximity: number;
  /** Pointer is inside the element's box. */
  inside: boolean;
  /** Pointer is within the field. */
  active: boolean;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const IDLE_SAMPLE: MagneticSample = { x: 0, y: 0, proximity: 0, inside: false, active: false };

/** Distance from a point to the box's edge; 0 inside. */
export function boxDistance(box: Box, px: number, py: number): number {
  const dx = Math.max(box.left - px, 0, px - (box.left + box.width));
  const dy = Math.max(box.top - py, 0, py - (box.top + box.height));
  return Math.hypot(dx, dy);
}

export function magneticSample(
  pointer: { x: number; y: number } | null,
  box: Box,
  opts: MagneticFieldOptions,
): MagneticSample {
  if (!pointer || opts.radius <= 0) return IDLE_SAMPLE;
  const d = boxDistance(box, pointer.x, pointer.y);
  if (d >= opts.radius) return IDLE_SAMPLE;
  const proximity = ease(opts.radius, 0, d); // smooth 0 → 1 as the pointer approaches
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  let x = (pointer.x - cx) * clamp(opts.strength, 0, 1) * proximity;
  let y = (pointer.y - cy) * clamp(opts.strength, 0, 1) * proximity;
  if (opts.axis === "x") y = 0;
  if (opts.axis === "y") x = 0;
  const len = Math.hypot(x, y);
  if (len > opts.maxOffset && len > 0) {
    x = (x / len) * opts.maxOffset;
    y = (y / len) * opts.maxOffset;
  }
  return { x, y, proximity, inside: d === 0, active: true };
}
