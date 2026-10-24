"use client";

import * as React from "react";
import { motion as m } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type GhostTraceTrigger = "inView" | "mount" | "manual";
export type GhostTraceMotion = "auto" | "reduced" | "off";
export type GhostTraceState = "idle" | "tracing" | "settled";

export interface GhostTraceTextProps extends Omit<React.HTMLAttributes<HTMLElement>, "children" | "onAnimationStart" | "onAnimationEnd"> {
  /** The headline. A string (use `\n` for line breaks) or an array of lines. */
  children: string | string[];
  /** Semantic element. */
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
  /** When the trace starts. `manual` plays when `play` becomes true. */
  trigger?: GhostTraceTrigger;
  /** For `trigger="manual"`: set true to play (reset to false, then true, to replay). */
  play?: boolean;
  /** Seconds the ghost stroke takes to trace one line. */
  duration?: number;
  /** Seconds between lines. */
  stagger?: number;
  /** Seconds before the first line starts. */
  delay?: number;
  /** Ghost stroke width in px (at the rendered font size). */
  strokeWidth?: number;
  /** Ghost stroke colour. Defaults to `currentColor`. */
  ghost?: string;
  /** Final fill colour. Defaults to `currentColor`. */
  fill?: string;
  /** Keep the stroke visible after settling (outline-and-fill look). */
  keepStroke?: boolean;
  /** Re-run the trace each time the element re-enters the viewport. */
  repeat?: boolean;
  /** `auto` follows prefers-reduced-motion; `reduced` and `off` render the plain, filled headline. */
  motion?: GhostTraceMotion;
  onTraceStart?: () => void;
  onTraceComplete?: () => void;
}

interface Metrics {
  width: number;
  ascent: number;
  descent: number;
}

/**
 * GhostTraceText — a headline traced by a ghost stroke before it settles.
 *
 * The real text lives in the semantic element (visually hidden while the SVG
 * is shown) so the accessible name, selection and SEO are unchanged. The SVG
 * is decorative: one `<text>` per line, with a dash-offset animation that
 * runs a stroke along the glyph outlines, then the fill rises and the stroke
 * fades. Under reduced motion the plain headline renders instead.
 */
