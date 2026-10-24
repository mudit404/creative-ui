import { describe, expect, it } from "vitest";
import { allGroups, clampRatios, defaultLayout, groupOf, hitTest, layoutGeometry, movePanel, panelsIn, placeMissing, removePanel, setRatios, validateLayout, type DockLayout } from "./dock-layout";

const PANELS = ["canvas", "layers", "props", "output", "notes"];
const base = (): DockLayout => ({
  schemaVersion: 1,
  root: {
    type: "split",
    id: "s1",
    direction: "row",
    ratios: [0.2, 0.6, 0.2],
    children: [
      { type: "group", id: "gL", tabs: ["layers"], active: "layers" },
      { type: "split", id: "s2", direction: "column", ratios: [0.7, 0.3], children: [{ type: "group", id: "gC", tabs: ["canvas", "notes"], active: "canvas" }, { type: "group", id: "gB", tabs: ["output"], active: "output" }] },
      { type: "group", id: "gR", tabs: ["props"], active: "props" },
    ],
  },
});

describe("dock layout", () => {
  it("validates versions, ids, ratios, structure and cycles (C59-T05)", () => {
    expect(validateLayout(base(), PANELS)).toEqual([]);
    expect(validateLayout(defaultLayout(PANELS), PANELS)).toEqual([]);
    expect(validateLayout({ schemaVersion: 2, root: { type: "group", id: "g", tabs: [], active: "" } }, PANELS)[0]).toMatch(/schemaVersion/);
    const bad = base();
    (bad.root as { children: unknown[] }).children.push({ type: "group", id: "gX", tabs: ["ghost", "canvas"], active: "zzz" });
    (bad.root as { ratios: number[] }).ratios = [0.2, 0.6, 0.2, 0.5];
    const problems = validateLayout(bad, PANELS);
    expect(problems).toEqual(expect.arrayContaining([expect.stringMatching(/Unknown panel id "ghost"/), expect.stringMatching(/Duplicate panel id "canvas"/), expect.stringMatching(/ratios must sum to 1/)]));
    const cyclic = base();
    const s1 = cyclic.root as { children: unknown[] };
    s1.children[2] = cyclic.root; // reference cycle
    expect(validateLayout(cyclic, PANELS).some((p) => /cycle/.test(p))).toBe(true);
    expect(validateLayout(null, PANELS)).toEqual(["Layout is missing a root."]);
  });

  it("moves panels by edge or tab and is the same path for menu and drag (C59-T02)", () => {
    const l = base();
    const left = movePanel(l, "props", { groupId: "gL", placement: "left" });
    expect(panelsIn(left).sort()).toEqual([...PANELS].sort());
    expect(groupOf(left, "props")!.tabs).toEqual(["props"]);
    const root = left.root as { direction: string; children: { type: string; tabs?: string[] }[] };
    expect(root.direction).toBe("row");
    expect(root.children[0]!.tabs).toEqual(["props"]); // normalised into the row, not nested
    expect(root.children[1]!.tabs).toEqual(["layers"]);
    const tab = movePanel(l, "props", { groupId: "gC", placement: "tab" });
    expect(groupOf(tab, "props")!.id).toBe("gC");
    expect(groupOf(tab, "props")!.active).toBe("props");
    expect(allGroups(tab.root).some((g) => g.id === "gR")).toBe(false); // the emptied group collapsed
    expect(movePanel(l, "canvas", { groupId: "gC", placement: "tab" })).toBe(l); // no-op
    expect(movePanel(l, "props", { groupId: "nope", placement: "left" })).toBe(l);
  });

  it("removes panels and unwraps single-child splits", () => {
    const l = removePanel(removePanel(base(), "layers"), "props");
    expect(l.root.type).toBe("split");
    expect((l.root as { direction: string }).direction).toBe("column");
    expect(panelsIn(l)).toEqual(["canvas", "notes", "output"]);
    const empty = removePanel(removePanel(removePanel(l, "canvas"), "notes"), "output");
    expect(empty.root).toEqual({ type: "group", id: "g-empty", tabs: [], active: "" });
  });

  it("clamps ratios to minimum sizes and reports when nothing fits (C59-T03, C59-T06)", () => {
    const mins = { layers: { minWidth: 200 }, props: { minWidth: 200 }, canvas: { minWidth: 300, minHeight: 200 }, output: { minHeight: 120 } };
    const { layout, fits } = clampRatios(base(), { width: 800, height: 600 }, mins);
    expect(fits).toBe(true);
    const r = (layout.root as { ratios: number[] }).ratios;
    expect(r[0]! * 800).toBeGreaterThanOrEqual(200 - 0.5);
    expect(r[2]! * 800).toBeGreaterThanOrEqual(200 - 0.5);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const tiny = clampRatios(base(), { width: 500, height: 300 }, mins);
    expect(tiny.fits).toBe(false);
    const resized = setRatios(base(), "s1", [2, 6, 2]);
    expect((resized.root as { ratios: number[] }).ratios).toEqual([0.2, 0.6, 0.2]);
  });
});

describe("dock-layout geometry", () => {
  it("derives group rects, split rects and handles from ratios alone", () => {
    const g = layoutGeometry(defaultLayout(["a", "b", "c"]).root);
    expect(g.groups.get("g-main")).toEqual({ x: 0, y: 0, w: 0.7, h: 1 });
    expect(g.groups.get("g-side")).toMatchObject({ x: 0.7, y: 0, h: 1 });
    expect(g.groups.get("g-side")!.w).toBeCloseTo(0.3);
    expect(g.handles).toHaveLength(1);
    expect(g.handles[0]).toMatchObject({ splitId: "s-root", index: 0, direction: "row" });
    expect(g.handles[0]!.rect.x).toBeCloseTo(0.7);
  });
  it("hit-tests tab centres and the nearest edge, and misses outside", () => {
    const g = layoutGeometry(defaultLayout(["a", "b"]).root);
    expect(hitTest(g, 0.35, 0.5)).toEqual({ groupId: "g-main", placement: "tab" });
    expect(hitTest(g, 0.02, 0.5)).toEqual({ groupId: "g-main", placement: "left" });
    expect(hitTest(g, 0.85, 0.05)).toEqual({ groupId: "g-side", placement: "top" });
    expect(hitTest(g, 1.2, 0.5)).toBeNull();
  });
  it("places missing panels in the first group and skips closed ones", () => {
    const l = defaultLayout(["a", "b"]);
    expect(placeMissing(l, ["a", "b", "c", "d"], new Set(["d"])).root).toMatchObject({ children: [{ tabs: ["a", "c"] }, { tabs: ["b"] }] });
    expect(placeMissing(l, ["a", "b"])).toBe(l);
  });
});
