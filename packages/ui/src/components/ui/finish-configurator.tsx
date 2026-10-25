"use client";

import * as React from "react";
import { animate } from "motion/react";
import { Color, Mesh, MeshStandardMaterial, Object3D, Texture, TextureLoader } from "three";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { checkCandidate, createGenerationCounter, findOption, sanitizeMaterialParams, selectionFlags, validateGroups, type FinishOption, type OptionGroup, type Selection, type Verdict } from "@/lib/finish-options";
import { createStage, disposeSubtree, type OrbitState, type Stage, type ViewPreset } from "@/lib/three-stage";

export type { FinishOption, MaterialParams, OptionGroup, Selection } from "@/lib/finish-options";
export type { OrbitState, ViewPreset } from "@/lib/three-stage";

export type ModelSource = { kind: "url"; src: string } | { kind: "scene"; build: () => Object3D };

export interface SelectionMeta {
  groupId: string;
  optionId: string;
  reason: "select" | "reset";
  requestId: string;
}

export type TextureLoaderFn = (url: string, signal: AbortSignal) => Promise<Texture>;

export interface FinishConfiguratorHandle {
  root: HTMLDivElement | null;
  focusOption: (groupId: string, optionId: string) => void;
  resetView: () => void;
}

export interface FinishConfiguratorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  model: ModelSource;
  poster: string;
  description: string;
  groups: readonly OptionGroup[];
  selection?: Selection;
  /** Declared default configuration (also what Reset returns to). Required. */
  defaultSelection: Selection;
  /** Host rule after structural checks. */
  validateSelection?: (candidate: Selection, change: { groupId: string; optionId: string }) => boolean | Verdict;
  onSelectionChange?: (selection: Selection, meta: SelectionMeta) => void;
  /** Host-supplied identifier for the accepted configuration; never inferred. */
  configurationKey?: string;
  onAssetError?: (error: { reason: "load" | "renderer" | "texture"; message: string }) => void;
  onVisualReady?: () => void;
  /** Inject a texture loader (tests, custom caching). */
  textureLoader?: TextureLoaderFn;
  quality?: "auto" | "high" | "balanced" | "low";
  camera?: OrbitState;
  views?: readonly ViewPreset[];
  variant?: "color" | "material" | "variants";
  label?: string;
  motion?: "auto" | "reduced" | "off";
  renderer?: "auto" | "none";
}

const DEFAULT_CAMERA: OrbitState = { yaw: 0.6, pitch: 0.35, distance: 5, target: [0, 0.4, 0] };

interface Loaded {
  root: Object3D;
  /** mesh/material name → owned material clones */
  targets: Map<string, MeshStandardMaterial[]>;
  materials: MeshStandardMaterial[];
}

async function loadModel(source: ModelSource): Promise<Object3D> {
  if (source.kind === "scene") return source.build();
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  return (await new GLTFLoader().loadAsync(source.src)).scene;
}

const defaultTextureLoader: TextureLoaderFn = (url, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
    new TextureLoader().load(url, (t) => (signal.aborted ? (t.dispose(), reject(new DOMException("aborted", "AbortError"))) : resolve(t)), undefined, () => reject(new Error(`Texture failed to load: ${url}`)));
  });

let requestCounter = 0;

/**
 * FinishConfigurator — choose real product finishes on named parts.
 *
 * Options are semantic DOM (radio groups with text names and unavailable
 * reasons). A choice is checked synchronously for compatibility before it is
 * proposed; the host's selection is authoritative when controlled. Material
 * parameters are allowlisted and applied to per-instance material clones;
 * textures load behind generation ids so a late finish never overwrites a
 * newer one, and the previous valid surface stays until the new one is
 * ready. Reset returns to the declared default. Price, stock and purchase
 * are never fabricated.
 */
