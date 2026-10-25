/**
 * Minimal demand-rendered Three.js stage shared by the 3D product components.
 * One owner per canvas: renderer, scene, camera, lights, a bounded orbit, a
 * device-pixel-ratio cap, context-loss handling and disposal. Nothing renders
 * unless `requestRender()` is called. Pure orbit math is exported separately
 * so it can be unit-tested without WebGL.
 */
import { AmbientLight, Color, DirectionalLight, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";

export interface OrbitState {
  /** Radians around Y. */
  yaw: number;
  /** Radians above the horizon. */
  pitch: number;
  distance: number;
  target: [number, number, number];
}

export interface OrbitLimits {
  minPitch?: number;
  maxPitch?: number;
  minDistance?: number;
  maxDistance?: number;
}

export interface ViewPreset extends Partial<OrbitState> {
  id: string;
  label: string;
}

export function clampOrbit(s: OrbitState, limits: OrbitLimits = {}): OrbitState {
  const minP = limits.minPitch ?? -0.3;
  const maxP = limits.maxPitch ?? 1.3;
  const minD = limits.minDistance ?? 1;
  const maxD = limits.maxDistance ?? 20;
  return { ...s, pitch: Math.max(minP, Math.min(maxP, s.pitch)), distance: Math.max(minD, Math.min(maxD, s.distance)) };
}

export function cameraPositionFor(s: OrbitState): [number, number, number] {
  const [tx, ty, tz] = s.target;
  const cp = Math.cos(s.pitch);
  return [tx + s.distance * cp * Math.sin(s.yaw), ty + s.distance * Math.sin(s.pitch), tz + s.distance * cp * Math.cos(s.yaw)];
}

export interface StageOptions {
  background?: string | null;
  maxPixelRatio?: number;
  initialOrbit: OrbitState;
  limits?: OrbitLimits;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** Add models here; cleared on dispose. */
  content: Group;
  orbit: OrbitState;
  setOrbit(next: Partial<OrbitState>): void;
  setSize(width: number, height: number): void;
  requestRender(): void;
  /** Register a per-frame hook (returns unsubscribe). Hooks run only when a frame was requested. */
  onFrame(cb: (now: number) => void): () => void;
  dispose(): void;
}

/** Throws when WebGL is unavailable; callers fall back to poster + list. */
export function createStage(canvas: HTMLCanvasElement, opts: StageOptions): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: opts.background === null, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(opts.maxPixelRatio ?? 1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1));
  renderer.localClippingEnabled = true;
  const scene = new Scene();
  if (opts.background) scene.background = new Color(opts.background);
  const camera = new PerspectiveCamera(35, 1, 0.05, 200);
  const content = new Group();
  scene.add(content);
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  const fill = new DirectionalLight(0xffffff, 0.8);
  fill.position.set(-4, 2, -3);
  scene.add(new AmbientLight(0xffffff, 0.9), key, fill);

  let orbit = clampOrbit(opts.initialOrbit, opts.limits);
  const applyCamera = () => {
    camera.position.set(...cameraPositionFor(orbit));
    camera.lookAt(new Vector3(...orbit.target));
  };
  applyCamera();

  let frame: number | null = null;
  let disposed = false;
  const hooks = new Set<(now: number) => void>();
  const render = (now: number) => {
    frame = null;
    if (disposed) return;
    hooks.forEach((h) => h(now));
    renderer.render(scene, camera);
  };
  const requestRender = () => {
    if (disposed || frame !== null) return;
    frame = requestAnimationFrame(render);
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    opts.onContextLost?.();
  };
  const onRestored = () => {
    opts.onContextRestored?.();
    requestRender();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const stage: Stage = {
    scene,
    camera,
    renderer,
    content,
    get orbit() {
      return orbit;
    },
    setOrbit(next) {
      orbit = clampOrbit({ ...orbit, ...next }, opts.limits);
      applyCamera();
      requestRender();
    },
    setSize(width, height) {
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      requestRender();
    },
    requestRender,
    onFrame(cb) {
      hooks.add(cb);
      return () => hooks.delete(cb);
    },
    dispose() {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      hooks.clear();
      scene.remove(content);
      renderer.dispose();
    },
  };
  return stage;
}

/** Dispose geometry/materials owned by a subtree (shared caches must not be passed here). */
export function disposeSubtree(root: { traverse(cb: (o: unknown) => void): void }): void {
  root.traverse((o) => {
    const m = o as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
    m.geometry?.dispose();
    if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
    else m.material?.dispose();
  });
}
