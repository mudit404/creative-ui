"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { glyphIndex, gridSize, responsiveColumns, sampleCells, validateRamp, type CellSample } from "@/lib/ascii-grid";

export type AsciiSource = { kind: "image"; src: string; alt: string } | { kind: "video"; src: string; poster?: string; description: string; muted?: boolean; loop?: boolean };

export interface AsciiMediaHandle {
  root: HTMLDivElement | null;
  /** The native image or video element (timeline authority). */
  media: HTMLImageElement | HTMLVideoElement | null;
}

/** Reads a cols×rows RGBA frame from the media. The default draws into a small canvas. */
export type FrameSampler = (media: HTMLImageElement | HTMLVideoElement, cols: number, rows: number) => { data: Uint8ClampedArray; width: number; height: number } | null;

export interface AsciiMediaProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "onError"> {
  source: AsciiSource;
  /** Desktop column count. */
  columns?: number;
  /** Column count below `narrowBreakpoint`. */
  narrowColumns?: number;
  narrowBreakpoint?: number;
  glyphRamp?: string;
  colorMode?: "mono" | "source-color";
  invert?: boolean;
  maxFps?: number;
  showOriginal?: boolean;
  defaultShowOriginal?: boolean;
  onShowOriginalChange?: (show: boolean) => void;
  onReady?: (info: { cols: number; rows: number }) => void;
  onError?: (error: { reason: "media" | "font" | "origin" | "renderer"; message: string }) => void;
  /** Fixed-cell font; falls back to monospace when it cannot load. */
  fontFamily?: string;
  /** Inject a frame sampler (tests, custom pipelines). */
  sampler?: FrameSampler;
  /** Hover reveals the original (decorative; the button always exists). */
  hoverReveal?: boolean;
  variant?: "mono" | "source-color" | "poster";
  label?: string;
  motion?: "auto" | "reduced" | "off";
  quality?: "auto" | "high" | "balanced" | "low";
}

const DEFAULT_RAMP = " .:-=+*#%@";

const canvasSampler: FrameSampler = (media, cols, rows) => {
  const c = document.createElement("canvas");
  c.width = cols;
  c.height = rows;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(media, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows); // throws SecurityError on tainted media
  c.width = 0;
  return { data: data.data, width: cols, height: rows };
};

/**
 * AsciiMedia — a supplied image or video rendered as a calibrated glyph grid,
 * with the original media always one button away.
 *
 * The native image/video is the timeline authority and the accessible
 * representation; the glyph canvas is aria-hidden decoration. Luminance is
 * sampled once per frame into cols×rows cells; glyphs come from a measured
 * ramp drawn through a pre-rendered atlas. Video sampling follows presented
 * frames up to `maxFps` and stops while paused or hidden. Cross-origin and
 * font failures fall back to the original with a reason.
 */
