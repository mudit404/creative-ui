import { describe, expect, it } from "vitest";
import { buildAdjacency, fitViewBox, forceLayout, seedPositions, validateGraph, type GraphNode } from "./graph-model";

const nodes: GraphNode[] = ["a", "b", "c", "d"].map((id) => ({ id, label: id.toUpperCase() }));

describe("graph model", () => {
  it("validates nodes and edges with explicit diagnostics (C56-T01)", () => {
    const g = validateGraph([...nodes, { id: "a", label: "dup" }], [
      { source: "a", target: "b" },
      { id: "e2", source: "b", target: "zzz" },
      { id: "e3", source: "c", target: "d" },
      { id: "e3", source: "d", target: "a" },
    ]);
    expect(g.nodes).toHaveLength(4);
    expect(g.edges.map((e) => e.id)).toEqual(["a->b#0", "e3"]);
    expect(g.diagnostics.map((d) => d.message)).toEqual(['Duplicate node id "a" was ignored.', 'Edge "e2" references a missing node (zzz).', 'Duplicate edge id "e3" was ignored.']);
  });

  it("distinguishes inbound and outbound neighbours (C56-T03)", () => {
    const g = validateGraph(nodes, [
      { source: "a", target: "b" },
      { source: "c", target: "a" },
      { source: "a", target: "b" },
    ]);
    const adj = buildAdjacency(g.nodes, g.edges);
    expect(adj.get("a")).toEqual({ outbound: ["b"], inbound: ["c"], all: ["b", "c"] });
    expect(adj.get("b")).toEqual({ outbound: [], inbound: ["a"], all: ["a"] });
    expect(adj.get("d")).toEqual({ outbound: [], inbound: [], all: [] });
  });

  it("lays out deterministically within a bounded iteration budget (C56-T04)", () => {
    const g = validateGraph(nodes, [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "a" },
    ]);
    const one = forceLayout(g.nodes, g.edges, { seed: 7, width: 600, height: 400, maxIterations: 200 });
    const two = forceLayout(g.nodes, g.edges, { seed: 7, width: 600, height: 400, maxIterations: 200 });
    expect(one.positions).toEqual(two.positions);
    expect(one.iterations).toBeLessThanOrEqual(200);
    const capped = forceLayout(g.nodes, g.edges, { seed: 7, width: 600, height: 400, maxIterations: 5 });
    expect(capped.iterations).toBe(5);
    for (const p of Object.values(one.positions)) {
      expect(p.x).toBeGreaterThanOrEqual(20);
      expect(p.x).toBeLessThanOrEqual(580);
    }
    const other = forceLayout(g.nodes, g.edges, { seed: 8, width: 600, height: 400, maxIterations: 200 });
    expect(other.positions).not.toEqual(one.positions);
    expect(seedPositions(nodes, 1, 100, 100)).toEqual(seedPositions(nodes, 1, 100, 100));
  });

  it("keeps pinned nodes where they are", () => {
    const g = validateGraph(nodes, [{ source: "a", target: "b" }]);
    const out = forceLayout(g.nodes, g.edges, { seed: 1, width: 400, height: 400, pinned: { a: { x: 50, y: 60 } } });
    expect(out.positions.a).toEqual({ x: 50, y: 60 });
  });

  it("fits a viewBox around positions with the viewport aspect", () => {
    const vb = fitViewBox({ a: { x: 0, y: 0 }, b: { x: 100, y: 50 } }, { width: 200, height: 100 }, 10);
    expect(vb.w / vb.h).toBeCloseTo(2);
    expect(vb.x).toBeLessThan(0);
    expect(vb.x + vb.w).toBeGreaterThan(100);
    expect(fitViewBox({}, { width: 300, height: 150 })).toEqual({ x: 0, y: 0, w: 300, h: 150 });
  });
});
