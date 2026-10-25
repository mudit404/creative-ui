"use client";

import * as React from "react";
import { motion as m, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type LiquidSwitchSize = "sm" | "md" | "lg";
export type LiquidSwitchMotion = "auto" | "reduced" | "off";

export interface LiquidSwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue"> {
  /** Controlled state. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: LiquidSwitchSize;
  /** 0–1. How much the thumb stretches and how long the tail lingers while pouring. */
  viscosity?: number;
  /** `auto` follows prefers-reduced-motion; `reduced` slides without goo; `off` snaps instantly. */
  motion?: LiquidSwitchMotion;
  required?: boolean;
  /** With `name`, a hidden checkbox is rendered so the switch participates in forms. */
  name?: string;
  value?: string;
  /** Colour overrides. Also settable with the `--ls-*` CSS variables. */
  colors?: Partial<{ trackOff: string; trackOn: string; thumb: string }>;
}

const SIZES: Record<LiquidSwitchSize, { w: number; h: number; pad: number }> = {
  sm: { w: 40, h: 22, pad: 3 },
  md: { w: 52, h: 30, pad: 4 },
  lg: { w: 68, h: 38, pad: 5 },
};

/**
 * LiquidSwitch — a switch whose thumb pours from one side to the other.
 *
 * Semantics: a native `<button role="switch" aria-checked>`; Space/Enter
 * toggle through the native click. Controlled or uncontrolled. With `name`,
 * a hidden checkbox carries the value in forms.
 *
 * Motion: the thumb and a lagging "tail" circle are drawn in an SVG under a
 * gooey filter (blur + alpha threshold), so while the thumb travels the two
 * merge into a stretching drop that pinches off and is absorbed. Springs
 * come from Motion; the filter only runs while the thumb moves.
 */
export const LiquidSwitch = React.forwardRef<HTMLButtonElement, LiquidSwitchProps>(function LiquidSwitch(
  {
    checked: checkedProp,
    defaultChecked = false,
    onCheckedChange,
    size = "md",
    viscosity = 0.6,
    motion = "auto",
    required,
    name,
    value = "on",
    colors,
    disabled,
    className,
    style,
    onClick,
    ...rest
  },
  ref,
) {
  const isControlled = checkedProp !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const checked = isControlled ? checkedProp : internal;

  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  const { w, h, pad } = SIZES[size];
  const r = (h - pad * 2) / 2;
  const travel = w - pad * 2 - r * 2;
  const visc = Math.max(0, Math.min(1, viscosity));

  /* springs: the thumb leads, the tail lags, the goo filter joins them */
  const target = useMotionValue(checked ? 1 : 0);
  React.useEffect(() => {
    if (mode === "off") target.jump(checked ? 1 : 0);
    else target.set(checked ? 1 : 0);
  }, [checked, mode, target]);
  const lead = useSpring(target, mode === "full" ? { stiffness: 400, damping: 26 } : { stiffness: 700, damping: 40 });
  const tail = useSpring(target, { stiffness: 160 - 80 * visc, damping: 16 - 4 * visc });
  const thumbX = useTransform(lead, (p) => pad + r + p * travel);
  const tailX = useTransform(tail, (p) => pad + r + p * travel);
  const lag = useTransform([lead, tail], ([a, b]: number[]) => Math.min(1, Math.abs(a - b) * (1.4 + visc)));
  const thumbRx = useTransform(lag, (l) => r * (1 + 0.45 * l * visc));
  const thumbRy = useTransform(lag, (l) => r * (1 - 0.12 * l * visc));
  const tailR = useTransform(lag, (l) => r * (0.95 - 0.4 * l));
  const fillOpacity = useTransform(lead, (p) => Math.max(0, Math.min(1, p)));
  const gooId = React.useId();

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || disabled) return;
    const next = !checked;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  const vars: Record<string, string> = {};
  if (colors?.trackOff) vars["--ls-track-off"] = colors.trackOff;
  if (colors?.trackOn) vars["--ls-track-on"] = colors.trackOn;
  if (colors?.thumb) vars["--ls-thumb"] = colors.thumb;

  return (
    <>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-required={required || undefined}
        data-slot="liquid-switch"
        data-state={checked ? "checked" : "unchecked"}
        data-motion={mode}
        disabled={disabled}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer select-none items-center rounded-full align-middle outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--ls-ring,var(--ls-track-on,light-dark(#141311,#ecebe6)))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ls-ring-offset,light-dark(white,#0f0f0d))]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={{
          width: w,
          height: h,
          background: "var(--ls-track-off, light-dark(#86837d, #6b6b67))",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
          WebkitTapHighlightColor: "transparent",
          ...(vars as React.CSSProperties),
          ...style,
        }}
        onClick={toggle}
        {...rest}
      >
        {/* on-colour fill, cross-faded by the lead spring */}
        <m.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ opacity: fillOpacity, background: "var(--ls-track-on, light-dark(#141311, #ecebe6))" }}
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
        >
          {mode === "full" && (
            <defs>
              <filter id={gooId} x="-30%" y="-50%" width="160%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation={r * 0.28 + 0.6} result="blur" />
                <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8" result="goo" />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </defs>
          )}
          <g filter={mode === "full" ? `url(#${gooId})` : undefined} style={{ fill: "var(--ls-thumb, light-dark(#ffffff, #141311))" }}>
            {mode === "full" && <m.circle cy={h / 2} cx={tailX} r={tailR} />}
            <m.ellipse cy={h / 2} cx={thumbX} rx={thumbRx} ry={thumbRy} />
          </g>
          {/* specular sheen on the thumb */}
          <m.ellipse cy={h / 2 - r * 0.35} cx={thumbX} rx={r * 0.45} ry={r * 0.22} style={{ fill: "rgba(255,255,255,0.55)" }} />
          {/* contact shadow under the thumb */}
          <m.ellipse cy={h / 2 + r * 0.9} cx={thumbX} rx={r * 0.8} ry={r * 0.18} style={{ fill: "rgba(0,0,0,0.18)" }} />
        </svg>
      </button>
      {name && (
        <input
          type="checkbox"
          aria-hidden
          tabIndex={-1}
          name={name}
          value={value}
          checked={checked}
          required={required}
          disabled={disabled}
          onChange={() => {}}
          style={{ position: "absolute", pointerEvents: "none", opacity: 0, margin: 0, width: 1, height: 1 }}
        />
      )}
    </>
  );
});

LiquidSwitch.displayName = "LiquidSwitch";
