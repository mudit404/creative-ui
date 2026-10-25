import { describe, expect, it } from "vitest";
import { Group, Mesh, Object3D, Vector3 } from "three";
import { applyProgress, resolveNodePath, restoreRest, snapshotRest, validateParts, type PartDefinition } from "./exploded-parts";

function buildModel() {
  const root = new Group();
  root.name = "root";
  const body = new Group();
  body.name = "Body";
  body.position.set(1, 0, 0);
  body.rotation.y = Math.PI / 2; // nested parent transform
  body.scale.setScalar(2);
  const shell = new Mesh();
  shell.name = "Shell";
  shell.position.set(0.5, 0, 0);
  const cap = new Mesh();
  cap.name = "Cap";
  cap.position.set(0, 1, 0);
  body.add(shell, cap);
  const handle = new Mesh();
  handle.name = "Handle";
  handle.position.set(0, -1, 0);
  root.add(body, handle);
  return { root, body, shell, cap, handle };
}
const PARTS: PartDefinition[] = [
  { id: "shell", nodePath: "Body/Shell", label: "Shell", offset: [1, 0, 0] },
  { id: "cap", nodePath: "Body/Cap", label: "Cap", offset: [0, 2, 0] },
  { id: "handle", nodePath: "Handle", label: "Handle", offset: [0, -1, 0] },
];

describe("exploded parts", () => {
  it("resolves paths uniquely and reports missing or ambiguous ones (C51-T03)", () => {
    const { root } = buildModel();
    expect(resolveNodePath(root, "Body/Shell").node?.name).toBe("Shell");
    expect(resolveNodePath(root, "Body/Nope").reason).toMatch(/no child named "Nope"/);
    const dup = new Object3D();
    dup.name = "Handle";
    root.add(dup);
    expect(resolveNodePath(root, "Handle").reason).toMatch(/ambiguous/);
    const v = validateParts(root, [...PARTS, { id: "ghost", nodePath: "Body/Missing", label: "Ghost", offset: [0, 0, 0] }]);
    expect(v.resolved.size).toBe(2);
    expect(v.diagnostics.map((d) => d.partId).sort()).toEqual(["ghost", "handle"]);
    expect(v.diagnostics.find((d) => d.partId === "ghost")!.message).toContain('path "Body/Missing" did not resolve');
  });

  it("rejects nested part roots and duplicate resolutions", () => {
    const { root } = buildModel();
    const v = validateParts(root, [...PARTS, { id: "body", nodePath: "Body", label: "Body", offset: [0, 0, 1] }]);
    expect(v.resolved.has("body")).toBe(true);
    expect(v.resolved.has("shell")).toBe(false);
    expect(v.diagnostics.map((d) => d.message)).toEqual(expect.arrayContaining([expect.stringMatching(/"shell" is inside part "body"/), expect.stringMatching(/"cap" is inside part "body"/)]));
    const twice = validateParts(root, [PARTS[0]!, { ...PARTS[0]!, id: "again" }]);
    expect(twice.diagnostics[0]!.message).toMatch(/same node/);
  });

  it("applies parent-local offsets without double movement and restores exactly after 100 cycles (C51-T01, C51-T02)", () => {
    const { root, shell } = buildModel();
    const { resolved } = validateParts(root, PARTS);
    const rest = snapshotRest(resolved);
    root.updateMatrixWorld(true);
    const restWorld = shell.getWorldPosition(new Vector3()).clone();
    applyProgress(resolved, rest, PARTS, 1);
    root.updateMatrixWorld(true);
    const explodedWorld = shell.getWorldPosition(new Vector3());
    // parent Body is rotated 90° about Y and scaled 2: a local +1 x offset becomes a world −2 z displacement
    expect(explodedWorld.x - restWorld.x).toBeCloseTo(0, 6);
    expect(explodedWorld.z - restWorld.z).toBeCloseTo(-2, 6);
    for (let i = 0; i < 100; i++) {
      applyProgress(resolved, rest, PARTS, 1);
      applyProgress(resolved, rest, PARTS, 0.37);
      applyProgress(resolved, rest, PARTS, 0);
    }
    expect(shell.position.toArray()).toEqual([0.5, 0, 0]);
    expect(resolved.get("cap")!.position.toArray()).toEqual([0, 1, 0]);
    applyProgress(resolved, rest, PARTS, 0.5);
    expect(resolved.get("cap")!.position.toArray()).toEqual([0, 2, 0]);
    applyProgress(resolved, rest, PARTS, 7); // clamped
    expect(resolved.get("cap")!.position.toArray()).toEqual([0, 3, 0]);
    restoreRest(resolved, rest);
    expect(resolved.get("cap")!.position.toArray()).toEqual([0, 1, 0]);
  });

  it("two models have independent transforms (C51-T06)", () => {
    const a = buildModel();
    const b = buildModel();
    const ra = validateParts(a.root, PARTS);
    const rb = validateParts(b.root, PARTS);
    applyProgress(ra.resolved, snapshotRest(ra.resolved), PARTS, 1);
    expect(a.cap.position.y).toBe(3);
    expect(b.cap.position.y).toBe(1);
    expect(rb.resolved.get("cap")).toBe(b.cap);
  });
});
