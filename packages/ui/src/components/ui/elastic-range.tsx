"use client";

import * as React from "react";
import { motion as m, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { clamp, formatDomainValue, parseNumber, quantize, stepBy, validateDomain, type Domain } from "@/lib/bounded-value";

export type ElasticRangeVariant = "bounded" | "precision" | "interval";
export type ElasticRangeMotion = "auto" | "reduced" | "off";
export type ElasticRangeSource = "pointer" | "keyboard" | "input" | "button" | "reset";

export interface ElasticRangeMeta {
  source: ElasticRangeSource;
  /** Which thumb changed (interval only). */
  thumb?: "lower" | "upper";
}

export type ElasticRangeValue = number | [number, number];

export interface ElasticRangeLabels {
  /** Accessible name of the control (single) or the group (interval). Required. */
  label: string;
  lower?: string;
  upper?: string;
}

export interface ElasticRangeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: ElasticRangeValue;
  defaultValue?: ElasticRangeValue;
  min?: number;
  max?: number;
  step?: number;
  /** Minimum separation between interval thumbs, in domain units. */
  minGap?: number;
  variant?: ElasticRangeVariant;
  /** Transient quantized candidate while dragging. Never a commit. */
  onValuePreview?: (value: ElasticRangeValue, meta: ElasticRangeMeta) => void;
  /** One call per release, key action or precise entry. Controlled parents answer with a new `value` or keep the old one. */
  onValueCommit?: (value: ElasticRangeValue, meta: ElasticRangeMeta) => void;
  showInput?: boolean;
  showStepButtons?: boolean;
  /** 0–1. Decorative bow strength past the endpoints. */
  elasticity?: number;
  /** Maximum decorative bow in CSS px. */
  maxStretch?: number;
  /** Form field name. Interval serialises as `name.lower` / `name.upper`. */
  name?: string;
  formatValue?: (value: number) => string;
  labels: ElasticRangeLabels;
  disabled?: boolean;
  readOnly?: boolean;
  motion?: ElasticRangeMotion;
}

type Pair = [number, number];

function toPair(v: ElasticRangeValue | undefined, d: Domain, interval: boolean): Pair {
  if (Array.isArray(v)) return [quantize(v[0], d), quantize(v[1], d)];
  const n = quantize(typeof v === "number" ? v : d.min, d);
  return interval ? [n, quantize(d.max, d)] : [n, n];
}

function enforceGap(pair: Pair, moved: "lower" | "upper", gap: number, d: Domain): Pair {
  let [lo, hi] = pair;
  if (moved === "lower") lo = Math.min(lo, quantize(hi - gap, d));
  else hi = Math.max(hi, quantize(lo + gap, d));
  if (lo > hi) [lo, hi] = [hi, lo];
  return [lo, hi];
}

let warned = false;

/**
 * ElasticRange — a bounded numeric slider whose track bows past its ends.
 *
 * Single or interval mode. The committed value is authoritative; dragging only
 * previews. The bow and thumb squash are decoration: the number is clamped and
 * quantized before any callback. Arrow keys, Page keys, Home/End, +/- buttons
 * and a numeric input provide non-drag alternatives.
 */
