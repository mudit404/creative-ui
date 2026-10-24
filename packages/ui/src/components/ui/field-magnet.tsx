"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion as m, useTransform, type SpringOptions } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useMagneticField } from "@/hooks/use-magnetic-field";

export type FieldMagnetMotion = "auto" | "reduced" | "off";
export type FieldMagnetSpring = "soft" | "snappy" | "stiff";

export interface FieldMagnetProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Distance from the element's edge (px) at which the pull begins. */
  radius?: number;
  /** 0–1. How much of the pointer's offset from the centre the element follows. */
  strength?: number;
  /** Cap on the displacement (px). */
  maxOffset?: number;
  /** Extra pull on the children relative to the frame (parallax). 0 = move together. */
  innerStrength?: number;
  /** Restrict movement to one axis. */
  axis?: "both" | "x" | "y";
  /** Scale reached at full proximity. */
  scale?: number;
  /** Spring feel. */
  spring?: FieldMagnetSpring | SpringOptions;
  /** `auto` follows prefers-reduced-motion; the pull is purely decorative, so `reduced` disables it. */
  motion?: FieldMagnetMotion;
  disabled?: boolean;
  /** Render the child element as the moving element instead of a wrapping span. */
  asChild?: boolean;
  /** Display mode of the static frame. */
  display?: "inline-block" | "block";
}

const SPRINGS: Record<FieldMagnetSpring, SpringOptions> = {
  soft: { stiffness: 120, damping: 14, mass: 1 },
  snappy: { stiffness: 300, damping: 22, mass: 1 },
  stiff: { stiffness: 520, damping: 34, mass: 1 },
};

const MotionSlot = m.create(Slot);

/**
 * FieldMagnet — a primitive that pulls its content toward a nearby pointer.
 *
 * The outer frame never moves (it is the measurement anchor and keeps layout
 * stable); the inner element translates and scales with springs. Children
 * keep their own semantics: wrap a button, a link, an icon or a card.
 */
export const FieldMagnet = React.forwardRef<HTMLSpanElement, FieldMagnetProps>(function FieldMagnet(
  {
    radius = 120,
    strength = 0.35,
    maxOffset = 24,
    innerStrength = 0,
    axis = "both",
    scale = 1,
    spring = "snappy",
    motion = "auto",
    disabled = false,
    asChild = false,
    display = "inline-block",
    className,
    children,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const enabled = mode === "full" && !disabled;
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  React.useImperativeHandle(ref, () => anchorRef.current as HTMLSpanElement);

  const { x, y, proximity } = useMagneticField(anchorRef, {
    enabled,
    radius,
    strength,
    maxOffset,
    axis,
    spring: typeof spring === "string" ? SPRINGS[spring] : spring,
  });
  const s = useTransform(proximity, (p) => 1 + (scale - 1) * p);
  const innerX = useTransform(x, (v) => v * innerStrength);
  const innerY = useTransform(y, (v) => v * innerStrength);

  const Moving = asChild ? MotionSlot : m.span;
  const content =
    innerStrength > 0 && !asChild ? (
      <m.span className="block" style={{ x: innerX, y: innerY }}>
        {children}
      </m.span>
    ) : (
      children
    );

  return (
    <span
      ref={anchorRef}
      data-slot="field-magnet"
      data-motion={mode}
      className={cn("relative", display === "block" ? "block" : "inline-block", className)}
      {...rest}
    >
      <Moving className={asChild ? undefined : "block"} style={{ x, y, scale: s }}>
        {content}
      </Moving>
    </span>
  );
});

FieldMagnet.displayName = "FieldMagnet";
