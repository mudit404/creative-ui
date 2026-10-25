import { describe, expect, it } from "vitest";
import { changedCells, fitCells, formatNumeric, graphemes, needsWholeContent, staggerSchedule, supportedByCharacterSet, DEFAULT_CHARACTER_SET } from "./flap-cells";

describe("flap cells", () => {
  it("keeps emoji and combining characters whole (C47-T04)", () => {
    expect(graphemes("A👨‍👩‍👧B")).toEqual(["A", "👨‍👩‍👧", "B"]);
    expect(graphemes("éx")).toEqual(["é", "x"]);
    expect(graphemes("🇬🇧!")).toEqual(["🇬🇧", "!"]);
  });

  it("fits, aligns and detects changed cells only (C47-T02)", () => {
    expect(fitCells(["4", "2"], 4, "right")).toEqual([" ", " ", "4", "2"]);
    expect(fitCells(["A", "B", "C", "D", "E"], 3)).toEqual(["A", "B", "C"]);
    expect(changedCells(["A", "B", "C"], ["A", "X", "C"])).toEqual([1]);
    expect(changedCells(["A"], ["A", "B"])).toEqual([1]);
  });

  it("staggers within the settle budget (C47-T01)", () => {
    const s = staggerSchedule([0, 1, 2, 3], 200, 20, 600);
    expect([...s.values()]).toEqual([0, 20, 40, 60]);
    const many = staggerSchedule(Array.from({ length: 64 }, (_, i) => i), 200, 20, 600);
    expect(Math.max(...many.values()) + 200).toBeLessThanOrEqual(600);
    expect(staggerSchedule([], 200, 20, 600).size).toBe(0);
  });

  it("routes shaped scripts to whole-content and checks the character set (C47-T05)", () => {
    expect(needsWholeContent("नमस्ते")).toBe(true);
    expect(needsWholeContent("GATE 12")).toBe(false);
    expect(supportedByCharacterSet(graphemes("gate 12"), DEFAULT_CHARACTER_SET)).toBe(true);
    expect(supportedByCharacterSet(graphemes("ü"), DEFAULT_CHARACTER_SET)).toBe(false);
  });

  it("never renders invalid numbers as zero", () => {
    expect(formatNumeric(Number.NaN)).toBe("—");
    expect(formatNumeric(42)).toBe("42");
    expect(formatNumeric("07:45")).toBe("07:45");
  });
});