export const ElasticRange = React.forwardRef<HTMLDivElement, ElasticRangeProps>(function ElasticRange(
  {
    value: valueProp,
    defaultValue,
    min = 0,
    max = 100,
    step = 1,
    minGap = 0,
    variant = "bounded",
    onValuePreview,
    onValueCommit,
    showInput = true,
    showStepButtons = true,
    elasticity = 0.5,
    maxStretch = 12,
    name,
    formatValue,
    labels,
    disabled = false,
    readOnly = false,
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const domainError = validateDomain({ min, max, step });
  const domain = React.useMemo<Domain>(() => (domainError ? { min: 0, max: 100, step: 1 } : { min, max, step }), [domainError, min, max, step]);
  React.useEffect(() => {
    if (domainError && !warned) {
      console.warn(`[ElasticRange] invalid domain: ${domainError}; falling back to 0–100 step 1`);
      warned = true;
    }
  }, [domainError]);
  const interval = variant === "interval";
  const gap = Math.max(0, minGap);

  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = React.useState<Pair>(() => toPair(defaultValue, domain, interval));
  const committed = React.useMemo(() => (isControlled ? toPair(valueProp, domain, interval) : internal), [isControlled, valueProp, domain, interval, internal]);
  const [preview, setPreview] = React.useState<Pair | null>(null);
  const shown = preview ?? committed;

  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const inert = disabled || readOnly;

  /* decorative bow: motion value in px, sprung back to 0 on release */
  const bow = useMotionValue(0);
  const bowSpring = useSpring(bow, { stiffness: 420, damping: 26 });
  const bowPath = useTransform(bowSpring, (b) => `M 0 4 Q 50 ${4 + b} 100 4`);
  const squash = useTransform(bowSpring, (b) => 1 - Math.min(0.08, Math.abs(b) / maxStretch) * 0.08 * 12.5);

  /* a parent revision during a drag cancels the preview (C41-T05) */
  const committedKey = committed.join(",");
  const dragRef = React.useRef<{ thumb: "lower" | "upper"; pointerId: number } | null>(null);
  React.useEffect(() => {
    if (dragRef.current) {
      dragRef.current = null;
      setPreview(null);
      bow.set(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedKey]);

  const emit = (next: Pair, meta: ElasticRangeMeta) => {
    const out: ElasticRangeValue = interval ? next : next[0];
    if (!isControlled) setInternal(next);
    onValueCommit?.(out, meta);
  };
  const emitPreview = (next: Pair, meta: ElasticRangeMeta) => {
    setPreview(next);
    onValuePreview?.(interval ? next : next[0], meta);
  };

  /* geometry */
  const trackRef = React.useRef<HTMLDivElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);
  const frac = (v: number) => (v - domain.min) / (domain.max - domain.min);
  const valueAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
    return { value: quantize(domain.min + f * (domain.max - domain.min), domain), overshoot: (clientX - r.left) / Math.max(1, r.width) };
  };

  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setCompact(el.clientWidth < 240));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nearestThumb = (v: number): "lower" | "upper" => {
    if (!interval) return "lower";
    const dl = Math.abs(v - shown[0]);
    const du = Math.abs(v - shown[1]);
    return dl <= du ? "lower" : "upper"; // tie → lower (C41-T03)
  };

  const applyThumb = (pair: Pair, thumb: "lower" | "upper", v: number): Pair => {
    if (!interval) return [v, v];
    const next: Pair = thumb === "lower" ? [v, pair[1]] : [pair[0], v];
    return enforceGap(next, thumb, gap, domain);
  };

  /* pointer */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inert || dragRef.current || e.button !== 0) return;
    const { value } = valueAt(e.clientX);
    const thumb = nearestThumb(value);
    dragRef.current = { thumb, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    emitPreview(applyThumb(shown, thumb, value), { source: "pointer", thumb });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { value, overshoot } = valueAt(e.clientX);
    emitPreview(applyThumb(preview ?? committed, drag.thumb, value), { source: "pointer", thumb: drag.thumb });
    if (mode === "full" && variant !== "precision") {
      const over = overshoot < 0 ? overshoot : overshoot > 1 ? overshoot - 1 : 0;
      const r = trackRef.current?.getBoundingClientRect();
      const px = over * (r?.width ?? 0);
      bow.set(Math.sign(px) * Math.min(maxStretch, Math.abs(px) * elasticity));
    }
  };
  const finish = (e: React.PointerEvent<HTMLDivElement>, cancel: boolean) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    bow.set(0);
    const final = preview;
    setPreview(null);
    if (!cancel && final) emit(final, { source: "pointer", thumb: drag.thumb }); // one commit per release (C41-T04)
  };

  /* keyboard on a thumb */
  const onThumbKeyDown = (thumb: "lower" | "upper") => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (inert) return;
    const cur = thumb === "lower" ? committed[0] : committed[1];
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = stepBy(cur, 1, domain);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = stepBy(cur, -1, domain);
    else if (e.key === "PageUp") next = stepBy(cur, 10, domain);
    else if (e.key === "PageDown") next = stepBy(cur, -10, domain);
    else if (e.key === "Home") next = domain.min;
    else if (e.key === "End") next = domain.max;
    else if (e.key === "Escape" && dragRef.current) {
      dragRef.current = null;
      setPreview(null);
      bow.set(0);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    emit(applyThumb(committed, thumb, next), { source: "keyboard", thumb });
  };

  const stepButton = (thumb: "lower" | "upper", dir: 1 | -1) => () => {
    if (inert) return;
    const cur = thumb === "lower" ? committed[0] : committed[1];
    emit(applyThumb(committed, thumb, stepBy(cur, dir, domain)), { source: "button", thumb });
  };

  const fmt = (v: number) => formatDomainValue(v, domain, formatValue);
  const thumbs: ("lower" | "upper")[] = interval ? ["lower", "upper"] : ["lower"];
  const thumbName = (t: "lower" | "upper") => (interval ? (t === "lower" ? (labels.lower ?? "Lower bound") : (labels.upper ?? "Upper bound")) : labels.label);
  const uid = React.useId();

  return (
    <div
      ref={rootRef}
      data-slot="elastic-range"
      data-variant={variant}
      data-motion={mode}
      data-compact={compact || undefined}
      data-previewing={preview ? "true" : undefined}
      role={interval ? "group" : undefined}
      aria-label={interval ? labels.label : undefined}
      className={cn("relative flex w-full flex-col gap-2 text-[var(--cui-range-text,#141311)]", disabled && "opacity-50", className)}
      {...rest}
    >
      <div className={cn("flex items-center gap-3", compact && "flex-col items-stretch gap-2")}>
        {/* track + thumbs */}
        <div
          ref={trackRef}
          className={cn("relative h-11 min-w-0 flex-1 select-none touch-none", inert ? "cursor-default" : "cursor-pointer")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finish(e, false)}
          onPointerCancel={(e) => finish(e, true)}
          onLostPointerCapture={(e) => finish(e, true)}
        >
          {/* bowing track (decorative) */}
          <svg aria-hidden className="absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2 overflow-visible" viewBox="0 0 100 8" preserveAspectRatio="none">
            <m.path d={bowPath} fill="none" stroke="var(--cui-range-track, rgba(20,19,17,0.15))" strokeWidth={variant === "precision" ? 4 : 6} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          </svg>
          {/* active segment */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--cui-range-fill,#141311)]"
            style={{
              left: `${(interval ? frac(shown[0]) : 0) * 100}%`,
              width: `${((interval ? frac(shown[1]) : frac(shown[0])) - (interval ? frac(shown[0]) : 0)) * 100}%`,
            }}
          />
          {variant === "precision" && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 [background:repeating-linear-gradient(90deg,var(--cui-range-tick,rgba(20,19,17,0.25))_0_1px,transparent_1px_10%)]" />
          )}
          {thumbs.map((t) => {
            const v = t === "lower" ? shown[0] : shown[1];
            return (
              <m.div
                key={t}
                role="slider"
                id={`${uid}-${t}`}
                tabIndex={disabled ? -1 : 0}
                aria-label={thumbName(t)}
                aria-valuemin={domain.min}
                aria-valuemax={domain.max}
                aria-valuenow={v}
                aria-valuetext={fmt(v)}
                aria-disabled={inert || undefined}
                aria-orientation="horizontal"
                data-thumb={t}
                onKeyDown={onThumbKeyDown(t)}
                className={cn(
                  "absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--cui-range-thumb,#faf9f6)] shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_0_1.5px_var(--cui-range-fill,#141311)] outline-none",
                  "focus-visible:ring-4 focus-visible:ring-[var(--cui-range-focus,rgba(20,19,17,0.25))]",
                )}
                style={{ left: `${frac(v) * 100}%`, scaleX: mode === "full" && variant !== "precision" ? squash : 1 }}
              />
            );
          })}
        </div>

        {/* non-drag alternatives */}
        {(showInput || showStepButtons) && (
          <div className={cn("flex shrink-0 items-center gap-1", compact && "justify-between")}>
            {thumbs.map((t) => (
              <NumberEntry
                key={t}
                id={`${uid}-input-${t}`}
                label={`${thumbName(t)} value`}
                value={t === "lower" ? committed[0] : committed[1]}
                domain={domain}
                format={fmt}
                disabled={inert}
                showInput={showInput}
                showButtons={showStepButtons}
                onStep={stepButton(t, 1)}
                onStepDown={stepButton(t, -1)}
                onCommit={(n) => emit(applyThumb(committed, t, quantize(n, domain)), { source: "input", thumb: t })}
              />
            ))}
          </div>
        )}
      </div>

      {/* min / max labels */}
      <div aria-hidden className="flex justify-between font-mono text-[11px] text-[var(--cui-range-muted,rgba(20,19,17,0.5))]">
        <span>{fmt(domain.min)}</span>
        <span>{fmt(domain.max)}</span>
      </div>

      {/* form serialisation */}
      {name &&
        (interval ? (
          <>
            <input type="hidden" name={`${name}.lower`} value={committed[0]} disabled={disabled} />
            <input type="hidden" name={`${name}.upper`} value={committed[1]} disabled={disabled} />
          </>
        ) : (
          <input type="hidden" name={name} value={committed[0]} disabled={disabled} />
        ))}
    </div>
  );
});
ElasticRange.displayName = "ElasticRange";

