"use client";

import * as React from "react";
import { BufferAttribute, BufferGeometry, Color, Points, PointsMaterial } from "three";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { curveOffsets, evaluateMorph, resamplePoints, sampleMask, type PreparedTarget } from "@/lib/point-targets";
import { createStage, type Stage } from "@/lib/three-stage";

export type { PreparedTarget } from "@/lib/point-targets";

export type MorphTarget =
  | { id: string; label: string; type: "image"; src: string; fallback: string }
  | { id: string; label: string; type: "points"; points: ArrayLike<number>; colors?: ArrayLike<number>; fallback: string };

export type MaskDecoder = (src: string, signal: AbortSignal) => Promise<{ data: Uint8ClampedArray; width: number; height: number }>;

export interface ParticleMorphHandle {
  root: HTMLDivElement | null;
  requestTarget: (id: string) => void;
  focusControls: () => void;
  /** Diagnostic: the currently rendered positions (shared buffer; do not mutate). */
  getPositions: () => Float32Array | null;
}

export interface ParticleMorphProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  targets: readonly MorphTarget[];
  targetId?: string;
  defaultTargetId?: string;
  pointCount?: number;
  duration?: number;
  /** Mid-flight volume expansion as a fraction. */
  spread?: number;
  seed?: number;
  colorMode?: "source" | "theme";
  /** Theme accent used by colorMode="theme" (also --cui-particle-color). */
  themeColor?: string;
  onTargetRequest?: (id: string) => void;
  onTargetReady?: (id: string) => void;
  onTargetError?: (id: string, message: string) => void;
  onMorphComplete?: (id: string, revision: number) => void;
  quality?: "auto" | "high" | "balanced" | "low";
  /** Inject a mask decoder (tests, workers). */
  decoder?: MaskDecoder;
  /** Show target buttons under the stage. */
  showControls?: boolean;
  variant?: "silhouette" | "volume" | "minimal";
  label?: string;
  motion?: "auto" | "reduced" | "off";
  durationScale?: number;
  renderer?: "auto" | "none";
}

const BUDGET = { high: 24_000, balanced: 12_000, low: 4_000 } as const;

export const browserMaskDecoder: MaskDecoder = (src, signal) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("Canvas 2D unavailable"));
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(ctx.getImageData(0, 0, w, h));
      } catch {
        reject(new Error("The image is cross-origin and cannot be read."));
      } finally {
        c.width = 0;
      }
    };
    img.onerror = () => reject(new Error(`The image could not be loaded: ${src}`));
    img.src = src;
  });

/**
 * ParticleMorph — a point cloud that re-forms from one authored emblem into
 * another without losing the target's identity.
 *
 * The active target's fallback image and label render first and stay until
 * the points are genuinely ready. Targets are sampled deterministically
 * (seeded, Morton-ordered) into fixed-length buffers; a morph interpolates
 * analytically from the current positions, so a new request mid-flight
 * continues from where the points are. Reduced motion swaps instantly.
 */
