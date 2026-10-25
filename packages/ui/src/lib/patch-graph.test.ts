import { describe, expect, it } from "vitest";
import { cablePath, nearestWithin, validateCandidate, validateConnections, type Connection, type Port } from "./patch-graph";

const ports: Port[] = [
  { id: "o1", nodeId: "osc", label: "Osc out", direction: "output", dataType: "audio" },
  { id: "o2", nodeId: "lfo", label: "LFO out", direction: "output", dataType: "cv" },
  { id: "i1", nodeId: "amp", label: "Amp in", direction: "input", dataType: "audio" },
  { id: "i2", nodeId: "amp", label: "Gain cv", direction: "input", dataType: "cv" },
  { id: "i3", nodeId: "fx", label: "FX in", direction: "input", dataType: "audio" },
];
const conns: Connection[] = [{ id: "c1", sourcePortId: "o1", targetPortId: "i1" }];

describe("patch graph", () => {
  it("rejects missing, self, wrong-direction, mismatched, duplicate and occupied targets with reasons (C45-T02, C45-T07)", () => {
    expect(validateCandidate(ports, conns, { sourcePortId: "o1", targetPortId: "zz" })).toEqual({ allowed: false, reason: "The target port no longer exists." });
    expect(validateCandidate(ports, conns, { sourcePortId: "o1", targetPortId: "o1" }).reason).toMatch(/itself/);
    expect(validateCandidate(ports, conns, { sourcePortId: "i1", targetPortId: "o1" }).reason).toMatch(/not an output/);
    expect(validateCandidate(ports, conns, { sourcePortId: "o2", targetPortId: "i1" }).reason).toBe("Type mismatch: cv → audio.");
    expect(validateCandidate(ports, conns, { sourcePortId: "o1", targetPortId: "i1" }).reason).toBe("Already connected.");
    expect(validateCandidate(ports, [...conns, { id: "c2", sourcePortId: "o2", targetPortId: "i2" }], { sourcePortId: "o2", targetPortId: "i2", replaceConnectionId: "c2" })).toEqual({ allowed: true });
    expect(validateCandidate(ports, conns, { sourcePortId: "o1", targetPortId: "i3" })).toEqual({ allowed: true });
    // occupied input (capacity 1) even when the occupying edge came from the parent
    const occupied = [...conns, { id: "c3", sourcePortId: "o1", targetPortId: "i3" }];
    expect(validateCandidate(ports, occupied, { sourcePortId: "o1", targetPortId: "i3" }).reason).toBe("Already connected.");
    expect(validateCandidate([...ports, { id: "o3", nodeId: "x", label: "Noise", direction: "output", dataType: "audio" }], occupied, { sourcePortId: "o3", targetPortId: "i3" }).reason).toBe("FX in is already occupied.");
    expect(validateCandidate([...ports, { id: "o3", nodeId: "x", label: "Noise", direction: "output", dataType: "audio" }], occupied, { sourcePortId: "o3", targetPortId: "i3" }, { maxConnectionsPerInput: 2 })).toEqual({ allowed: true });
  });

  it("runs the host rule last and surfaces its reason", () => {
    const v = validateCandidate(ports, [], { sourcePortId: "o1", targetPortId: "i3" }, { custom: () => ({ allowed: false, reason: "Would create a cycle." }) });
    expect(v.reason).toBe("Would create a cycle.");
    expect(validateCandidate(ports, [], { sourcePortId: "o1", targetPortId: "i3" }, { custom: () => true })).toEqual({ allowed: true });
  });

  it("lists invalid initial edges as diagnostics instead of dropping them silently", () => {
    const { valid, diagnostics } = validateConnections(ports, [
      { id: "ok", sourcePortId: "o1", targetPortId: "i1" },
      { id: "bad-type", sourcePortId: "o2", targetPortId: "i3" },
      { id: "ghost", sourcePortId: "o9", targetPortId: "i1" },
      { id: "second", sourcePortId: "o2", targetPortId: "i1" },
      { id: "ok", sourcePortId: "o2", targetPortId: "i2" },
    ]);
    expect(valid.map((c) => c.id)).toEqual(["ok"]);
    expect(diagnostics.map((d) => d.connectionId)).toEqual(["bad-type", "ghost", "second", "ok"]);
    expect(diagnostics[0]!.message).toBe("Type mismatch: cv → audio.");
    expect(diagnostics[2]!.message).toMatch(/Type mismatch/);
  });

  it("snaps to the nearest socket within the radius", () => {
    const sockets = [
      { id: "a", point: { x: 0, y: 0 } },
      { id: "b", point: { x: 30, y: 0 } },
    ];
    expect(nearestWithin({ x: 12, y: 0 }, sockets, 24)?.id).toBe("a");
    expect(nearestWithin({ x: 20, y: 0 }, sockets, 24)?.id).toBe("b");
    expect(nearestWithin({ x: 15, y: 40 }, sockets, 24)).toBeNull();
  });

  it("builds sagging cables with clamped slack and straight-ish mapping paths", () => {
    const d = cablePath({ x: 0, y: 0 }, { x: 100, y: 0 }, { slack: 0.18 });
    expect(d).toBe("M 0 0 C 30 18, 70 18, 100 0");
    expect(cablePath({ x: 0, y: 0 }, { x: 1000, y: 0 }, { slack: 0.5, maxSlackPx: 40 })).toContain("300 40, 700 40");
    expect(cablePath({ x: 0, y: 0 }, { x: 100, y: 50 }, { style: "mapping" })).toBe("M 0 0 C 40 0, 60 50, 100 50");
  });
});