function NumberEntry({
  id,
  label,
  value,
  domain,
  format,
  disabled,
  showInput,
  showButtons,
  onStep,
  onStepDown,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  domain: Domain;
  format: (v: number) => string;
  disabled: boolean;
  showInput: boolean;
  showButtons: boolean;
  onStep: () => void;
  onStepDown: () => void;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = React.useState(() => format(value));
  const [invalid, setInvalid] = React.useState(false);
  const [synced, setSynced] = React.useState(value);
  // sync the field when the committed value changes externally
  if (synced !== value) {
    setSynced(value);
    setText(format(value));
    setInvalid(false);
  }
  const commit = () => {
    const n = parseNumber(text);
    if (n === null) {
      setInvalid(true); // keep the prior committed value (C42-T07 style)
      return;
    }
    setInvalid(false);
    onCommit(n);
    setText(format(quantize(n, domain)));
  };
  const btn = "inline-flex size-8 items-center justify-center rounded-md border border-[var(--cui-range-border,rgba(20,19,17,0.2))] text-base leading-none outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-range-fill,#141311)] disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      {showButtons && (
        <button type="button" className={btn} aria-label={`Decrease ${label}`} onClick={onStepDown} disabled={disabled}>
          −
        </button>
      )}
      {showInput && (
        <input
          id={id}
          type="text"
          inputMode="decimal"
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className={cn(
            "h-8 w-16 rounded-md border bg-[var(--cui-range-input,#faf9f6)] px-2 text-center font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-range-fill,#141311)]",
            invalid ? "border-[var(--cui-range-error,#c8360d)]" : "border-[var(--cui-range-border,rgba(20,19,17,0.2))]",
          )}
        />
      )}
      {showButtons && (
        <button type="button" className={btn} aria-label={`Increase ${label}`} onClick={onStep} disabled={disabled}>
          +
        </button>
      )}
    </div>
  );
}
