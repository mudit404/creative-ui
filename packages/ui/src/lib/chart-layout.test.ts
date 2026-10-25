import { describe, expect, it } from "vitest";
import { layoutRows, sharedDomain, sortRows, validateSnapshots, valueTicks, type Snapshot } from "./chart-layout";

const A: Snapshot = { id: "a", label: "Q1", unit: "%", rows: [{ id: "x", label: "X", value: 40 }, { id: "y", label: "Y", value: -20 }, { id: "z", label: "Z", value: null }, { id: "w", label: "W", value: 40 }] };
const B: Snapshot = { id: "b", label: "Q2", unit: "%", rows: [{ id: "x", label: "X", value: 80 }, { id: "y", label: "Y", value: 10 }] };

describe("chart layout", () => {
  it("validates units, duplicate ids and non-finite values (C57-T04)", () => {
    expect(validateSnapshots([A, B])).toEqual([]);
    expect(validateSnapshots([A, { ...B, unit: "pts" }])[0]).toMatchObject({ code: "units" });
    expect(validateSnapshots([{ ...A, rows: [...A.rows, { id: "x", label: "dup", value: 1 }] }])[0]).toMatchObject({ code: "duplicate-id" });
    expect(validateSnapshots([{ ...A, rows: [{ id: "n", label: "n", value: Number.NaN }] }])[0]).toMatchObject({ code: "value" });
    expect(validateSnapshots([])[0]).toMatchObject({ code: "empty" });
  });

  it("derives a zero-inclusive shared domain", () => {
    expect(sharedDomain([A, B])).toEqual([-20, 80]);
    expect(sharedDomain([{ ...B, rows: [{ id: "x", label: "X", value: 5 }] }])).toEqual([0, 5]);
    expect(sharedDomain([{ ...B, rows: [{ id: "x", label: "X", value: -3 }] }])).toEqual([-3, 0]);
  });

  it("sorts deterministically with nulls last and id tie-breaks (C57-T09)", () => {
    expect(sortRows(A.rows, "descending").map((r) => r.id)).toEqual(["w", "x", "y", "z"]);
    expect(sortRows(A.rows, "ascending").map((r) => r.id)).toEqual(["y", "w", "x", "z"]);
    expect(sortRows(A.rows, "input").map((r) => r.id)).toEqual(["x", "y", "z", "w"]);
  });

  it("places bars from a zero baseline, negatives to the left, nulls with no length (C57-T03)", () => {
    const g = layoutRows(A.rows, { domain: [-20, 80], width: 500, rowHeight: 20, sort: "input" });
    const byId = Object.fromEntries(g.map((r) => [r.id, r]));
    expect(byId.x!.x0).toBe(100); // zero at 20% of width
    expect(byId.x!.x1).toBe(300);
    expect(byId.y!.x1).toBe(0);
    expect(byId.y!.x1).toBeLessThan(byId.y!.x0);
    expect(byId.z!.x1).toBe(byId.z!.x0);
    expect(byId.w!.y).toBe(60);
    const clipped = layoutRows([{ id: "big", label: "big", value: 500 }], { domain: [0, 100], width: 100, rowHeight: 10, sort: "input" })[0]!;
    expect(clipped.x1).toBe(100);
    expect(clipped.overflow).toBe(true);
  });

  it("endpoints are identical between representations: geometry is mode-independent (C57-T02)", () => {
    const g = layoutRows(B.rows, { domain: [0, 100], width: 200, rowHeight: 24, sort: "descending" });
    expect(g.map((r) => [r.id, r.x1])).toEqual([
      ["x", 160],
      ["y", 20],
    ]);
  });

  it("produces nice ticks", () => {
    expect(valueTicks([0, 100], 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(valueTicks([-20, 80], 5)).toEqual([-20, 0, 20, 40, 60, 80]);
  });
});