export const FinishConfigurator = React.forwardRef<FinishConfiguratorHandle, FinishConfiguratorProps>(function FinishConfigurator(
  {
    model,
    poster,
    description,
    groups,
    selection: selectionProp,
    defaultSelection,
    validateSelection,
    onSelectionChange,
    configurationKey,
    onAssetError,
    onVisualReady,
    textureLoader = defaultTextureLoader,
    quality = "auto",
    camera = DEFAULT_CAMERA,
    views = [],
    variant = "material",
    label = "Finish configurator",
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

  /* options */
  const diagnostics = React.useMemo(() => validateGroups(groups, defaultSelection), [groups, defaultSelection]);
  const [internalSel, setInternalSel] = React.useState<Selection>(defaultSelection);
  const selection = selectionProp ?? internalSel;
  const flags = React.useMemo(() => selectionFlags(groups, selection), [groups, selection]);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean }>({ text: "" });
  const propose = (groupId: string, optionId: string, reason: "select" | "reset") => {
    const v = checkCandidate(groups, selection, groupId, optionId);
    if (!v.allowed) {
      setNotice({ text: v.reason ?? "Not allowed.", error: true });
      return false;
    }
    const next = { ...selection, [groupId]: optionId };
    if (validateSelection) {
      const r = validateSelection(next, { groupId, optionId });
      const verdict: Verdict = typeof r === "boolean" ? { allowed: r, reason: r ? undefined : "Not allowed by the host rule." } : r;
      if (!verdict.allowed) {
        setNotice({ text: verdict.reason ?? "Not allowed.", error: true });
        return false;
      }
    }
    setNotice({ text: "" });
    if (selectionProp === undefined) setInternalSel(next);
    onSelectionChange?.(next, { groupId, optionId, reason, requestId: `finish-${++requestCounter}` });
    return true;
  };
  const reset = () => {
    setNotice({ text: "Reset to the default configuration." });
    if (selectionProp === undefined) setInternalSel(defaultSelection);
    for (const [gid, oid] of Object.entries(defaultSelection)) onSelectionChange?.(defaultSelection, { groupId: gid, optionId: oid, reason: "reset", requestId: `finish-${++requestCounter}` });
  };

  /* model lifecycle */
  const [state, setState] = React.useState<"poster" | "loading" | "ready" | "fallback" | "error">("poster");
  const [message, setMessage] = React.useState<string | null>(null);
  const [preparing, setPreparing] = React.useState<string | null>(null);
  const [textureError, setTextureError] = React.useState<string | null>(null);
  const loadedRef = React.useRef<Loaded | null>(null);
  const stageRef = React.useRef<Stage | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const generations = React.useRef(createGenerationCounter());
  const perTarget = React.useRef(new Map<string, { gen: number; abort: AbortController | null; texture: Texture | null }>());
  const latest = React.useRef({ onAssetError, onVisualReady, textureLoader, groups, selection });
  React.useEffect(() => {
    latest.current = { onAssetError, onVisualReady, textureLoader, groups, selection };
  });
  const modelKey = model.kind === "url" ? model.src : model.build;

  /** Apply one option to its targets with per-target generations (C53-T01, C53-T03, C53-T08). */
  const applyOption = React.useCallback(
    (opt: FinishOption, immediate: boolean) => {
      const l = loadedRef.current;
      if (!l) return;
      const params = sanitizeMaterialParams(opt.material);
      for (const target of opt.targets) {
        const mats = l.targets.get(target);
        if (!mats) continue;
        const slot = perTarget.current.get(target) ?? { gen: 0, abort: null, texture: null };
        slot.abort?.abort();
        slot.abort = null;
        const gen = generations.current.next();
        slot.gen = gen;
        perTarget.current.set(target, slot);
        const paint = () => {
          for (const m of mats) {
            if (params.roughness !== undefined) m.roughness = params.roughness;
            if (params.metalness !== undefined) m.metalness = params.metalness;
            if (params.color) {
              if (immediate || !full) m.color.set(params.color);
              else {
                const from = m.color.clone();
                const to = new Color(params.color);
                animate(0, 1, { duration: 0.22, onUpdate: (t) => { m.color.copy(from).lerp(to, t); stageRef.current?.requestRender(); } });
              }
            }
            m.needsUpdate = true;
          }
          stageRef.current?.requestRender();
        };
        if (params.map) {
          const ac = new AbortController();
          slot.abort = ac;
          setPreparing(opt.name);
          latest.current
            .textureLoader(params.map, ac.signal)
            .then((tex) => {
              if (slot.gen !== gen) {
                tex.dispose(); // a newer finish won (C53-T03)
                return;
              }
              slot.texture?.dispose();
              slot.texture = tex;
              for (const m of mats) m.map = tex;
              paint();
              setPreparing((p) => (p === opt.name ? null : p));
              setTextureError(null);
            })
            .catch((e: unknown) => {
              if (slot.gen !== gen || (e instanceof DOMException && e.name === "AbortError")) return;
              setPreparing((p) => (p === opt.name ? null : p));
              setTextureError(`${opt.name}: ${e instanceof Error ? e.message : "texture failed"}. The previous finish is still shown.`);
              latest.current.onAssetError?.({ reason: "texture", message: e instanceof Error ? e.message : "texture failed" });
            });
        } else {
          for (const m of mats) {
            if (m.map) {
              m.map = null;
              slot.texture?.dispose();
              slot.texture = null;
            }
          }
          paint();
        }
      }
    },
    [full],
  );

  React.useEffect(() => {
    let cancelled = false;
    setState("loading");
    setMessage(null);
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
        const targets = new Map<string, MeshStandardMaterial[]>();
        const materials: MeshStandardMaterial[] = [];
        root.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const cloned = mats.map((m) => {
            const c = (m as MeshStandardMaterial).clone() as MeshStandardMaterial; // per-instance ownership (C53-T04)
            materials.push(c);
            const push = (key: string) => targets.set(key, [...(targets.get(key) ?? []), c]);
            if (mesh.name) push(mesh.name);
            if ((m as MeshStandardMaterial).name) push((m as MeshStandardMaterial).name);
            return c;
          });
          mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
        });
        loadedRef.current = { root, targets, materials };
        let stage = stageRef.current;
        if (!stage && renderer === "auto" && canvasRef.current) {
          try {
            stage = createStage(canvasRef.current, {
              background: null,
              maxPixelRatio: quality === "high" ? 2 : quality === "low" ? 1 : 1.5,
              initialOrbit: camera,
              limits: { minDistance: camera.distance * 0.5, maxDistance: camera.distance * 2.5 },
              onContextLost: () => {
                setState("fallback");
                setMessage("The graphics context was lost. Your selected options are listed below.");
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
          const r = rootRef.current;
          if (r) stage.setSize(r.clientWidth || 640, Math.round((r.clientWidth || 640) * 0.66));
          setState("ready");
          latest.current.onVisualReady?.();
        } else {
          setState("fallback");
          setMessage("3D rendering is unavailable here. Your selected options are listed below.");
        }
        // paint the current selection immediately
        for (const g of latest.current.groups) {
          const opt = findOption(latest.current.groups, g.id, latest.current.selection[g.id] ?? "");
          if (opt) applyOption(opt, true);
        }
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

  // apply accepted selection changes (material presentation follows the accepted selection)
  const selKey = JSON.stringify(selection);
  const [paintedKey, setPaintedKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (state === "poster" || state === "loading" || state === "error") return;
    if (paintedKey === selKey) return;
    const prev = paintedKey ? (JSON.parse(paintedKey) as Selection) : null;
    for (const g of groups) {
      const id = selection[g.id];
      if (!id || (prev && prev[g.id] === id)) continue;
      const opt = findOption(groups, g.id, id);
      if (opt) applyOption(opt, prev === null);
    }
    setPaintedKey(selKey);
  }, [selKey, state, groups, selection, applyOption, paintedKey]);

  React.useEffect(
    () => () => {
      for (const slot of perTarget.current.values()) {
        slot.abort?.abort();
        slot.texture?.dispose();
      }
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
  const optionRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusOption: (g, o) => optionRefs.current.get(`${g}:${o}`)?.focus(), resetView }));
  React.useEffect(() => {
    const r = rootRef.current;
    const stage = stageRef.current;
    if (!r || !stage || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => stage.setSize(r.clientWidth, Math.round(r.clientWidth * 0.66)));
    ro.observe(r);
    return () => ro.disconnect();
  }, [state]);

  const uid = React.useId();
  const canvasVisible = state === "ready" || state === "loading";
  const selectedNames = groups.map((g) => `${g.label}: ${findOption(groups, g.id, selection[g.id] ?? "")?.name ?? "—"}`);
  const fallbackImage = groups.map((g) => findOption(groups, g.id, selection[g.id] ?? "")?.image).find(Boolean);

  return (
    <div
      ref={rootRef}
      data-slot="finish-configurator"
      data-variant={variant}
      data-motion={mode}
      data-state={preparing ? "preparing" : state}
      data-configuration={configurationKey}
      role="group"
      aria-label={label}
      className={cn("grid w-full gap-4 text-[var(--cui-finish-text,#141311)] md:grid-cols-[1fr_280px]", className)}
      {...rest}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl bg-[var(--cui-finish-stage,#e9e5dc)]" data-stage>
          <img src={state === "fallback" && fallbackImage ? fallbackImage : poster} alt={description} className={cn("absolute inset-0 size-full object-contain", canvasVisible && "opacity-0")} />
          <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full touch-none", !canvasVisible && "hidden")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
          {preparing && (
            <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white" data-preparing>
              Loading {preparing}…
            </div>
          )}
          {state === "loading" && <div className="absolute inset-x-0 bottom-3 text-center text-[12px] opacity-70">Loading model…</div>}
          {(state === "fallback" || state === "error") && message && (
            <div role="note" data-message className="absolute inset-x-3 bottom-3 rounded-lg bg-white/85 p-2 text-center text-[12px]">
              {message}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          {views.map((v) => (
            <button key={v.id} type="button" disabled={state !== "ready"} onClick={() => goToView(v)} className={BTN}>
              {v.label}
            </button>
          ))}
          <button type="button" disabled={state !== "ready"} onClick={resetView} className={BTN}>
            Reset view
          </button>
          <span className="ml-auto text-[11px] opacity-60">Display appearance varies; supplied samples are authoritative.</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 text-[13px]">
        {diagnostics.length > 0 && (
          <div role="note" className="rounded-lg border border-[var(--cui-finish-unavailable,#c8360d)] p-2 text-[12px] text-[var(--cui-finish-unavailable,#c8360d)]">
            {diagnostics.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
        )}
        {groups.map((g) => {
          const current = findOption(groups, g.id, selection[g.id] ?? "");
          const flag = flags[g.id];
          return (
            <fieldset key={g.id} className="m-0 min-w-0 border-0 p-0" data-group={g.id}>
              <legend className="mb-1 flex w-full items-baseline justify-between text-[12px] font-semibold uppercase tracking-wide opacity-80">
                <span>{g.label}</span>
                <span className="font-normal normal-case tracking-normal opacity-80" data-selected-name>
                  {current?.name ?? "—"}
                </span>
              </legend>
              {flag && !flag.allowed && (
                <p className="m-0 mb-1 text-[12px] text-[var(--cui-finish-unavailable,#c8360d)]" data-flag>
                  {flag.reason} Please choose another option.
                </p>
              )}
              <div role="radiogroup" aria-label={g.label} className="flex flex-wrap gap-1.5">
                {g.options.map((o) => {
                  const checked = selection[g.id] === o.id;
                  const verdict = checked ? { allowed: true } : checkCandidate(groups, selection, g.id, o.id);
                  const blocked = !verdict.allowed;
                  return (
                    <button
                      key={o.id}
                      ref={(el) => {
                        if (el) optionRefs.current.set(`${g.id}:${o.id}`, el);
                        else optionRefs.current.delete(`${g.id}:${o.id}`);
                      }}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={o.name}
                      aria-describedby={blocked ? `${uid}-${g.id}-${o.id}` : undefined}
                      data-option={o.id}
                      data-blocked={blocked || undefined}
                      onClick={() => propose(g.id, o.id, "select")}
                      className={cn(
                        "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-finish-selected,#141311)]",
                        checked ? "border-[var(--cui-finish-selected,#141311)] ring-1 ring-[var(--cui-finish-selected,#141311)]" : "border-[var(--cui-finish-swatch-border,rgba(20,19,17,0.2))]",
                        blocked && "opacity-50",
                      )}
                    >
                      <span aria-hidden className="size-6 shrink-0 rounded-full border border-black/10 bg-cover" style={{ background: o.thumbnail ? `url(${o.thumbnail}) center/cover` : (sanitizeMaterialParams(o.material).color ?? "#ccc") }} />
                      <span>{o.name}</span>
                      {blocked && <span className="text-[10px] uppercase tracking-wide opacity-70">{o.available === false ? "unavailable" : "incompatible"}</span>}
                      {blocked && (
                        <span id={`${uid}-${g.id}-${o.id}`} className="sr-only">
                          {verdict.reason}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={reset} className={BTN}>
            Reset
          </button>
          <span role="status" aria-live="polite" className={cn("text-[12px]", notice.error || textureError ? "text-[var(--cui-finish-unavailable,#c8360d)]" : "opacity-80")}>
            {textureError ?? notice.text}
          </span>
        </div>
        <p className="m-0 text-[12px] opacity-80" data-summary>
          Selected: {selectedNames.join(" · ")}
          {configurationKey ? ` · ${configurationKey}` : ""}
        </p>
      </div>
    </div>
  );
});
FinishConfigurator.displayName = "FinishConfigurator";

const BTN =
  "inline-flex h-7 items-center rounded-full border border-[var(--cui-finish-swatch-border,rgba(20,19,17,0.25))] px-2.5 text-[12px] outline-none hover:bg-[rgba(20,19,17,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--cui-finish-selected,#141311)] disabled:cursor-not-allowed disabled:opacity-40";
