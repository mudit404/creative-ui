"use client";

import * as React from "react";
import { animate, useMotionValue } from "motion/react";
import { AlwaysStencilFunc, BackSide, Box3, DecrementWrapStencilOp, DoubleSide, FrontSide, Group, IncrementWrapStencilOp, Mesh, MeshStandardMaterial, NotEqualStencilFunc, Object3D, Plane, PlaneGeometry, ReplaceStencilOp, Vector3 } from "three";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { capSupport, clampOffset, computeLocalBounds, localCut, planeFor, presetToSlice, type ClipAxis, type SlicePreset } from "@/lib/clip-plane";
import { createStage, disposeSubtree, type OrbitState, type Stage, type ViewPreset } from "@/lib/three-stage";

export type { ClipAxis, SlicePreset } from "@/lib/clip-plane";
export type { OrbitState, ViewPreset } from "@/lib/three-stage";

export type ModelSource = { kind: "url"; src: string } | { kind: "scene"; build: () => Object3D };

export interface SliceState {
  axis: ClipAxis;
  offset: number;
  invert: boolean;
  enabled: boolean;
  /** Model-local cut position along the axis. */
  localCut: number;
  /** World plane: normal and constant (Three.js convention). */
  plane: { normal: [number, number, number]; constant: number } | null;
}

export interface AssetWarning {
  code: "uncapped" | "cap-required" | "load" | "renderer";
  message: string;
  nodes?: string[];
}

export interface CutawayViewerHandle {
  root: HTMLDivElement | null;
  resetView: () => void;
}

export interface CutawayViewerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  model: ModelSource;
  poster: string;
  description: string;
  axis?: ClipAxis;
  defaultAxis?: ClipAxis;
  offset?: number;
  defaultOffset?: number;
  enabled?: boolean;
  defaultEnabled?: boolean;
  invert?: boolean;
  defaultInvert?: boolean;
  capMode?: "auto" | "off" | "required";
  presets?: readonly SlicePreset[];
  onSliceChange?: (slice: SliceState, source: "slider" | "input" | "button" | "preset" | "axis" | "invert" | "toggle" | "reset") => void;
  onAssetWarning?: (warnings: AssetWarning[]) => void;
  quality?: "auto" | "high" | "balanced" | "low";
  showGuide?: boolean;
  camera?: OrbitState;
  views?: readonly ViewPreset[];
  /** Optional sectional poster for the fallback. */
  sectionPoster?: string;
  variant?: "section" | "reveal" | "layer-study";
  label?: string;
  motion?: "auto" | "reduced" | "off";
  renderer?: "auto" | "none";
}

const DEFAULT_CAMERA: OrbitState = { yaw: 0.8, pitch: 0.4, distance: 6, target: [0, 0, 0] };

interface Loaded {
  root: Object3D;
  bounds: Box3;
  materials: MeshStandardMaterial[];
  /** Stencil helper meshes + cap, created once (C52-T05). */
  caps: { group: Group; capMesh: Mesh; helpers: Mesh[] } | null;
  guide: Mesh;
  warnings: AssetWarning[];
}

async function loadModel(source: ModelSource): Promise<Object3D> {
  if (source.kind === "scene") return source.build();
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  return (await new GLTFLoader().loadAsync(source.src)).scene;
}

/**
 * CutawayViewer — clip a prepared model with an axis-aligned plane and show
 * the cut honestly.
 *
 * Offset −1…1 maps across the model-local bounds on the chosen axis; the
 * world plane is derived through the model transform. Caps (the flat cut
 * surface) are drawn only for meshes the asset declares closed and opaque;
 * everything else is clipped uncapped with a visible warning. Axis changes
 * update one plane and reuse the stencil helpers; nothing is rebuilt per
 * frame. Controls are a slider, numeric entry, step buttons and presets.
 */
