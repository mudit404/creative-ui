"use client";

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { motion as m, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useStrandField } from "@/hooks/use-strand-field";

/* ────────────────────────────── types ────────────────────────────── */

export type MaterialButtonTone = "ink" | "bone";
export type MaterialButtonSize = "sm" | "md" | "lg";
export type MaterialButtonShape = "pill" | "rounded";
export type MaterialButtonFinish = "silver" | "flat";
export type MaterialButtonMotion = "auto" | "reduced" | "off";

export interface MaterialButtonColors {
  /** Slab colour. */
  surface: string;
  /** Label colour (the silver finish derives its gradient from this). */
  label: string;
  /** Strand colour. Defaults to the surface colour so strands read as the same material. */
  goo: string;
}

export interface MaterialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Colour preset. `ink` is a jet-black slab for light surfaces, `bone` an off-white slab for dark ones. */
  tone?: MaterialButtonTone;
  size?: MaterialButtonSize;
  shape?: MaterialButtonShape;
  /** Label finish. `silver` renders a polished-metal gradient on text children. */
  finish?: MaterialButtonFinish;
  /** Colour overrides. Also settable with the `--mb-surface`, `--mb-label` and `--mb-goo` CSS variables. */
  colors?: Partial<MaterialButtonColors>;
  /** Distance in px from the edge at which strands launch toward the pointer. */
  reach?: number;
  /** Maximum simultaneous strands. */
  tendrils?: number;
  /** 0–1. Scales strand count, thickness and magnetism together. */
  intensity?: number;
  /** Time multiplier for lunges and recoil. */
  speed?: number;
  /** Idle bursts along the edge every couple of seconds while nobody is near. */
  idle?: boolean;
  /** Hover lift in px. */
  lift?: number;
  /** `auto` follows `prefers-reduced-motion`; `reduced` keeps lift only; `off` disables all motion. */
  motion?: MaterialButtonMotion;
  /** Shows a spinner, sets `aria-busy` and blocks activation. */
  loading?: boolean;
  /** Render the child element (e.g. an `<a>`) as the control instead of a `<button>`. */
  asChild?: boolean;
  /** Class applied to the outer wrapper, for layout. `className` targets the control itself. */
  wrapperClassName?: string;
}

/* ───────────────────────────── presets ───────────────────────────── */

const TONES: Record<MaterialButtonTone, Record<string, string>> = {
  ink: {
    "--mb-surface": "#0b0b0c",
    "--mb-label": "#d9d9dc",
    "--mb-goo": "#0b0b0c",
    "--mb-sheen": "rgba(255,255,255,0.16)",
    "--mb-shade": "rgba(0,0,0,0.5)",
    "--mb-shadow": "rgba(12,12,18,0.55)",
    "--mb-ring": "#0b0b0c",
  },
  bone: {
    "--mb-surface": "#efece6",
    "--mb-label": "#17160f",
    "--mb-goo": "#efece6",
    "--mb-sheen": "rgba(255,255,255,0.75)",
    "--mb-shade": "rgba(0,0,0,0.12)",
    "--mb-shadow": "rgba(40,36,30,0.35)",
    "--mb-ring": "#efece6",
  },
};

const SIZES: Record<
  MaterialButtonSize,
  { className: string; radius: number; strand: number; font: string }
> = {
  sm: { className: "h-9 px-4 gap-1.5", radius: 10, strand: 0.95, font: "text-[13px]" },
  md: { className: "h-12 px-6 gap-2", radius: 12, strand: 1.15, font: "text-[15px]" },
  lg: { className: "h-[60px] px-[30px] gap-2.5", radius: 14, strand: 1.35, font: "text-[19px]" },
};

const FACE_BACKGROUND = [
  "radial-gradient(42% 95% at 15% 50%, var(--mb-sheen) 0%, transparent 72%)",
  "linear-gradient(180deg, color-mix(in srgb, var(--mb-sheen) 55%, transparent) 0%, transparent 30%)",
  "linear-gradient(0deg, var(--mb-shade) 0%, transparent 42%)",
  "var(--mb-surface)",
].join(", ");

const FACE_INSET_SHADOW = [
  "inset 0 1px 0 var(--mb-sheen)",
  "inset 0 -1.5px 2px var(--mb-shade)",
  "inset 0 0 0 1px color-mix(in srgb, var(--mb-sheen) 25%, transparent)",
].join(", ");

const SILVER_LABEL: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(180deg, color-mix(in srgb, var(--mb-label) 55%, white) 0%, var(--mb-label) 42%, color-mix(in srgb, var(--mb-label) 62%, black) 52%, color-mix(in srgb, var(--mb-label) 80%, white) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.35))",
};

/* ──────────────────────────── component ──────────────────────────── */

