import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { capSupport, clampOffset, computeLocalBounds, localCut, planeFor, presetToSlice } from "./clip-plane";

function model() {
  const root = new Group();
  const outer = new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial());
  outer.name = "Outer";
  outer.userData.closed = true;
  const inner = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshStandardMaterial());
  inner.name = "Inner";
  inner.position.set(0, 1.5, 0); // sticks out above the outer box
  root.add(outer, inner);
  return { root, outer, inner };
}

describe("clip plane", () => {
  it("computes model-local bounds regardless of the model's world transform", () => {
    const { root } = model();
    const b0 = computeLocalBounds(root);
    expect(b0.min.toArray()).toEqual([-1, -1, -1]);
    expect(b0.max.toArray()).toEqual([1, 1.75, 1]);
    root.position.set(10, 0, 0);
    root.rotation.z = Math.PI / 2;
    root.scale.setScalar(3);
    const b1 = computeLocalBounds(root);
    b1.min.toArray().forEach((v, i) => expect(v).toBeCloseTo([-1, -1, -1][i]!, 6));
    b1.max.toArray().forEach((v, i) => expect(v).toBeCloseTo([1, 1.75, 1][i]!, 6));
  });

  it("maps offset −1/0/1 to the bounds and derives a consistent world plane after scaling/rotation (C52-T01, C52-T02)", () => {
    const { root } = model();
    const bounds = computeLocalBounds(root);
    expect(localCut(bounds, "y", -1)).toBe(-1);
    expect(localCut(bounds, "y", 0)).toBe(0.375);
    expect(localCut(bounds, "y", 1)).toBe(1.75);
    expect(clampOffset(5)).toBe(1);
    root.position.set(10, 0, 0);
    root.scale.setScalar(2);
    root.rotation.z = Math.PI / 2; // local +y becomes world −x
    const plane = planeFor(root, bounds, "y", 1, false);
    // the top of the box (local y = 1.75) sits at world x = 10 − 3.5
    const top = new Vector3(0, 1.75, 0).applyMatrix4(root.matrixWorld);
    expect(plane.distanceToPoint(top)).toBeCloseTo(0, 6);
    expect(plane.normal.x).toBeCloseTo(1, 6); // retained side = local −y = world +x
    const inverted = planeFor(root, bounds, "y", 1, true);
    expect(inverted.normal.x).toBeCloseTo(-1, 6);
    expect(root.scale.x).toBe(2); // transforms untouched
    expect(root.rotation.z).toBeCloseTo(Math.PI / 2);
  });

  it("supports caps only for declared-closed, opaque, non-skinned meshes (C52-T04, C52-T08)", () => {
    const { outer, inner } = model();
    expect(capSupport(outer)).toEqual({ supported: true });
    expect(capSupport(inner).reason).toMatch(/not declared closed/);
    const glass = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: true }));
    glass.name = "Glass";
    glass.userData.closed = true;
    expect(capSupport(glass).reason).toMatch(/transparent/);
  });

  it("presets reproduce the same slice deterministically (C52-T06)", () => {
    const p = { id: "half", label: "Half", axis: "x" as const, offset: 0.25, invert: true };
    expect(presetToSlice(p)).toEqual({ axis: "x", offset: 0.25, invert: true });
    expect(presetToSlice({ ...p, offset: -9 })).toEqual({ axis: "x", offset: -1, invert: true });
  });
});
