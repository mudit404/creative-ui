"use client";

import * as React from "react";
import { motion as m, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { clamp, formatDomainValue, linearScale, logScale, nearestOf, parseNumber, quantize, resolveDetent, stepBy, validateDomain, type Domain, type Scale } from "@/lib/bounded-value";

export type DetentDialVariant = "instrument" | "stepped" | "studio";
export type DetentDialMotion = "auto" | "reduced" | "off";
export type DetentDialSource = "pointer" | "keyboard" | "input" | "button" | "reset" | "wheel";

export interface DetentDialMeta {
  source: DetentDialSource;
  /** True when the committed value sits on a detent. */
  detent?: boolean;
}

export interface DetentDialProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  /** `log` requires min > 0; otherwise the dial falls back to linear with a diagnostic. */
  scale?: "linear" | "log";
  step?: number;
  /** Step used with Shift+Arrow. */
  fineStep?: number;
  /** Sorted unique snap points in domain units. */
  detents?: number[];
  /** Snap-in threshold as a fraction of the domain span. */
  snapIn?: number;
  /** Snap-out threshold (must exceed snapIn). */
  snapOut?: number;
  /** Vertical pointer travel in px that covers the whole domain. */
  dragDistance?: number;
  angleStart?: number;
  angleEnd?: number;
  variant?: DetentDialVariant;
  size?: "default" | "compact";
  /** Accessible name (required). */
  label: string;
  unit?: string;
  name?: string;
  formatValue?: (value: number) => string;
  /** Value restored by Reset (defaults to the initial value). */
  resetValue?: number;
  showInput?: boolean;
  showStepButtons?: boolean;
  showReset?: boolean;
  /** Mouse wheel adjusts the value only while focused; off by default. */
  wheel?: "off" | "focused";
  onValuePreview?: (value: number, meta: DetentDialMeta) => void;
  onValueCommit?: (value: number, meta: DetentDialMeta) => void;
  disabled?: boolean;
  readOnly?: boolean;
  motion?: DetentDialMotion;
}

export interface DetentDialHandle {
  focusValueInput: () => void;
  focusDial: () => void;
}

let warnedLog = false;

/**
 * DetentDial — a rotary numeric control with physical-feeling detents.
 *
 * Vertical drag (120 px for the whole domain by default) previews a value;
 * release commits once. Detents snap with hysteresis so slow passes never
 * flicker. Arrows, Shift+Arrows (fine step), Home/End, +/- buttons, a numeric
 * field and Reset cover non-drag use. Angles derive from values; the value is
 * the only source of truth.
 */