export const ParticleMorph = React.forwardRef<ParticleMorphHandle, ParticleMorphProps>(function ParticleMorph(
  {
    targets,
    targetId: targetProp,
    defaultTargetId,
    pointCount,
    duration = 900,
    spread = 0.12,
    seed = 1,
    colorMode = "theme",
    themeColor = "#141311",
    onTargetRequest,
    onTargetReady,
    onTargetError,
    onMorphComplete,
    quality = "auto",
    decoder = browserMaskDecoder,
    showControls = true,
    variant = "silhouette",
    label = "Emblem",
    motion = "auto",
    durationScale = 1,
    renderer = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const full = mode === "full";
  const count = Math.max(100, Math.floor(pointCount ?? (quality === "high" ? BUDGET.high : quality === "low" ? BUDGET.low : BUDGET.balanced)));

  /* selection */
  const [internal, setInternal] = React.useState<string>(defaultTargetId ?? targets[0]?.id ?? "");
  const requested = targetProp ?? internal;
  const target = targets.find((t) => t.id === requested) ?? targets[0] ?? null;
  const request = (id: string) => {
    if (targetProp === undefined) setInternal(id);
    onTargetRequest?.(id);
  };

  /* preparation cache keyed by id + count + seed (C54-T07: one count per instance) */
  const prepared = React.useRef(new Map<string, PreparedTarget | "error">());
  const inflight = React.useRef(new Map<string, AbortController>());
  const [readyKeys, setReadyKeys] = React.useState<Set<string>>(() => new Set());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const latest = React.useRef({ onTargetReady, onTargetError, onMorphComplete, decoder, targets });
  React.useEffect(() => {
    latest.current = { onTargetReady, onTargetError, onMorphComplete, decoder, targets };
  });
  const cacheKey = (id: string) => `${id}|${count}|${seed}`;

  React.useEffect(() => {
    if (!target) return;
    const key = cacheKey(target.id);
    if (prepared.current.has(key) || inflight.current.has(key)) return;
    const ac = new AbortController();
    inflight.current.set(key, ac);
    const t = target;
    const prepare = async (): Promise<PreparedTarget | null> => {
      if (t.type === "points") return resamplePoints(t.points, count, seed, t.colors);
      const mask = await latest.current.decoder(t.src, ac.signal);
      return sampleMask(mask, count, seed);
    };
    prepare()
      .then((p) => {
        if (ac.signal.aborted) return;
        inflight.current.delete(key);
        if (!p) {
          prepared.current.set(key, "error");
          setErrors((e) => ({ ...e, [t.id]: "The target has no visible pixels or points." }));
          latest.current.onTargetError?.(t.id, "empty target");
          return;
        }
        prepared.current.set(key, { ...p, id: t.id });
        setReadyKeys((s) => new Set(s).add(key));
        latest.current.onTargetReady?.(t.id);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        inflight.current.delete(key);
        prepared.current.set(key, "error");
        const msg = e instanceof Error ? e.message : "preparation failed";
        setErrors((er) => ({ ...er, [t.id]: msg })); // label and fallback stay (C54-T05)
        latest.current.onTargetError?.(t.id, msg);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, count, seed]);
  React.useEffect(
    () => () => {
      inflight.current.forEach((ac) => ac.abort()); // cancel pending preparation (C54-T08)
      inflight.current.clear();
    },
    [],
  );

  /* renderer + analytic morph */
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<Stage | null>(null);
  const pointsRef = React.useRef<{ points: Points; geometry: BufferGeometry; material: PointsMaterial; positions: Float32Array; colors: Float32Array; start: Float32Array; end: Float32Array; offsets: Float32Array } | null>(null);
  const morphRef = React.useRef<{ id: string; t0: number; revision: number; active: boolean }>({ id: "", t0: 0, revision: 0, active: false });
  const [shownId, setShownId] = React.useState<string | null>(null); // the target whose points are on screen (fallback hides once it is)
  const [renderState, setRenderState] = React.useState<"idle" | "ready" | "fallback">("idle");
  const unsubRef = React.useRef<(() => void) | null>(null);

  // buffers are allocated once per instance and reused (C54-T10)
  const ensureBuffers = () => {
    if (pointsRef.current) return pointsRef.current;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    const material = new PointsMaterial({ size: variant === "minimal" ? 0.035 : 0.018, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 });
    const points = new Points(geometry, material);
    pointsRef.current = { points, geometry, material, positions, colors, start: new Float32Array(count * 3), end: new Float32Array(count * 3), offsets: curveOffsets(count, spread, seed) };
    return pointsRef.current;
  };

  React.useEffect(() => {
    if (renderer !== "auto" || !canvasRef.current || stageRef.current) {
      if (renderer !== "auto") setRenderState("fallback");
      return;
    }
    try {
      const stage = createStage(canvasRef.current, { background: null, maxPixelRatio: quality === "high" ? 2 : quality === "low" ? 1 : 1.5, initialOrbit: { yaw: 0, pitch: 0, distance: 3.2, target: [0, 0, 0] }, onContextLost: () => setRenderState("fallback"), onContextRestored: () => setRenderState("ready") });
      stageRef.current = stage;
      const b = ensureBuffers();
      stage.content.add(b.points);
      const r = rootRef.current;
      if (r) stage.setSize(r.clientWidth || 480, r.clientWidth || 480);
      setRenderState("ready");
      unsubRef.current = stage.onFrame((now) => {
        const m = morphRef.current;
        const buf = pointsRef.current;
        if (!m.active || !buf) return;
        const t = Math.min(1, (now - m.t0) / Math.max(1, duration * durationScale));
        evaluateMorph(buf.start, buf.end, buf.offsets, t, buf.positions);
        (buf.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
        if (t >= 1) {
          m.active = false;
          latest.current.onMorphComplete?.(m.id, m.revision); // only the latest completed transition
        } else stage.requestRender();
      });
    } catch {
      setRenderState("fallback");
    }
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      const b = pointsRef.current;
      if (b) {
        b.geometry.dispose();
        b.material.dispose();
        pointsRef.current = null;
      }
      stageRef.current?.dispose();
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, count]);

  // when the requested target becomes ready, morph (or jump) toward it
  const readyForTarget = target ? readyKeys.has(cacheKey(target.id)) : false;
  const revisionRef = React.useRef(0);
  React.useEffect(() => {
    if (!target || !readyForTarget) return;
    const p = prepared.current.get(cacheKey(target.id));
    if (!p || p === "error") return;
    const b = ensureBuffers();
    const theme = new Color(themeColor);
    for (let i = 0; i < count; i++) {
      b.colors[i * 3] = colorMode === "source" ? p.colors[i * 3]! : theme.r;
      b.colors[i * 3 + 1] = colorMode === "source" ? p.colors[i * 3 + 1]! : theme.g;
      b.colors[i * 3 + 2] = colorMode === "source" ? p.colors[i * 3 + 2]! : theme.b;
    }
    (b.geometry.getAttribute("color") as BufferAttribute).needsUpdate = true;
    const m = morphRef.current;
    const revision = ++revisionRef.current;
    const stage = stageRef.current;
    if (!full || shownId === null || !stage) {
      // first target, reduced motion or no renderer: place points directly (C54-T06)
      b.positions.set(p.positions);
      b.start.set(p.positions);
      b.end.set(p.positions);
      m.active = false;
      m.id = target.id;
      m.revision = revision;
      (b.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
      stage?.requestRender();
      setShownId(target.id);
      latest.current.onMorphComplete?.(target.id, revision);
      return;
    }
    // interrupting: start from the current computed positions, never the old shape (C54-T03)
    b.start.set(b.positions);
    b.end.set(p.positions);
    m.id = target.id;
    m.revision = revision;
    m.t0 = performance.now();
    m.active = true;
    setShownId(target.id);
    stage.requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, readyForTarget, full, colorMode, themeColor]);

  // pause decoration while hidden; resume at the latest target
  React.useEffect(() => {
    const onVis = () => {
      const m = morphRef.current;
      const b = pointsRef.current;
      if (document.hidden) {
        if (m.active && b) {
          b.positions.set(b.end);
          m.active = false;
        }
      } else stageRef.current?.requestRender();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  React.useEffect(() => {
    const r = rootRef.current;
    const stage = stageRef.current;
    if (!r || !stage || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => stage.setSize(r.clientWidth, r.clientWidth));
    ro.observe(r);
    return () => ro.disconnect();
  }, [renderState]);

  const controlsRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => ({
    root: rootRef.current,
    requestTarget: request,
    focusControls: () => controlsRef.current?.querySelector<HTMLElement>("button")?.focus(),
    getPositions: () => pointsRef.current?.positions ?? null,
  }));

  const uid = React.useId();
  const pointsVisible = renderState === "ready" && shownId !== null;
  const error = target ? errors[target.id] : undefined;
  const preparing = !!target && !readyForTarget && !error;

  return (
    <div
      ref={rootRef}
      data-slot="particle-morph"
      data-variant={variant}
      data-motion={mode}
      data-state={error ? "error" : preparing ? "preparing" : pointsVisible ? "ready" : "fallback"}
      data-target={target?.id}
      data-shown={shownId ?? undefined}
      role="group"
      aria-label={label}
      className={cn("flex w-full max-w-[480px] flex-col gap-3 text-[var(--cui-particle-label,#141311)]", className)}
      style={{ ["--cui-particle-color" as string]: themeColor }}
      {...rest}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--cui-particle-background,#faf9f6)]" data-stage>
        {/* the static asset is the identity until points are genuinely ready, and whenever rendering is unavailable */}
        {target && <img src={target.fallback} alt={target.label} className={cn("absolute inset-0 size-full object-contain p-8 transition-opacity", pointsVisible && "opacity-0")} data-fallback />}
        <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full", renderer !== "auto" && "hidden")} />
        {preparing && (
          <div className="absolute inset-x-0 bottom-3 text-center text-[12px] opacity-70" data-preparing>
            Preparing {target?.label}…
          </div>
        )}
        {error && (
          <div role="status" className="absolute inset-x-3 bottom-3 rounded-lg bg-white/85 p-2 text-center text-[12px] text-[var(--cui-particle-error,#c8360d)]">
            {error}
          </div>
        )}
      </div>
      <p className="m-0 text-center text-[13px] font-medium" id={`${uid}-label`} aria-live="polite" data-label>
        {target?.label ?? "No target"}
      </p>
      {showControls && targets.length > 1 && (
        <div ref={controlsRef} role="group" aria-label="Targets" className="flex flex-wrap justify-center gap-1.5">
          {targets.map((t) => (
            <button key={t.id} type="button" aria-pressed={t.id === requested} onClick={() => request(t.id)} className={cn("rounded-full border border-[var(--cui-particle-border,rgba(20,19,17,0.25))] px-3 py-1 text-[12px] outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-particle-color,#141311)]", t.id === requested && "bg-[var(--cui-particle-color,#141311)] text-[var(--cui-particle-background,#faf9f6)]")}>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
ParticleMorph.displayName = "ParticleMorph";
