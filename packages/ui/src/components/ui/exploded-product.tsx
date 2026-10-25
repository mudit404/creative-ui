"use client";

import * as React from "react";
import { animate, useMotionValue } from "motion/react";
import { Color, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { applyProgress, snapshotRest, validateParts, type PartDefinition, type PartDiagnostic, type RestTransforms } from "@/lib/exploded-parts";
import { createStage, disposeSubtree, type OrbitState, type Stage, type ViewPreset } from "@/lib/three-stage";

export type { PartDefinition } from "@/lib/exploded-parts";
export type { OrbitState, ViewPreset } from "@/lib/three-stage";

/** A prepared glTF/GLB URL, or a function that builds a Three.js subtree (fixtures, tests, procedural demos). */
export type ModelSource = { kind: "url"; src: string } | { kind: "scene"; build: () => Object3D };

export interface ExplodedProductHandle {
  root: HTMLDivElement | null;
  focusPart: (id: string) => void;
  resetView: () => void;
}

export interface ExplodedProductProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  model: ModelSource;
  poster: string;
  alt: string;
  parts: readonly PartDefinition[];
  progress?: number;
  defaultProgress?: number;
  onProgressChange?: (progress: number, source: "slider" | "button" | "keyboard") => void;
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelectedIdChange?: (id: string | null, reason: "list" | "canvas" | "clear") => void;
  /** Authored default camera. */
  camera?: OrbitState;
  views?: readonly ViewPreset[];
  onAssetError?: (error: { reason: "load" | "parts" | "renderer"; message: string; diagnostics?: PartDiagnostic[] }) => void;
  onReady?: (partIds: string[]) => void;
  quality?: "auto" | "high" | "balanced" | "low";
  variant?: "linear" | "radial" | "inspection";
  label?: string;
  motion?: "auto" | "reduced" | "off";
  durationScale?: number;
  /** Test/SSR hook: skip creating a WebGL renderer. */
  renderer?: "auto" | "none";
}

const DEFAULT_CAMERA: OrbitState = { yaw: 0.7, pitch: 0.45, distance: 6, target: [0, 0, 0] };

interface Loaded {
  root: Object3D;
  resolved: Map<string, Object3D>;
  rest: RestTransforms;
  diagnostics: PartDiagnostic[];
  /** Per-instance material clones (owned). */
  materials: MeshStandardMaterial[];
}

async function loadModel(source: ModelSource): Promise<Object3D> {
  if (source.kind === "scene") return source.build();
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().loadAsync(source.src);
  return gltf.scene;
}

/** Clone materials so highlighting never touches shared cache assets (C51-T06, C51-T10). */
function ownMaterials(root: Object3D): MeshStandardMaterial[] {
  const owned: MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = mats.map((m) => {
      const c = (m as MeshStandardMaterial).clone() as MeshStandardMaterial;
      owned.push(c);
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
  });
  return owned;
}

/**
 * ExplodedProduct — move authored product parts apart along their declared
 * vectors while a semantic parts list stays in charge.
 *
 * The poster and parts list render first. The model loads (GLB or a built
 * scene), part paths resolve uniquely, rest transforms are snapshotted once,
 * and every position is derived from rest + offset × progress. Selection
 * from the list highlights the mesh and shows its description; view presets
 * and Assemble/Explode buttons cover inspection without dragging. Without
 * WebGL the poster and list remain, and the controller still works.
 */