export const DetentDial = React.forwardRef<DetentDialHandle, DetentDialProps>(function DetentDial(
  {
    value: valueProp,
    defaultValue,
    min = 0,
    max = 100,
    scale = "linear",
    step = 1,
    fineStep = 0.1,
    detents = [],
    snapIn = 0.02,
    snapOut = 0.04,
    dragDistance = 120,
    angleStart = -135,
    angleEnd = 135,
    variant = "instrument",
    size = "default",
    label,
    unit,
    name,
    formatValue,
    resetValue,
    showInput = true,
    showStepButtons = true,
    showReset = true,
    wheel = "off",
    onValuePreview,
    onValueCommit,
    disabled = false,
    readOnly = false,
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  /* domain + scale with diagnostics (C42-T02) */
  const [diagnostic, domain, mapping] = React.useMemo<[string | null, Domain, Scale]>(() => {
    let d: Domain = { min, max, step };
    let diag: string | null = validateDomain(d);
    if (diag) d = { min: 0, max: 100, step: 1 };
    let s: Scale;
    if (scale === "log") {
      try {
        s = logScale(d.min, d.max);
      } catch {
        diag = "log scale requires min > 0; using a linear scale";
        s = linearScale(d.min, d.max);
      }
    } else s = linearScale(d.min, d.max);
    return [diag, d, s];
  }, [min, max, step, scale]);
  React.useEffect(() => {
    if (diagnostic && !warnedLog) {
      console.warn(`[DetentDial] ${diagnostic}`);
      warnedLog = true;
    }
  }, [diagnostic]);
  const span = domain.max - domain.min;
  const sortedDetents = React.useMemo(() => [...new Set(detents.filter((x) => Number.isFinite(x) && x >= domain.min && x <= domain.max))].sort((a, b) => a - b), [detents, domain]);
  const stepped = variant === "stepped" && sortedDetents.length > 0;
  const toCommittable = (v: number, fine = false) => (stepped ? nearestOf(v, sortedDetents) : quantize(v, fine ? { ...domain, step: fineStep } : domain));

  const [initialValue] = React.useState<number>(() => toCommittable(defaultValue ?? valueProp ?? domain.min));
  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState<number>(initialValue);
  const committed = isControlled ? toCommittable(valueProp) : internal;
  const [preview, setPreview] = React.useState<number | null>(null);
  const shown = preview ?? committed;

  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const inert = disabled || readOnly;

  const fmt = (v: number) => formatDomainValue(v, domain, formatValue);
  const angleOf = (v: number) => angleStart + mapping.toFraction(v) * (angleEnd - angleStart);

  /* commit / preview */
  const emit = (v: number, meta: DetentDialMeta, fine = false) => {
    const next = toCommittable(v, fine);
    if (!isControlled) setInternal(next);
    onValueCommit?.(next, { ...meta, detent: sortedDetents.includes(next) });
  };

  /* drag */
  const drag = React.useRef<{ pointerId: number; startY: number; startFraction: number; snapped: number | null } | null>(null);
  const overshoot = useMotionValue(0);
  const overshootSpring = useSpring(overshoot, { stiffness: 600, damping: 22 });
  const committedRef = React.useRef(committed);
  React.useEffect(() => {
    // an external revision cancels a pending drag (C42-T04)
    if (committedRef.current !== committed && drag.current) {
      drag.current = null;
      setPreview(null);
    }
    committedRef.current = committed;
  }, [committed]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inert || drag.current || e.button !== 0) return;
    drag.current = { pointerId: e.pointerId, startY: e.clientY, startFraction: mapping.toFraction(committed), snapped: null };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPreview(committed);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const f = clamp(d.startFraction + (d.startY - e.clientY) / dragDistance, 0, 1);
    let v = quantize(mapping.fromFraction(f), domain);
    const snap = resolveDetent(v, sortedDetents, span, snapIn, Math.max(snapOut, snapIn), d.snapped);
    d.snapped = snap;
    if (snap !== null) v = snap;
    if (stepped) v = nearestOf(v, sortedDetents);
    setPreview(v);
    onValuePreview?.(v, { source: "pointer", detent: snap !== null });
  };
  const finish = (e: React.PointerEvent<HTMLDivElement>, cancel: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
    const final = preview;
    setPreview(null);
    if (cancel || final === null) return;
    if (mode === "full") {
      overshoot.jump(final >= committed ? 4 : -4); // max 4° visual overshoot, value untouched
      overshoot.set(0);
    }
    emit(final, { source: "pointer" });
  };

  /* steps: coarse steps move relative to the current value (a fine offset survives), at fine precision */
  const fineDomain = React.useMemo<Domain>(() => ({ ...domain, step: Math.min(fineStep, domain.step) }), [domain, fineStep]);
  const moveBy = (count: number) => quantize(committed + count * domain.step, fineDomain);

  /* keyboard */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (inert) return;
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = e.shiftKey ? stepBy(committed, 1, fineDomain) : moveBy(1);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = e.shiftKey ? stepBy(committed, -1, fineDomain) : moveBy(-1);
    else if (e.key === "PageUp") next = moveBy(10);
    else if (e.key === "PageDown") next = moveBy(-10);
    else if (e.key === "Home") next = domain.min;
    else if (e.key === "End") next = domain.max;
    else if (e.key === "Escape" && drag.current) {
      drag.current = null;
      setPreview(null);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    if (stepped) {
      const i = sortedDetents.indexOf(nearestOf(committed, sortedDetents));
      const dir = next > committed ? 1 : next < committed ? -1 : 0;
      const j = clamp(i + dir, 0, sortedDetents.length - 1);
      next = e.key === "Home" ? sortedDetents[0]! : e.key === "End" ? sortedDetents[sortedDetents.length - 1]! : sortedDetents[j]!;
    }
    emit(next, { source: "keyboard" }, !stepped);
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (wheel !== "focused" || inert || document.activeElement !== e.currentTarget) return;
    e.preventDefault();
    emit(moveBy(e.deltaY < 0 ? 1 : -1), { source: "wheel" }, !stepped);
  };

  /* refs */
  const dialRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => ({ focusValueInput: () => inputRef.current?.focus(), focusDial: () => dialRef.current?.focus() }), []);

  /* numeric entry */
  const [text, setText] = React.useState(() => fmt(committed));
  const [invalid, setInvalid] = React.useState(false);
  const [synced, setSynced] = React.useState(committed);
  if (synced !== committed) {
    setSynced(committed);
    setText(fmt(committed));
    setInvalid(false);
  }
  const commitText = () => {
    const n = parseNumber(text);
    if (n === null) {
      setInvalid(true); // prior value stays (C42-T07)
      return;
    }
    setInvalid(false);
    emit(n, { source: "input" });
  };

  /* geometry */
  const px = size === "compact" ? 56 : 80;
  const r = 36;
  const ticks = React.useMemo(() => {
    const n = 10;
    return Array.from({ length: n + 1 }, (_, i) => angleStart + (i / n) * (angleEnd - angleStart));
  }, [angleStart, angleEnd]);
  const angle = angleOf(shown);
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const arcPath = (a0: number, a1: number) => {
    const x0 = 50 + r * Math.cos(rad(a0));
    const y0 = 50 + r * Math.sin(rad(a0));
    const x1 = 50 + r * Math.cos(rad(a1));
    const y1 = 50 + r * Math.sin(rad(a1));
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  const needleRotate = useTransform(overshootSpring, (o) => angle + (mode === "full" ? o : 0));
  const uid = React.useId();
  const valueText = unit ? `${fmt(shown)} ${unit}` : fmt(shown);

  return (
    <div
      data-slot="detent-dial"
      data-variant={variant}
      data-motion={mode}
      data-previewing={preview !== null ? "true" : undefined}
      data-diagnostic={diagnostic ?? undefined}
      className={cn("inline-flex flex-col items-center gap-2 text-[var(--cui-dial-text,light-dark(#141311,#ecebe6))]", disabled && "opacity-50", className)}
      {...rest}
    >
      <div
        ref={dialRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={domain.min}
        aria-valuemax={domain.max}
        aria-valuenow={shown}
        aria-valuetext={valueText}
        aria-disabled={inert || undefined}
        aria-describedby={`${uid}-hint`}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onLostPointerCapture={(e) => finish(e, true)}
        className={cn(
          "relative select-none touch-none rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[var(--cui-dial-focus,light-dark(#141311,#ecebe6))]",
          inert ? "cursor-default" : "cursor-ns-resize",
        )}
        style={{ width: px, height: px }}
      >
        <svg aria-hidden viewBox="0 0 100 100" className="block h-full w-full overflow-visible">
          {/* ticks */}
          {ticks.map((a, i) => (
            <line key={i} x1={50 + 46 * Math.cos(rad(a))} y1={50 + 46 * Math.sin(rad(a))} x2={50 + 49 * Math.cos(rad(a))} y2={50 + 49 * Math.sin(rad(a))} style={{ stroke: "var(--cui-dial-tick, light-dark(rgba(20,19,17,0.35), rgba(236,235,230,0.35)))" }} strokeWidth={1.5} strokeLinecap="round" />
          ))}
          {sortedDetents.map((d) => {
            const a = angleOf(d);
            return <line key={d} x1={50 + 44 * Math.cos(rad(a))} y1={50 + 44 * Math.sin(rad(a))} x2={50 + 50 * Math.cos(rad(a))} y2={50 + 50 * Math.sin(rad(a))} style={{ stroke: "var(--cui-dial-detent, light-dark(#141311, #ecebe6))" }} strokeWidth={2.2} strokeLinecap="round" />;
          })}
          {/* arc track + active arc */}
          <path d={arcPath(angleStart, angleEnd)} fill="none" style={{ stroke: "var(--cui-dial-arc-track, light-dark(rgba(20,19,17,0.12), rgba(236,235,230,0.12)))" }} strokeWidth={5} strokeLinecap="round" />
          {mapping.toFraction(shown) > 0.001 && <path d={arcPath(angleStart, angle)} fill="none" style={{ stroke: "var(--cui-dial-arc, light-dark(#141311, #ecebe6))" }} strokeWidth={5} strokeLinecap="round" />}
          {/* face */}
          <defs>
            <radialGradient id={`${uid}-face`} cx="35%" cy="30%" r="80%">
              <stop offset="0" style={{ stopColor: "var(--cui-dial-face-hi, light-dark(#ffffff, #3a3a36))" }} />
              <stop offset="1" style={{ stopColor: "var(--cui-dial-face, light-dark(#e9e5dc, #2a2a27))" }} />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="29" fill={`url(#${uid}-face)`} style={{ stroke: "var(--cui-dial-edge, light-dark(rgba(20,19,17,0.5), rgba(236,235,230,0.45)))" }} strokeWidth={1} />
          {variant === "studio" && <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />}
          {/* notch (rotates from the value) */}
          <m.g style={{ rotate: needleRotate, transformOrigin: "50px 50px" }}>
            <rect x="48.4" y="24" width="3.2" height="12" rx="1.6" style={{ fill: "var(--cui-dial-notch, light-dark(#141311, #ecebe6))" }} />
          </m.g>
        </svg>
      </div>
      <div className={cn("text-center font-mono tabular-nums", variant === "instrument" ? "text-[15px] font-semibold" : "text-[13px]")} aria-hidden>
        {valueText}
      </div>
      <p id={`${uid}-hint`} className="sr-only">
        Drag up or down, use arrow keys, or type a value.
      </p>
      {(showInput || showStepButtons || showReset) && (
        <div className="flex items-center gap-1">
          {showStepButtons && (
            <button type="button" aria-label={`Decrease ${label}`} disabled={inert} onClick={() => emit(stepped ? sortedDetents[Math.max(0, sortedDetents.indexOf(nearestOf(committed, sortedDetents)) - 1)]! : moveBy(-1), { source: "button" }, !stepped)} className={BTN}>
              −
            </button>
          )}
          {showInput && (
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              aria-label={`${label} value`}
              aria-invalid={invalid || undefined}
              value={text}
              disabled={inert}
              onChange={(e) => setText(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitText();
                }
              }}
              className={cn(
                "h-8 w-20 rounded-md border bg-[var(--cui-dial-input,light-dark(#faf9f6,#1f1f1c))] px-2 text-center font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-dial-arc,light-dark(#141311,#ecebe6))]",
                invalid ? "border-[var(--cui-dial-error,light-dark(#b8310c,#ff8a65))]" : "border-[var(--cui-dial-edge,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))]",
              )}
            />
          )}
          {showStepButtons && (
            <button type="button" aria-label={`Increase ${label}`} disabled={inert} onClick={() => emit(stepped ? sortedDetents[Math.min(sortedDetents.length - 1, sortedDetents.indexOf(nearestOf(committed, sortedDetents)) + 1)]! : moveBy(1), { source: "button" }, !stepped)} className={BTN}>
              +
            </button>
          )}
          {showReset && (
            <button type="button" aria-label={`Reset ${label}`} disabled={inert} onClick={() => emit(resetValue ?? initialValue, { source: "reset" })} className={cn(BTN, "w-auto px-2 text-[12px]")}>
              Reset
            </button>
          )}
        </div>
      )}
      {name && <input type="hidden" name={name} value={committed} disabled={disabled} />}
      {diagnostic && (
        <p role="note" className="max-w-[200px] text-center text-[11px] text-[var(--cui-dial-error,light-dark(#b8310c,#ff8a65))]">
          {diagnostic}
        </p>
      )}
    </div>
  );
});
DetentDial.displayName = "DetentDial";

const BTN =
  "inline-flex size-8 items-center justify-center rounded-md border border-[var(--cui-dial-edge,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))] text-base leading-none outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06))] focus-visible:ring-2 focus-visible:ring-[var(--cui-dial-arc,light-dark(#141311,#ecebe6))] disabled:cursor-not-allowed disabled:opacity-40";