export const AsciiMedia = React.forwardRef<AsciiMediaHandle, AsciiMediaProps>(function AsciiMedia(
  {
    source,
    columns = 96,
    narrowColumns = 48,
    narrowBreakpoint = 640,
    glyphRamp = DEFAULT_RAMP,
    colorMode,
    invert = false,
    maxFps = 24,
    showOriginal: showProp,
    defaultShowOriginal = false,
    onShowOriginalChange,
    onReady,
    onError,
    fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace",
    sampler = canvasSampler,
    hoverReveal = false,
    variant = "mono",
    label = "ASCII media",
    motion = "auto",
    quality = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const mono = (colorMode ?? (variant === "source-color" ? "source-color" : "mono")) === "mono";
  const rampError = validateRamp(glyphRamp);
  const ramp = rampError ? DEFAULT_RAMP : glyphRamp;
  const videoBlocked = source.kind === "video" && mode === "reduced"; // reduced motion: poster/native player (C55-T09)

  /* original toggle (never resets playback: the same element stays mounted, C55-T04) */
  const [internalShow, setInternalShow] = React.useState(defaultShowOriginal);
  const showOriginal = showProp ?? internalShow;
  const setShow = (v: boolean) => {
    if (showProp === undefined) setInternalShow(v);
    onShowOriginalChange?.(v);
  };

  /* state */
  const [state, setState] = React.useState<"original" | "preparing" | "ascii" | "error">("original");
  const [error, setError] = React.useState<string | null>(null);
  const [width, setWidth] = React.useState(0);
  const [mediaSize, setMediaSize] = React.useState<{ w: number; h: number } | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const mediaRef = React.useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const atlasRef = React.useRef<{ key: string; canvas: HTMLCanvasElement; cell: number; cellH: number } | null>(null);
  const generation = React.useRef(0);
  const latest = React.useRef({ onReady, onError, sampler, ramp, mono, invert, maxFps });
  React.useEffect(() => {
    latest.current = { onReady, onError, sampler, ramp, mono, invert, maxFps };
  });
  const sourceKey = `${source.kind}:${source.src}`;

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // a new source invalidates old callbacks (C55-T07)
  const [seenSource, setSeenSource] = React.useState(sourceKey);
  if (seenSource !== sourceKey) {
    setSeenSource(sourceKey);
    setState("original");
    setError(null);
    setMediaSize(null);
    generation.current++;
  }

  const cols = responsiveColumns(width, columns, narrowColumns, narrowBreakpoint);
  const grid = React.useMemo(() => (mediaSize ? gridSize(mediaSize.w, mediaSize.h, cols, 0.6) : null), [mediaSize, cols]);

  /* draw one frame */
  const draw = React.useCallback(
    (sample: CellSample, g: { cols: number; rows: number }) => {
      /* glyph atlas: one canvas per font/size/ramp, never per frame */
      const atlasFor = (cell: number, cellH: number, color: string): HTMLCanvasElement | null => {
        const r0 = latest.current.ramp;
        const key = `${fontFamily}|${cell}|${cellH}|${r0}|${color}`;
        if (atlasRef.current?.key === key) return atlasRef.current.canvas;
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.ceil(cell) * r0.length);
        c.height = Math.max(1, Math.ceil(cellH));
        const actx = c.getContext("2d");
        if (!actx) return null;
        actx.font = `${Math.round(cellH * 0.9)}px ${fontFamily}`;
        actx.textBaseline = "middle";
        actx.textAlign = "center";
        actx.fillStyle = color; // tinted once per atlas; no per-frame compositing
        [...r0].forEach((g2, i) => actx.fillText(g2, i * cell + cell / 2, cellH / 2));
        atlasRef.current = { key, canvas: c, cell, cellH };
        return c;
      };
      const canvas = canvasRef.current;
      const root = rootRef.current;
      if (!canvas || !root) return;
      const dpr = Math.min(quality === "high" ? 2 : quality === "low" ? 1 : 1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
      const cell = (root.clientWidth || 640) / g.cols;
      const cellH = cell / 0.6;
      const w = Math.round(g.cols * cell * dpr);
      const h = Math.round(g.rows * cellH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = getComputedStyle(root).getPropertyValue("--cui-ascii-background").trim() || "#141311";
      const fg = getComputedStyle(root).getPropertyValue("--cui-ascii-foreground").trim() || "#faf9f6";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, g.cols * cell, g.rows * cellH);
      const atlas = atlasFor(cell * dpr, cellH * dpr, fg);
      const r = latest.current.ramp;
      for (let y = 0; y < g.rows; y++) {
        for (let x = 0; x < g.cols; x++) {
          const i = y * g.cols + x;
          const gi = glyphIndex(sample.luminance[i]!, r.length, latest.current.invert);
          if (gi === 0 && r[0] === " ") continue;
          if (latest.current.mono) {
            if (atlas) ctx.drawImage(atlas, gi * cell * dpr, 0, cell * dpr, cellH * dpr, x * cell, y * cellH, cell, cellH);
          } else {
            // source colour: tint via the atlas glyph as a mask (draw, then multiply)
            ctx.fillStyle = `rgb(${sample.color[i * 3]}, ${sample.color[i * 3 + 1]}, ${sample.color[i * 3 + 2]})`;
            ctx.font = `${Math.round(cellH * 0.9)}px ${fontFamily}`;
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText(r[gi]!, x * cell + cell / 2, y * cellH + cellH / 2);
          }
        }
      }
    },
    [fontFamily, quality],
  );

  /* media readiness */
  const onMediaReady = () => {
    const m = mediaRef.current;
    if (!m) return;
    const w = m instanceof HTMLVideoElement ? m.videoWidth : m.naturalWidth;
    const h = m instanceof HTMLVideoElement ? m.videoHeight : m.naturalHeight;
    if (!w || !h) return;
    setMediaSize({ w, h });
  };
  // media that finished loading before hydration (cached, data: URLs) never fires load again
  React.useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    if (m instanceof HTMLImageElement ? m.complete && m.naturalWidth > 0 : m.readyState >= 1 && m.videoWidth > 0) onMediaReady();
  }, [sourceKey]);
  const onMediaError = () => {
    setState("error");
    setError("The media could not be loaded; nothing to convert.");
    latest.current.onError?.({ reason: "media", message: "media failed to load" });
  };

  /* convert once ready (static) or per presented frame (video) */
  const frameLoop = React.useRef<{ stop: () => void } | null>(null);
  React.useEffect(() => {
    frameLoop.current?.stop();
    frameLoop.current = null;
    const m = mediaRef.current;
    if (!m || !grid || videoBlocked || variant === "poster" && source.kind === "video") return;
    const gen = generation.current;
    setState("preparing");
    let fontReady: Promise<unknown> = Promise.resolve();
    if (typeof document !== "undefined" && "fonts" in document && fontFamily !== "ui-monospace, SFMono-Regular, Menlo, monospace") {
      fontReady = document.fonts.load(`16px ${fontFamily.split(",")[0]!.trim()}`).then((faces) => {
        if (!faces.length) latest.current.onError?.({ reason: "font", message: `Font "${fontFamily}" did not load; using a monospace fallback.` });
      });
    }
    let stopped = false;
    const convert = (): boolean => {
      if (stopped || generation.current !== gen) return false;
      try {
        const frame = latest.current.sampler(m, grid.cols, grid.rows);
        if (!frame) throw new Error("renderer");
        draw(sampleCells(frame), grid);
        return true;
      } catch (e) {
        stopped = true;
        const err = e as { name?: string; message?: string } | null;
        const tainted = err?.name === "SecurityError"; // DOMException is not an Error subclass in every realm
        setState("error");
        setError(tainted ? "The media is cross-origin and its pixels cannot be read; showing the original." : "Conversion is unavailable here; showing the original.");
        latest.current.onError?.({ reason: tainted ? "origin" : "renderer", message: typeof err?.message === "string" && err.message ? err.message : "conversion failed" });
        return false;
      }
    };
    void fontReady.then(() => {
      if (stopped || generation.current !== gen) return;
      if (!convert()) return;
      setState("ascii");
      latest.current.onReady?.({ cols: grid.cols, rows: grid.rows });
      if (!(m instanceof HTMLVideoElement)) return;
      // video: follow presented frames, capped, only while playing and visible (C55-T03)
      const v = m as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (id: number) => void };
      let last = 0;
      let handle = 0;
      let raf = 0;
      const minGap = 1000 / Math.max(1, latest.current.maxFps);
      const tick = () => {
        if (stopped) return;
        const now = performance.now();
        if (!v.paused && !v.ended && !document.hidden && now - last >= minGap) {
          last = now;
          if (!convert()) return;
        }
        if (typeof v.requestVideoFrameCallback === "function") handle = v.requestVideoFrameCallback(tick);
        else if (!v.paused && !v.ended) raf = requestAnimationFrame(tick);
      };
      const onPlay = () => {
        if (typeof v.requestVideoFrameCallback !== "function" && !raf) raf = requestAnimationFrame(tick);
      };
      v.addEventListener("play", onPlay);
      v.addEventListener("seeked", convert);
      tick();
      frameLoop.current = {
        stop: () => {
          stopped = true;
          v.removeEventListener("play", onPlay);
          v.removeEventListener("seeked", convert);
          if (handle && typeof v.cancelVideoFrameCallback === "function") v.cancelVideoFrameCallback(handle);
          if (raf) cancelAnimationFrame(raf);
        },
      };
    });
    return () => {
      stopped = true;
      frameLoop.current?.stop();
      frameLoop.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid?.cols, grid?.rows, sourceKey, fontFamily, ramp, mono, invert, videoBlocked, variant, draw]);
  React.useEffect(
    () => () => {
      atlasRef.current = null; // atlases released with the instance (C55-T10)
    },
    [],
  );

  React.useImperativeHandle(ref, () => ({ root: rootRef.current, media: mediaRef.current }));
  const uid = React.useId();
  const asciiVisible = state === "ascii" && !showOriginal && !videoBlocked;
  const aspect = mediaSize ? `${mediaSize.w} / ${mediaSize.h}` : "16 / 9";

  return (
    <div
      ref={rootRef}
      data-slot="ascii-media"
      data-variant={variant}
      data-motion={mode}
      data-state={state}
      data-showing={asciiVisible ? "ascii" : "original"}
      data-cols={grid?.cols}
      data-rows={grid?.rows}
      role="group"
      aria-label={label}
      className={cn("flex w-full flex-col gap-2 text-[var(--cui-ascii-control,#141311)]", className)}
      {...rest}
    >
      <div className="relative w-full overflow-hidden rounded-2xl bg-[var(--cui-ascii-background,#141311)]" style={{ aspectRatio: aspect }} data-stage onPointerEnter={hoverReveal ? () => setShow(true) : undefined} onPointerLeave={hoverReveal ? () => setShow(false) : undefined}>
        {source.kind === "image" ? (
          <img ref={(el) => { mediaRef.current = el; }} src={source.src} alt={source.alt} crossOrigin="anonymous" onLoad={onMediaReady} onError={onMediaError} className={cn("absolute inset-0 size-full object-contain", asciiVisible && "opacity-0")} />
        ) : (
          <video
            ref={(el) => { mediaRef.current = el; }}
            src={source.src}
            poster={source.poster}
            aria-label={source.description}
            crossOrigin="anonymous"
            controls
            playsInline
            muted={source.muted ?? true}
            loop={source.loop}
            onLoadedMetadata={onMediaReady}
            onError={onMediaError}
            className={cn("absolute inset-0 size-full object-contain", asciiVisible && "opacity-0")}
          />
        )}
        {/* thousands of glyphs live on one aria-hidden canvas, never in the accessibility tree (C55-T06) */}
        <canvas ref={canvasRef} aria-hidden className={cn("pointer-events-none absolute inset-0 size-full", !asciiVisible && "hidden")} data-glyphs />
        {state === "preparing" && <div className="absolute inset-x-0 bottom-2 text-center text-[11px] text-white/80">Preparing glyphs…</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <button type="button" aria-pressed={showOriginal} onClick={() => setShow(!showOriginal)} disabled={state === "error" || videoBlocked} className="inline-flex h-7 items-center rounded-full border border-[var(--cui-ascii-control,rgba(20,19,17,0.25))] px-2.5 outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-ascii-control,#141311)] disabled:opacity-40">
          {showOriginal ? "Show ASCII" : "Show original"}
        </button>
        <span id={`${uid}-status`} role="status" className={cn(error ? "text-[var(--cui-ascii-error,#c8360d)]" : "opacity-70")}>
          {error ?? (videoBlocked ? "Reduced motion: showing the native player." : grid && state === "ascii" ? `${grid.cols}×${grid.rows} cells` : state === "preparing" ? "Preparing…" : "")}
          {rampError ? ` ${rampError}; using the default ramp.` : ""}
        </span>
      </div>
    </div>
  );
});
AsciiMedia.displayName = "AsciiMedia";