export const MaterialButton = React.forwardRef<HTMLButtonElement, MaterialButtonProps>(
  function MaterialButton(
    {
      tone = "ink",
      size = "md",
      shape = "pill",
      finish = "silver",
      colors,
      reach = 120,
      tendrils = 6,
      intensity = 1,
      speed = 1,
      idle = true,
      lift = 10,
      motion = "auto",
      loading = false,
      asChild = false,
      disabled,
      className,
      wrapperClassName,
      style,
      children,
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      onClick,
      ...rest
    },
    forwardedRef,
  ) {
    const prefersReduced = useReducedMotion();
    const mode: "full" | "reduced" | "off" =
      motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
    const inert = !!disabled || loading;
    const fieldEnabled = mode === "full" && !inert;
    const liftPx = mode === "off" ? 0 : mode === "reduced" ? Math.min(lift, 4) : lift;

    const rootRef = React.useRef<HTMLSpanElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    React.useImperativeHandle(forwardedRef, () => buttonRef.current as HTMLButtonElement);

    const sizeCfg = SIZES[size];
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    const maxLength = Math.round(reach * 1.35);
    const wrapRadius = 7;
    const bleed = maxLength + wrapRadius + 28;

    const fieldConfig = React.useMemo(
      () => ({
        reach,
        awareness: Math.round(reach * 1.85),
        maxStrands: Math.round(tendrils * clampedIntensity),
        maxLength,
        thickness: 0.6 + 0.5 * clampedIntensity,
        magnetism: 0.6 + 0.7 * clampedIntensity,
        speed: Math.max(0.2, speed),
        idle,
        wrapRadius,
      }),
      [reach, tendrils, clampedIntensity, maxLength, speed, idle],
    );

    /* motion values */
    const hover = useMotionValue(0);
    const press = useMotionValue(0);
    const bowX = useMotionValue(0);
    const bowY = useMotionValue(0);
    const pointerX = useMotionValue(0);
    const pointerY = useMotionValue(0);
    const liftSpring = useSpring(hover, { stiffness: 121, damping: mode === "full" ? 21 : 26 });
    const pressSpring = useSpring(press, { stiffness: 900, damping: 45 });
    const y = useTransform(
      [liftSpring, pressSpring, bowY],
      ([l, p, b]: number[]) => -l * liftPx + p * 1.5 + b,
    );
    const scale = useTransform(pressSpring, (p) => 1 - 0.035 * p);
    const contactOpacity = useTransform(liftSpring, (l) => 1 - l * 0.85);
    const dropOpacity = useTransform(liftSpring, (l) => 0.25 + l * 0.75);
    const dropY = useTransform(liftSpring, (l) => l * 6);
    const dropScale = useTransform(liftSpring, (l) => 1 + l * 0.05);
    const sheenOpacity = useTransform(liftSpring, (l) => l);
    const sheenBackground = useMotionTemplate`radial-gradient(70px 44px at ${pointerX}px ${pointerY}px, var(--mb-sheen), transparent 70%)`;

    const { burst, release } = useStrandField({
      bodyRef: buttonRef,
      canvasRef,
      themeRef: rootRef,
      config: fieldConfig,
      radius: shape === "pill" ? "pill" : sizeCfg.radius,
      bleed,
      enabled: fieldEnabled,
      render: {
        goo: "var(--mb-goo)",
        highlight: "var(--mb-sheen)",
        shadow: "var(--mb-shadow)",
        baseRadius: sizeCfg.strand,
      },
      onBow: (bx, by) => {
        bowX.set(bx);
        bowY.set(by);
      },
      onFrame: (field) => {
        if (field.pointer) {
          pointerX.set(field.pointer.x - bleed);
          pointerY.set(field.pointer.y - bleed);
        }
      },
    });

    /* interaction handlers */
    const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerEnter?.(e);
      if (inert || e.pointerType === "touch") return;
      hover.set(1);
      release();
    };
    const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerLeave?.(e);
      hover.set(0);
      press.set(0);
    };
    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(e);
      if (inert) return;
      press.set(1);
      if (e.pointerType === "touch") burst(6, { spread: "ring", peak: 14 });
    };
    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerUp?.(e);
      press.set(0);
    };
    const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(e);
      press.set(0);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e);
      if (inert || e.repeat) return;
      if (e.key === "Enter" || e.key === " ") {
        press.set(1);
        burst(6, { spread: "ring", peak: 14 });
      }
    };
    const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyUp?.(e);
      press.set(0);
    };
    const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
      onFocus?.(e);
      if (!inert && e.currentTarget.matches(":focus-visible")) hover.set(1);
    };
    const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
      onBlur?.(e);
      hover.set(0);
      press.set(0);
    };
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    /* styles */
    const vars: Record<string, string> = { ...TONES[tone] };
    if (colors?.surface) {
      vars["--mb-surface"] = colors.surface;
      vars["--mb-goo"] = colors.goo ?? colors.surface;
      vars["--mb-ring"] = colors.surface;
    }
    if (colors?.label) vars["--mb-label"] = colors.label;
    if (colors?.goo) vars["--mb-goo"] = colors.goo;

    const radiusClass = shape === "pill" ? "rounded-full" : size === "sm" ? "rounded-[10px]" : size === "md" ? "rounded-[12px]" : "rounded-[14px]";
    const Comp = asChild ? Slot : "button";
    // With asChild the child element becomes the control; its own children become the label.
    const slotChild =
      asChild && React.isValidElement<{ children?: React.ReactNode }>(children) ? children : null;
    const labelContent = slotChild ? slotChild.props.children : children;
    const isText = typeof labelContent === "string" || typeof labelContent === "number";
    const label = (
      <span
        data-slot="material-button-label"
        className={cn("relative inline-flex items-center justify-center gap-[inherit]", loading && "invisible")}
        style={isText && finish === "silver" ? SILVER_LABEL : undefined}
      >
        {labelContent}
      </span>
    );

    return (
      <span
        ref={rootRef}
        data-slot="material-button"
        data-tone={tone}
        data-motion={mode}
        className={cn("relative inline-block align-middle isolate", wrapperClassName)}
        style={{ ...(vars as React.CSSProperties), ...style }}
      >
        {/* floor shadows (never lifted) */}
        <m.span
          aria-hidden
          className={cn("pointer-events-none absolute inset-0", radiusClass)}
          style={{
            opacity: contactOpacity,
            boxShadow: "0 1px 1.5px rgba(0,0,0,0.45), 0 4px 10px -2px var(--mb-shadow)",
          }}
        />
        <m.span
          aria-hidden
          className={cn("pointer-events-none absolute inset-0", radiusClass)}
          style={{
            opacity: dropOpacity,
            y: dropY,
            scale: dropScale,
            boxShadow: "0 12px 20px -8px var(--mb-shadow), 0 24px 40px -14px var(--mb-shadow)",
          }}
        />

        {/* lifted layer: goo + slab move together */}
        <m.span className="relative block" style={{ x: bowX, y }}>
          {fieldEnabled && (
            <canvas
              ref={canvasRef}
              aria-hidden
              className="pointer-events-none absolute z-0 select-none"
              style={{ left: -bleed, top: -bleed }}
            />
          )}
          <m.span className="relative z-10 block" style={{ scale }}>
            <Comp
              ref={buttonRef}
              type={asChild ? undefined : "button"}
              disabled={asChild ? undefined : inert}
              aria-disabled={asChild && inert ? true : undefined}
              aria-busy={loading || undefined}
              data-loading={loading || undefined}
              className={cn(
                "relative inline-flex w-full cursor-pointer select-none items-center justify-center overflow-hidden whitespace-nowrap font-semibold tracking-[-0.01em] outline-none transition-opacity",
                "focus-visible:ring-2 focus-visible:ring-[var(--mb-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mb-ring-offset,white)]",
                "disabled:cursor-not-allowed data-[loading]:opacity-100 disabled:opacity-60",
                sizeCfg.className,
                sizeCfg.font,
                radiusClass,
                className,
              )}
              style={{
                background: FACE_BACKGROUND,
                boxShadow: FACE_INSET_SHADOW,
                color: "var(--mb-label)",
                WebkitTapHighlightColor: "transparent",
              }}
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onClick={handleClick}
              {...rest}
            >
              {/* pointer-following sheen */}
              {mode !== "off" && (
                <m.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 mix-blend-screen"
                  style={{ opacity: sheenOpacity, background: sheenBackground }}
                />
              )}
              {/* travelling rim glint */}
              {mode === "full" && (
                <span
                  aria-hidden
                  className={cn("pointer-events-none absolute inset-0 overflow-hidden", radiusClass)}
                  style={{
                    padding: 1,
                    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                  }}
                >
                  <span
                    className="absolute left-1/2 top-1/2 aspect-square w-[260%] -translate-x-1/2 -translate-y-1/2 animate-spin [animation-duration:7s] motion-reduce:animate-none"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0 78%, var(--mb-sheen) 88%, transparent 96%)",
                    }}
                  />
                </span>
              )}
              {slotChild ? (
                <Slottable>{React.cloneElement(slotChild, undefined, label)}</Slottable>
              ) : (
                label
              )}
              {loading && (
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                  <svg className="size-[1.1em] animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
              )}
            </Comp>
          </m.span>
        </m.span>
      </span>
    );
  },
);

MaterialButton.displayName = "MaterialButton";