export const ExplodedProduct = React.forwardRef<ExplodedProductHandle, ExplodedProductProps>(function ExplodedProduct(
  {
    model,
    poster,
    alt,
    parts,
    progress: progressProp,
    defaultProgress = 0,
    onProgressChange,
    selectedId: selectedProp,
    defaultSelectedId = null,
    onSelectedIdChange,
    camera = DEFAULT_CAMERA,
    views = [],
    onAssetError,
    onReady,
    quality = "auto",
    variant = "linear",
    label = "Exploded product",
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

  /* progress + selection (controlled or local) */
  const [internalProgress, setInternalProgress] = React.useState(() => clamp01(defaultProgress));
  const progress = clamp01(progressProp ?? internalProgress);
  const setProgress = (p: number, source: "slider" | "button" | "keyboard") => {
    const c = clamp01(p);
    if (progressProp === undefined) setInternalProgress(c);
    onProgressChange?.(c, source);
  };
  const [internalSel, setInternalSel] = React.useState<string | null>(defaultSelectedId);
  const selectedId = selectedProp !== undefined ? selectedProp : internalSel;
  const select = (id: string | null, reason: "list" | "canvas" | "clear") => {
    if (selectedProp === undefined) setInternalSel(id);
    onSelectedIdChange?.(id, reason);
  };

  /* model lifecycle */
  const [state, setState] = React.useState<"poster" | "loading" | "ready" | "fallback" | "error">("poster");
  const [message, setMessage] = React.useState<string | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<PartDiagnostic[]>([]);
  const loadedRef = React.useRef<Loaded | null>(null);
  const stageRef = React.useRef<Stage | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const labelRef = React.useRef<HTMLDivElement>(null);
  const latest = React.useRef({ parts, onAssetError, onReady, progress, selectedId });
  React.useEffect(() => {
    latest.current = { parts, onAssetError, onReady, progress, selectedId };
  });
  const modelKey = model.kind === "url" ? model.src : model.build;

  // visual progress drives the Object3D tree; retargets smoothly (C51-T05)
  const visual = useMotionValue(progress);
  const applyVisual = React.useCallback((p: number) => {
    const l = loadedRef.current;
    if (!l) return;
    applyProgress(l.resolved, l.rest, latest.current.parts, p);
    stageRef.current?.requestRender();
  }, []);
  React.useEffect(() => visual.on("change", applyVisual), [visual, applyVisual]);

  React.useEffect(() => {
    let cancelled = false;
    setState("loading");
    setMessage(null);
    setDiagnostics([]);
    const old = loadedRef.current;
    loadedRef.current = null;
    if (old) {
      stageRef.current?.content.remove(old.root);
      old.materials.forEach((m) => m.dispose());
      if (model.kind === "url") disposeSubtree(old.root);
    }
    loadModel(model)
      .then((root) => {
        if (cancelled) return;
        const { resolved, diagnostics } = validateParts(root, latest.current.parts);
        const materials = ownMaterials(root);
        const loaded: Loaded = { root, resolved, rest: snapshotRest(resolved), diagnostics, materials };
        loadedRef.current = loaded;
        setDiagnostics(diagnostics);
        if (diagnostics.length) latest.current.onAssetError?.({ reason: "parts", message: `${diagnostics.length} part mapping${diagnostics.length === 1 ? "" : "s"} failed.`, diagnostics });
        // model replacement keeps a selection whose id still exists (C51-T08)
        if (latest.current.selectedId && !resolved.has(latest.current.selectedId)) {
          if (selectedProp === undefined) setInternalSel(null);
          onSelectedIdChange?.(null, "clear");
        }
        applyProgress(resolved, loaded.rest, latest.current.parts, latest.current.progress);
        visual.jump(latest.current.progress);
        // renderer (enhancement)
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
                setMessage("The graphics context was lost. The parts list and poster remain available.");
              },
              onContextRestored: () => setState("ready"),
            });
            stageRef.current = stage;
          } catch (e) {
            latest.current.onAssetError?.({ reason: "renderer", message: e instanceof Error ? e.message : "WebGL unavailable" });
          }
        }
        if (stage) {
          stage.content.add(root);
          const box = new Vector3();
          root.getWorldPosition(box);
          const r = rootRef.current;
          if (r) stage.setSize(r.clientWidth || 640, Math.round((r.clientWidth || 640) * 0.66));
          stage.requestRender();
          setState("ready");
        } else {
          setState("fallback");
          setMessage("3D rendering is unavailable here; the poster and parts list stay functional.");
        }
        latest.current.onReady?.([...resolved.keys()]);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState("error");
        setMessage(e instanceof Error ? e.message : "The model could not be loaded.");
        latest.current.onAssetError?.({ reason: "load", message: e instanceof Error ? e.message : "load failed" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey, renderer]);

  // teardown: dispose owned resources only (C51-T10)
  React.useEffect(
    () => () => {
      const l = loadedRef.current;
      if (l) {
        l.materials.forEach((m) => m.dispose());
        if (model.kind === "url") disposeSubtree(l.root);
      }
      stageRef.current?.dispose();
      stageRef.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // animate toward the committed progress (700 ms full; immediate otherwise)
  React.useEffect(() => {
    if (!full) {
      visual.jump(progress);
      applyVisual(progress);
      return;
    }
    const ctrl = animate(visual, progress, { duration: 0.7 * durationScale, ease: [0.2, 0.8, 0.2, 1] });
    return () => ctrl.stop();
  }, [progress, full, durationScale, visual, applyVisual]);

  // selection highlight on owned materials
  React.useEffect(() => {
    const l = loadedRef.current;
    if (!l) return;
    for (const [id, node] of l.resolved) {
      node.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats as MeshStandardMaterial[]) {
          if (!m.emissive) continue;
          m.emissive = new Color(id === selectedId ? "#3a6f4a" : "#000000");
          m.emissiveIntensity = id === selectedId ? 0.6 : 0;
        }
      });
    }
    stageRef.current?.requestRender();
  }, [selectedId, state]);

  // resize + label projection
  React.useEffect(() => {
    const r = rootRef.current;
    const stage = stageRef.current;
    if (!r || !stage || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => stage.setSize(r.clientWidth, Math.round(r.clientWidth * 0.66)));
    ro.observe(r);
    const off = stage.onFrame(() => {
      const l = loadedRef.current;
      const el = labelRef.current;
      if (!l || !el || !selectedId) return;
      const node = l.resolved.get(selectedId);
      if (!node) return;
      const v = node.getWorldPosition(new Vector3()).project(stage.camera);
      const w = stage.renderer.domElement.clientWidth;
      const h = stage.renderer.domElement.clientHeight;
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    });
    return () => {
      ro.disconnect();
      off();
    };
  }, [state, selectedId]);

  /* camera: bounded orbit + presets */
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
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
  };
  const orbitAnim = React.useRef<{ stop: () => void } | null>(null);
  const goToView = (target: Partial<OrbitState>, ms = 400) => {
    const stage = stageRef.current;
    if (!stage) return;
    orbitAnim.current?.stop();
    const from = { ...stage.orbit };
    const to = { ...from, ...target };
    if (!full) {
      stage.setOrbit(to);
      return;
    }
    orbitAnim.current = animate(0, 1, {
      duration: (ms / 1000) * durationScale,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (t) => stage.setOrbit({ yaw: from.yaw + (to.yaw - from.yaw) * t, pitch: from.pitch + (to.pitch - from.pitch) * t, distance: from.distance + (to.distance - from.distance) * t, target: to.target }),
    });
  };
  const resetView = () => goToView(camera);
  const focusPart = (id: string) => {
    select(id, "list");
    const node = loadedRef.current?.resolved.get(id);
    const stage = stageRef.current;
    if (!node || !stage) return;
    const p = node.getWorldPosition(new Vector3());
    goToView({ target: [p.x, p.y, p.z], distance: Math.max(stage.orbit.distance * 0.6, camera.distance * 0.4) });
  };
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusPart, resetView }));

  const uid = React.useId();
  const selected = parts.find((p) => p.id === selectedId) ?? null;
  const canvasVisible = state === "ready" || state === "loading";
  const diag = (id: string) => diagnostics.find((d) => d.partId === id);

  return (
    <div
      ref={rootRef}
      data-slot="exploded-product"
      data-variant={variant}
      data-motion={mode}
      data-state={state}
      data-progress={progress.toFixed(2)}
      role="group"
      aria-label={label}
      className={cn("grid w-full gap-4 text-[var(--cui-explode-text,#141311)] md:grid-cols-[1fr_260px]", className)}
      {...rest}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-[var(--cui-explode-background,#e9e5dc)]" data-stage>
          <img src={poster} alt={alt} className={cn("absolute inset-0 size-full object-contain", canvasVisible && "opacity-0")} />
          <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full touch-none", !canvasVisible && "hidden")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
          {state === "ready" && selected && (
            <div ref={labelRef} className="pointer-events-none absolute left-0 top-0" aria-hidden>
              <div className="-translate-x-1/2 -translate-y-[140%] rounded-md bg-[var(--cui-explode-label,#141311)] px-2 py-0.5 text-[11px] text-white shadow">{selected.label}</div>
              <div className="mx-auto h-5 w-px -translate-y-[140%] bg-[var(--cui-explode-label,#141311)]" />
            </div>
          )}
          {state === "loading" && <div className="absolute inset-x-0 bottom-3 text-center text-[12px] opacity-70">Loading model…</div>}
          {(state === "fallback" || state === "error") && message && (
            <div role="status" className="absolute inset-x-3 bottom-3 rounded-lg bg-white/85 p-2 text-center text-[12px]">
              {message}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <button type="button" onClick={() => setProgress(0, "button")} className={BTN} disabled={state === "poster" || state === "loading"}>
            Assemble
          </button>
          <label className="flex min-w-[160px] flex-1 items-center gap-2">
            <span className="sr-only">Assembly</span>
            <input type="range" aria-label="Assembly" min={0} max={1} step={0.01} value={progress} disabled={state === "poster" || state === "loading"} onChange={(e) => setProgress(Number(e.target.value), "slider")} className="w-full accent-[var(--cui-explode-selection,#1f7a4f)]" />
            <span className="w-10 text-right font-mono tabular-nums">{Math.round(progress * 100)}%</span>
          </label>
          <button type="button" onClick={() => setProgress(1, "button")} className={BTN} disabled={state === "poster" || state === "loading"}>
            Explode
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]" role="group" aria-label="Views">
          {views.map((v) => (
            <button key={v.id} type="button" onClick={() => goToView(v)} disabled={state !== "ready"} className={BTN}>
              {v.label}
            </button>
          ))}
          <button type="button" onClick={resetView} disabled={state !== "ready"} className={BTN}>
            Reset view
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <h3 id={`${uid}-parts`} className="m-0 mb-1 text-[12px] font-semibold uppercase tracking-wide opacity-70">
          Parts ({parts.length})
        </h3>
        <ul aria-labelledby={`${uid}-parts`} className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px]">
          {parts.map((p) => {
            const d = diag(p.id);
            return (
              <li key={p.id}>
                <button type="button" aria-pressed={p.id === selectedId} aria-describedby={d ? `${uid}-d-${p.id}` : undefined} onClick={() => select(p.id === selectedId ? null : p.id, p.id === selectedId ? "clear" : "list")} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-[rgba(20,19,17,0.05)] focus-visible:ring-2 focus-visible:ring-[var(--cui-explode-selection,#1f7a4f)]", p.id === selectedId && "bg-[rgba(31,122,79,0.12)] font-medium", d && "opacity-60")}>
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  {d && <span className="text-[10px] uppercase tracking-wide text-[var(--cui-explode-error,#c8360d)]">unmapped</span>}
                </button>
                {d && (
                  <span id={`${uid}-d-${p.id}`} className="sr-only">
                    {d.message}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div data-details aria-live="polite" className="mt-2 rounded-xl border border-[var(--cui-explode-border,rgba(20,19,17,0.15))] p-3 text-[13px]">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <strong>{selected.label}</strong>
                {state === "ready" && (
                  <button type="button" onClick={() => focusPart(selected.id)} className={BTN}>
                    Focus
                  </button>
                )}
              </div>
              {selected.description && <p className="m-0 mt-1 opacity-80">{selected.description}</p>}
              {diag(selected.id) && <p className="m-0 mt-1 text-[12px] text-[var(--cui-explode-error,#c8360d)]">{diag(selected.id)!.message}</p>}
            </>
          ) : (
            <span className="opacity-60">Select a part to read about it.</span>
          )}
        </div>
        {diagnostics.length > 0 && (
          <div role="note" className="mt-2 rounded-lg border border-[var(--cui-explode-error,#c8360d)] p-2 text-[11px] text-[var(--cui-explode-error,#c8360d)]">
            {diagnostics.map((d) => (
              <div key={d.partId}>{d.message}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
ExplodedProduct.displayName = "ExplodedProduct";

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const BTN =
  "inline-flex h-7 items-center rounded-full border border-[var(--cui-explode-border,rgba(20,19,17,0.25))] px-2.5 text-[12px] outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-explode-selection,#1f7a4f)] disabled:cursor-not-allowed disabled:opacity-40";

/** Procedural helper for fixtures and demos: a named box part. */
export function makePart(name: string, size: [number, number, number], position: [number, number, number], color = "#b8b8b8", closed = true): Mesh {
  const mesh = new Mesh();
  mesh.name = name;
  mesh.position.set(...position);
  mesh.userData.closed = closed;
  mesh.material = new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
  mesh.userData.size = size;
  return mesh;
}
export { Group as ModelGroup };