export const GhostTraceText = React.forwardRef<HTMLElement, GhostTraceTextProps>(function GhostTraceText(
  {
    children,
    as = "h2",
    trigger = "inView",
    play = false,
    duration = 1.6,
    stagger = 0.35,
    delay = 0,
    strokeWidth = 1,
    ghost = "currentColor",
    fill = "currentColor",
    keepStroke = false,
    repeat = false,
    motion = "auto",
    onTraceStart,
    onTraceComplete,
    className,
    style,
    ...rest
  },
  ref,
) {
  const lines = React.useMemo(
    () => (Array.isArray(children) ? children : String(children).split("\n")).map((l) => l.trim()).filter(Boolean),
    [children],
  );
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" =
    motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  const hostRef = React.useRef<HTMLElement>(null);
  React.useImperativeHandle(ref, () => hostRef.current as HTMLElement);
  const textRefs = React.useRef<(SVGTextElement | null)[]>([]);
  const [metrics, setMetrics] = React.useState<Metrics[] | null>(null);
  const [fontSize, setFontSize] = React.useState(48);
  const [state, setState] = React.useState<GhostTraceState>("idle");
  const [cycle, setCycle] = React.useState(0);
  const completed = React.useRef(0);
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  /* ── measure the rendered glyph runs (after fonts load) ── */
  React.useEffect(() => {
    if (mode !== "full") return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const fs = parseFloat(getComputedStyle(host).fontSize) || 48;
      setFontSize(fs);
      const next = textRefs.current.slice(0, lines.length).map((el) => {
        if (!el || typeof el.getBBox !== "function") return null;
        try {
          const b = el.getBBox();
          if (b.width <= 0) return null;
          return { width: b.width, ascent: -b.y, descent: b.height + b.y };
        } catch {
          return null;
        }
      });
      if (next.every((x) => x)) setMetrics(next as Metrics[]);
    };
    measure();
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    fonts?.ready.then(measure).catch(() => {});
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(host);
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [lines, mode]);

  /* ── trigger ── */
  const start = React.useCallback(() => {
    completed.current = 0;
    setCycle((c) => c + 1);
    setState("tracing");
    onTraceStart?.();
  }, [onTraceStart]);

  React.useEffect(() => {
    if (mode !== "full") return;
    if (trigger === "mount") {
      start();
      return;
    }
    if (trigger === "manual") {
      if (play) start();
      else setState("idle");
      return;
    }
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      start();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (e.isIntersecting) {
          start();
          if (!repeat) io.disconnect();
        } else if (repeat) {
          setState("idle");
        }
      },
      { threshold: 0.35 },
    );
    io.observe(host);
    return () => io.disconnect();
  }, [mode, trigger, play, repeat, start]);

  const handleLineComplete = () => {
    completed.current += 1;
    if (completed.current >= lines.length) {
      setState("settled");
      onTraceComplete?.();
    }
  };

  const Tag = as;

  if (mode !== "full") {
    return (
      <Tag ref={hostRef as React.Ref<HTMLHeadingElement>} data-slot="ghost-trace-text" data-motion={mode} data-state="settled" className={className} style={style} {...rest}>
        {lines.map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <>
                {" "}
                <br />
              </>
            )}
            {l}
          </React.Fragment>
        ))}
      </Tag>
    );
  }

  /* ── geometry (estimates until measured) ── */
  const est = (l: string) => ({ width: l.length * fontSize * 0.56, ascent: fontSize * 0.8, descent: fontSize * 0.24 });
  const rows = lines.map((l, i) => metrics?.[i] ?? est(l));
  const lineHeight = fontSize * 1.08;
  const width = Math.max(1, ...rows.map((r) => r.width + strokeWidth * 2));
  const height = Math.max(1, lineHeight * (rows.length - 1) + (rows[0]?.ascent ?? 0) + (rows[rows.length - 1]?.descent ?? 0) + strokeWidth * 2);
  const tracing = state === "tracing";

  return (
    <Tag
      ref={hostRef as React.Ref<HTMLHeadingElement>}
      data-slot="ghost-trace-text"
      data-motion={mode}
      data-state={state}
      className={cn("relative block", className)}
      style={style}
      {...rest}
    >
      <span className="sr-only">{lines.join(" ")}</span>
      <svg
        aria-hidden
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ display: "block", height: "auto", overflow: "visible", font: "inherit", maxWidth: width }}
      >
        {lines.map((line, i) => {
          const dash = Math.max(200, line.length * fontSize * 2.4);
          const y = strokeWidth + (rows[0]?.ascent ?? 0) + i * lineHeight;
          const row = rows[i]!;
          const lineDelay = delay + i * stagger;
          const clipId = `${uid}-${i}`;
          const ease: [number, number, number, number] = [0.3, 0, 0.2, 1];
          const ghostTarget =
            tracing || state === "settled"
              ? { strokeDashoffset: 0, strokeOpacity: keepStroke ? 1 : 0 }
              : { strokeDashoffset: dash, strokeOpacity: 0 };
          const fillTarget = tracing || state === "settled" ? { fillOpacity: 1 } : { fillOpacity: 0 };
          const sweepTarget = tracing || state === "settled" ? { width: row.width + strokeWidth * 4 } : { width: 0 };
          const slow = { duration: 0 };
          return (
            <React.Fragment key={`${cycle}-${i}`}>
              <clipPath id={clipId}>
                <m.rect
                  x={0}
                  y={y - row.ascent - strokeWidth * 2}
                  height={row.ascent + row.descent + strokeWidth * 4}
                  initial={tracing ? { width: 0 } : false}
                  animate={sweepTarget}
                  transition={tracing ? { duration, delay: lineDelay, ease } : slow}
                />
              </clipPath>
              {/* fill layer */}
              <m.text
                ref={(el) => {
                  textRefs.current[i] = el;
                }}
                data-layer="fill"
                x={strokeWidth}
                y={y}
                fill={fill}
                stroke="none"
                style={{ font: "inherit" }}
                initial={tracing ? { fillOpacity: 0 } : false}
                animate={fillTarget}
                transition={tracing ? { duration: duration * 0.5, delay: lineDelay + duration * 0.55, ease: "easeOut" } : slow}
                onAnimationComplete={tracing && i === lines.length - 1 ? handleLineComplete : undefined}
              >
                {line}
              </m.text>
              {/* ghost layer: dash trace inside a left-to-right sweep */}
              <g clipPath={`url(#${clipId})`}>
                <m.text
                  data-layer="ghost"
                  x={strokeWidth}
                  y={y}
                  fill="none"
                  stroke={ghost}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{ font: "inherit", strokeDasharray: dash }}
                  initial={tracing ? { strokeDashoffset: dash, strokeOpacity: 1 } : false}
                  animate={ghostTarget}
                  transition={
                    tracing
                      ? {
                          strokeDashoffset: { duration, delay: lineDelay, ease },
                          strokeOpacity: { duration: duration * 0.45, delay: lineDelay + duration * 0.75, ease: "easeOut" },
                        }
                      : slow
                  }
                >
                  {line}
                </m.text>
              </g>
            </React.Fragment>
          );
        })}
      </svg>
    </Tag>
  );
});

GhostTraceText.displayName = "GhostTraceText";