export const CutawayViewer = React.forwardRef<CutawayViewerHandle, CutawayViewerProps>(function CutawayViewer(
  {
    model,
    poster,
    description,
    axis: axisProp,
    defaultAxis = "y",
    offset: offsetProp,
    defaultOffset = 0,
    enabled: enabledProp,
    defaultEnabled = false,
    invert: invertProp,
    defaultInvert = false,
    capMode = "auto",
    presets = [],
    onSliceChange,
    onAssetWarning,
    quality = "auto",
    showGuide = true,
    camera = DEFAULT_CAMERA,
    views = [],
    sectionPoster,
    variant = "section",
    label = "Cutaway",
    motion = "auto",
    renderer = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";
  const full = mode === "full";

  /* slice state (controlled or local) */
  const [iAxis, setIAxis] = React.useState<ClipAxis>(defaultAxis);
  const [iOffset, setIOffset] = React.useState(() => clampOffset(defaultOffset));
  const [iEnabled, setIEnabled] = React.useState(defaultEnabled);
  const [iInvert, setIInvert] = React.useState(defaultInvert);
  const axis = axisProp ?? iAxis;
  const offset = clampOffset(offsetProp ?? iOffset);
  const enabled = enabledProp ?? iEnabled;
  const invert = invertProp ?? iInvert;

  /* model lifecycle */
  const [state, setState] = React.useState<"poster" | "loading" | "ready" | "fallback" | "error">("poster");
  const [message, setMessage] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<AssetWarning[]>([]);
  const loadedRef = React.useRef<Loaded | null>(null);
  const stageRef = React.useRef<Stage | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const planeRef = React.useRef(new Plane(new Vector3(0, -1, 0), 0));
  const latest = React.useRef({ onAssetWarning, onSliceChange, axis, offset, invert, enabled, capMode, showGuide });
  React.useEffect(() => {
    latest.current = { onAssetWarning, onSliceChange, axis, offset, invert, enabled, capMode, showGuide };
  });
  const modelKey = model.kind === "url" ? model.src : model.build;
  const [bounds, setBounds] = React.useState<Box3 | null>(null);

  // visual offset (tweened under full motion) → plane update → render
  const visualOffset = useMotionValue(offset);
  const applyPlane = React.useCallback(
    (off: number) => {
      const l = loadedRef.current;
      if (!l) return;
      const { axis: ax, invert: inv, enabled: en } = latest.current;
      const plane = planeFor(l.root, l.bounds, ax, off, inv);
      planeRef.current.copy(plane);
      const planes = en ? [planeRef.current] : [];
      for (const m of l.materials) m.clippingPlanes = planes;
      if (l.caps) {
        l.caps.group.visible = en;
        for (const h of l.caps.helpers) (h.material as MeshStandardMaterial).clippingPlanes = planes;
        // cap sits on the plane, facing the retained side
        const p = planeRef.current.coplanarPoint(new Vector3());
        l.caps.capMesh.position.copy(p);
        l.caps.capMesh.lookAt(p.clone().add(planeRef.current.normal));
      }
      l.guide.visible = en && latest.current.showGuide;
      const gp = planeRef.current.coplanarPoint(new Vector3());
      l.guide.position.copy(gp);
      l.guide.lookAt(gp.clone().add(planeRef.current.normal));
      stageRef.current?.requestRender();
    },
    [],
  );
  React.useEffect(() => visualOffset.on("change", applyPlane), [visualOffset, applyPlane]);

  React.useEffect(() => {
    let cancelled = false;
    setState("loading");
    setMessage(null);
    setWarnings([]);
    setBounds(null); // old bounds are invalid until validation completes (C52-T09)
    const old = loadedRef.current;
    loadedRef.current = null;
    if (old) {
      stageRef.current?.content.remove(old.root);
      if (old.caps) stageRef.current?.content.remove(old.caps.group);
      stageRef.current?.content.remove(old.guide);
      old.materials.forEach((m) => m.dispose());
      old.caps?.helpers.forEach((h) => (h.material as MeshStandardMaterial).dispose());
      old.guide.geometry.dispose();
      (old.guide.material as MeshStandardMaterial).dispose();
      if (model.kind === "url") disposeSubtree(old.root);
    }
    loadModel(model)
      .then((root) => {
        if (cancelled) return;
        const b = computeLocalBounds(root);
        const materials: MeshStandardMaterial[] = [];
        const supported: Mesh[] = [];
        const unsupported: string[] = [];
        root.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const cloned = mats.map((m) => {
            const c = (m as MeshStandardMaterial).clone() as MeshStandardMaterial;
            c.clipShadows = true;
            materials.push(c);
            return c;
          });
          mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
          const sup = capSupport(mesh);
          if (sup.supported) supported.push(mesh);
          else unsupported.push(sup.reason ?? mesh.name);
        });
        const ws: AssetWarning[] = [];
        let caps: Loaded["caps"] = null;
        const wantCaps = latest.current.capMode !== "off";
        if (wantCaps && unsupported.length) ws.push({ code: "uncapped", message: `${unsupported.length} mesh${unsupported.length === 1 ? "" : "es"} cannot be capped and will be clipped without a cut surface.`, nodes: unsupported });
        if (latest.current.capMode === "required" && unsupported.length) ws.push({ code: "cap-required", message: "capMode is \"required\" but the model has unsupported meshes; the cut is disabled." });
        if (wantCaps && supported.length && latest.current.capMode !== "required" ? true : wantCaps && supported.length && !unsupported.length) {
          // stencil technique: back faces increment, front faces decrement, cap draws where stencil != 0
          const group = new Group();
          group.name = "caps";
          const helpers: Mesh[] = [];
          for (const mesh of supported) {
            const back = new MeshStandardMaterial({ side: BackSide, depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: AlwaysStencilFunc, stencilFail: IncrementWrapStencilOp, stencilZFail: IncrementWrapStencilOp, stencilZPass: IncrementWrapStencilOp });
            const front = new MeshStandardMaterial({ side: FrontSide, depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: AlwaysStencilFunc, stencilFail: DecrementWrapStencilOp, stencilZFail: DecrementWrapStencilOp, stencilZPass: DecrementWrapStencilOp });
            const b1 = new Mesh(mesh.geometry, back);
            const f1 = new Mesh(mesh.geometry, front);
            b1.renderOrder = 1;
            f1.renderOrder = 1;
            mesh.add(b1, f1); // follow the mesh transform
            helpers.push(b1, f1);
          }
          const size = b.getSize(new Vector3()).length() * 2;
          const capMat = new MeshStandardMaterial({ color: "#ff4d1c", metalness: 0.1, roughness: 0.75, stencilWrite: true, stencilRef: 0, stencilFunc: NotEqualStencilFunc, stencilFail: ReplaceStencilOp, stencilZFail: ReplaceStencilOp, stencilZPass: ReplaceStencilOp });
          const capMesh = new Mesh(new PlaneGeometry(size, size), capMat);
          capMesh.name = "cap";
          capMesh.renderOrder = 2;
          capMesh.onAfterRender = (r) => r.clearStencil();
          group.add(capMesh);
          caps = { group, capMesh, helpers };
        }
        const guideSize = b.getSize(new Vector3()).length() * 1.2;
        const guide = new Mesh(new PlaneGeometry(guideSize, guideSize), new MeshStandardMaterial({ color: "#1f7a4f", transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false }));
        guide.name = "guide";
        guide.visible = false;
        const loaded: Loaded = { root, bounds: b, materials, caps, guide, warnings: ws };
        loadedRef.current = loaded;
        setBounds(b);
        setWarnings(ws);
        if (ws.length) latest.current.onAssetWarning?.(ws);
        let stage = stageRef.current;
        if (!stage && renderer === "auto" && canvasRef.current) {
          try {
            stage = createStage(canvasRef.current, {
              background: null,
              maxPixelRatio: quality === "high" ? 2 : quality === "low" ? 1 : 1.5,
              initialOrbit: camera,
              limits: { minDistance: camera.distance * 0.4, maxDistance: camera.distance * 3 },
              onContextLost: () => {
                setState("fallback");
                setMessage("The graphics context was lost; the sectional poster and controls explanation remain.");
              },
              onContextRestored: () => setState("ready"),
            });
            stageRef.current = stage;
          } catch (e) {
            ws.push({ code: "renderer", message: e instanceof Error ? e.message : "WebGL unavailable" });
          }
        }
        if (stage) {
          stage.content.add(root);
          if (caps) stage.content.add(caps.group);
          stage.content.add(guide);
          const r = rootRef.current;
          if (r) stage.setSize(r.clientWidth || 640, Math.round((r.clientWidth || 640) * 0.66));
          setState("ready");
        } else {
          setState("fallback");
          setMessage("3D rendering is unavailable here; the static section and explanations remain.");
        }
        visualOffset.jump(latest.current.offset);
        applyPlane(latest.current.offset);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState("error");
        setMessage(e instanceof Error ? e.message : "The model could not be loaded.");
        latest.current.onAssetWarning?.([{ code: "load", message: e instanceof Error ? e.message : "load failed" }]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey, renderer, capMode]);

  React.useEffect(
    () => () => {
      const l = loadedRef.current;
      if (l) {
        l.materials.forEach((m) => m.dispose());
        l.caps?.helpers.forEach((h) => (h.material as MeshStandardMaterial).dispose());
        if (model.kind === "url") disposeSubtree(l.root);
      }
      stageRef.current?.dispose();
      stageRef.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // apply committed slice: tween offset (260 ms) under full motion; axis/invert/enabled apply immediately
  React.useEffect(() => {
    if (!full) {
      visualOffset.jump(offset);
      applyPlane(offset);
      return;
    }
    const ctrl = animate(visualOffset, offset, { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] });
    return () => ctrl.stop();
  }, [offset, full, visualOffset, applyPlane]);
  React.useEffect(() => {
    applyPlane(visualOffset.get());
  }, [axis, invert, enabled, showGuide, state, applyPlane, visualOffset]);

  const commit = (patch: Partial<Pick<SliceState, "axis" | "offset" | "invert" | "enabled">>, source: Parameters<NonNullable<typeof onSliceChange>>[1]) => {
    if (patch.axis !== undefined && axisProp === undefined) setIAxis(patch.axis);
    if (patch.offset !== undefined && offsetProp === undefined) setIOffset(clampOffset(patch.offset));
    if (patch.invert !== undefined && invertProp === undefined) setIInvert(patch.invert);
    if (patch.enabled !== undefined && enabledProp === undefined) setIEnabled(patch.enabled);
    const l = loadedRef.current;
    const next = { axis: patch.axis ?? axis, offset: clampOffset(patch.offset ?? offset), invert: patch.invert ?? invert, enabled: patch.enabled ?? enabled };
    const plane = l && next.enabled ? planeFor(l.root, l.bounds, next.axis, next.offset, next.invert) : null;
    onSliceChange?.({ ...next, localCut: l ? localCut(l.bounds, next.axis, next.offset) : 0, plane: plane ? { normal: [plane.normal.x, plane.normal.y, plane.normal.z], constant: plane.constant } : null }, source);
  };

  /* camera */
  const drag = React.useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stage = stageRef.current;
    if (!stage || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, yaw: stage.orbit.yaw, pitch: stage.orbit.pitch };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d || !stage || d.pointerId !== e.pointerId) return;
    stage.setOrbit({ yaw: d.yaw - (e.clientX - d.x) * 0.008, pitch: d.pitch + (e.clientY - d.y) * 0.006 });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  };
  const goToView = (target: Partial<OrbitState>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const from = { ...stage.orbit };
    const to = { ...from, ...target };
    if (!full) {
      stage.setOrbit(to);
      return;
    }
    animate(0, 1, { duration: 0.4, ease: [0.2, 0.8, 0.2, 1], onUpdate: (t) => stage.setOrbit({ yaw: from.yaw + (to.yaw - from.yaw) * t, pitch: from.pitch + (to.pitch - from.pitch) * t, distance: from.distance + (to.distance - from.distance) * t }) });
  };
  const resetView = () => goToView(camera);
  const reset = () => {
    commit({ axis: defaultAxis, offset: clampOffset(defaultOffset), invert: defaultInvert, enabled: false }, "reset");
    resetView();
  };
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, resetView }));
  React.useEffect(() => {
    const r = rootRef.current;
    const stage = stageRef.current;
    if (!r || !stage || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => stage.setSize(r.clientWidth, Math.round(r.clientWidth * 0.66)));
    ro.observe(r);
    return () => ro.disconnect();
  }, [state]);

  /* numeric entry */
  const [text, setText] = React.useState(offset.toFixed(2));
  const [synced, setSynced] = React.useState(offset);
  if (synced !== offset) {
    setSynced(offset);
    setText(offset.toFixed(2));
  }
  const commitText = () => {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n)) {
      setText(offset.toFixed(2));
      return;
    }
    commit({ offset: n, enabled: true }, "input");
  };

  const uid = React.useId();
  const controlsDisabled = state !== "ready" && state !== "fallback";
  const capRequiredFail = warnings.some((w) => w.code === "cap-required");
  const canvasVisible = state === "ready" || state === "loading";
  const cut = bounds ? localCut(bounds, axis, offset) : null;

  return (
    <div
      ref={rootRef}
      data-slot="cutaway-viewer"
      data-variant={variant}
      data-motion={mode}
      data-state={state}
      data-axis={axis}
      data-offset={offset.toFixed(2)}
      data-invert={invert || undefined}
      data-enabled={enabled || undefined}
      data-capped={loadedRef.current?.caps && !capRequiredFail ? "true" : undefined}
      role="group"
      aria-label={label}
      className={cn("grid w-full gap-4 text-[var(--cui-cut-text,light-dark(#141311,#ecebe6))] md:grid-cols-[1fr_260px]", className)}
      {...rest}
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-[var(--cui-cut-background,light-dark(#e9e5dc,#2a2a27))]" data-stage>
        <img src={state === "fallback" && sectionPoster ? sectionPoster : poster} alt={description} className={cn("absolute inset-0 size-full object-contain", canvasVisible && "opacity-0")} />
        <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full touch-none", !canvasVisible && "hidden")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
        {state === "loading" && <div className="absolute inset-x-0 bottom-3 text-center text-[12px] opacity-70">Validating model…</div>}
        {(state === "fallback" || state === "error") && message && (
          <div role="status" className="absolute inset-x-3 bottom-3 rounded-lg bg-[light-dark(rgba(255,255,255,0.85),rgba(31,31,28,0.88))] p-2 text-center text-[12px]">
            {message}
          </div>
        )}
        <p className="absolute left-3 top-3 m-0 rounded-md bg-[light-dark(rgba(255,255,255,0.8),rgba(31,31,28,0.88))] px-2 py-0.5 text-[10px] opacity-80">Interior detail comes from the supplied model.</p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} disabled={controlsDisabled || capRequiredFail} onChange={(e) => commit({ enabled: e.target.checked }, "toggle")} />
            Cut enabled
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={invert} disabled={controlsDisabled || capRequiredFail} onChange={(e) => commit({ invert: e.target.checked }, "invert")} />
            Keep other half
          </label>
        </div>
        <div role="group" aria-label="Axis" className="inline-flex rounded-full border border-[var(--cui-cut-border,light-dark(rgba(20,19,17,0.25),rgba(236,235,230,0.25)))] p-0.5 text-[12px]">
          {(["x", "y", "z"] as const).map((a) => (
            <button key={a} type="button" aria-pressed={axis === a} disabled={controlsDisabled || capRequiredFail} onClick={() => commit({ axis: a }, "axis")} className={cn("rounded-full px-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-cut-focus,light-dark(#141311,#ecebe6))]", axis === a && "bg-[var(--cui-cut-focus,light-dark(#141311,#ecebe6))] text-[light-dark(#faf9f6,#141311)]")}>
              {a.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-label="Decrease depth" disabled={controlsDisabled || capRequiredFail} onClick={() => commit({ offset: offset - 0.1, enabled: true }, "button")} className={BTN}>
            −
          </button>
          <input type="range" aria-label="Depth" min={-1} max={1} step={0.01} value={offset} disabled={controlsDisabled || capRequiredFail} onChange={(e) => commit({ offset: Number(e.target.value), enabled: true }, "slider")} className="min-w-[120px] flex-1 accent-[var(--cui-cut-cap,#ff4d1c)]" />
          <button type="button" aria-label="Increase depth" disabled={controlsDisabled || capRequiredFail} onClick={() => commit({ offset: offset + 0.1, enabled: true }, "button")} className={BTN}>
            +
          </button>
          <input aria-label="Depth value" value={text} disabled={controlsDisabled || capRequiredFail} onChange={(e) => setText(e.target.value)} onBlur={commitText} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitText(); } }} className="h-7 w-16 rounded-md border border-[var(--cui-cut-boundary,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))] bg-transparent px-1.5 text-center font-mono text-[12px]" />
        </div>
        <p className="m-0 font-mono text-[11px] opacity-70" data-cut-readout>
          {cut !== null ? `${axis.toUpperCase()} cut at ${cut.toFixed(3)} (model units)` : "Bounds pending"}
        </p>
        {presets.length > 0 && (
          <div role="group" aria-label="Slice presets" className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p.id} type="button" disabled={controlsDisabled || capRequiredFail} onClick={() => commit({ ...presetToSlice(p), enabled: true }, "preset")} title={p.description} className={BTN}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Views">
          {views.map((v) => (
            <button key={v.id} type="button" disabled={state !== "ready"} onClick={() => goToView(v)} className={BTN}>
              {v.label}
            </button>
          ))}
          <button type="button" disabled={controlsDisabled} onClick={reset} className={BTN}>
            Reset
          </button>
        </div>
        {warnings.length > 0 && (
          <div role="note" id={`${uid}-warn`} className="rounded-lg border border-[var(--cui-cut-warn,light-dark(#b8310c,#ff8a65))] p-2 text-[12px] text-[var(--cui-cut-warn,light-dark(#b8310c,#ff8a65))]">
            {warnings.map((w, i) => (
              <div key={i}>
                {w.message}
                {w.nodes?.length ? ` (${w.nodes.join("; ")})` : ""}
              </div>
            ))}
          </div>
        )}
        {presets.find((p) => p.axis === axis && clampOffset(p.offset) === offset && !!p.invert === invert)?.description && (
          <p className="m-0 text-[12px] opacity-80" data-preset-description>
            {presets.find((p) => p.axis === axis && clampOffset(p.offset) === offset && !!p.invert === invert)!.description}
          </p>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {enabled ? `Cut on ${axis.toUpperCase()} at ${offset.toFixed(2)}${invert ? ", other half kept" : ""}.` : "Uncut."}
      </span>
    </div>
  );
});
CutawayViewer.displayName = "CutawayViewer";

const BTN =
  "inline-flex h-7 items-center rounded-full border border-[var(--cui-cut-border,light-dark(rgba(20,19,17,0.25),rgba(236,235,230,0.25)))] px-2.5 text-[12px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06))] focus-visible:ring-2 focus-visible:ring-[var(--cui-cut-focus,light-dark(#141311,#ecebe6))] disabled:cursor-not-allowed disabled:opacity-40";
