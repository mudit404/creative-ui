/**
 * Clipping math for CutawayViewer. Model-local bounds, a normalised offset
 * (−1…1) across the chosen axis, and a world-space clipping plane derived
 * through the model's transform. No renderer needed.
 */
import { Box3, Matrix4, Mesh, Object3D, Plane, Vector3 } from "three";

export type ClipAxis = "x" | "y" | "z";

export interface SlicePreset {
  id: string;
  label: string;
  axis: ClipAxis;
  offset: number;
  invert?: boolean;
  description?: string;
}

/** Bounding box of every mesh in the model's local space (independent of where the model sits in the world). */
export function computeLocalBounds(root: Object3D): Box3 {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  const box = new Box3();
  const tmp = new Box3();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox) return;
    tmp.copy(mesh.geometry.boundingBox).applyMatrix4(new Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    box.union(tmp);
  });
  if (box.isEmpty()) box.set(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
  return box;
}

export const clampOffset = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

/** Position of the cut along the axis in model-local units (C52-T01). */
export function localCut(bounds: Box3, axis: ClipAxis, offset: number): number {
  const lo = bounds.min[axis];
  const hi = bounds.max[axis];
  return lo + ((clampOffset(offset) + 1) / 2) * (hi - lo);
}

/**
 * World-space clipping plane. Three.js keeps the half-space where
 * `normal · p + constant >= 0`... (clips where distance < 0). The retained side is the
 * negative axis side by default; `invert` keeps the positive side.
 */
export function planeFor(root: Object3D, bounds: Box3, axis: ClipAxis, offset: number, invert = false): Plane {
  root.updateMatrixWorld(true);
  const normalLocal = new Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0).multiplyScalar(invert ? 1 : -1);
  const pointLocal = new Vector3(0, 0, 0);
  pointLocal[axis] = localCut(bounds, axis, offset);
  const plane = new Plane().setFromNormalAndCoplanarPoint(normalLocal, pointLocal);
  plane.applyMatrix4(root.matrixWorld);
  return plane;
}

export interface CapSupport {
  supported: boolean;
  reason?: string;
}

/**
 * Caps are only honest on closed, opaque, non-skinned meshes. Watertightness
 * cannot be verified from appearance, so the asset must declare it
 * (`userData.closed === true`); everything else is reported, not guessed (C52-T04, C52-T08).
 */
export function capSupport(mesh: Mesh): CapSupport {
  if ((mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) return { supported: false, reason: `"${mesh.name || "mesh"}" is skinned.` };
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (mats.some((m) => m && (m as { transparent?: boolean }).transparent)) return { supported: false, reason: `"${mesh.name || "mesh"}" is transparent.` };
  if (mesh.userData?.closed !== true) return { supported: false, reason: `"${mesh.name || "mesh"}" is not declared closed (userData.closed).` };
  return { supported: true };
}

export function presetToSlice(p: SlicePreset): { axis: ClipAxis; offset: number; invert: boolean } {
  return { axis: p.axis, offset: clampOffset(p.offset), invert: !!p.invert };
}
