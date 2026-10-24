import { describe, expect, it } from "vitest";
import { allocateLanes, clampWindow, formatInZone, linearTimeScale, parseIsoWithOffset, sortEvents, ticksFor, validateEvents, zoomWindow } from "./time-scale";

const H = 36e5;
const domain = [0, 24 * H] as const;

describe("time scale", () => {
  it("maps equal intervals to equal distances (C46-T01)", () => {
    const s = linearTimeScale([0, 10 * H], 1000);
    expect(s.toX(1 * H) - s.toX(0)).toBeCloseTo(s.toX(7 * H) - s.toX(6 * H));
    expect(s.toX(5 * H)).toBe(500);
    expect(s.toMs(250)).toBe(2.5 * H);
  });

  it("clamps windows to the domain and minSpan (C46-T03)", () => {
    expect(clampWindow([-5 * H, 3 * H], domain, 6e4)).toEqual([0, 8 * H]);
    expect(clampWindow([20 * H, 30 * H], domain, 6e4)).toEqual([14 * H, 24 * H]);
    expect(clampWindow([5 * H, 5 * H + 10], domain, 6e4)).toEqual([5 * H, 5 * H + 6e4]);
    expect(clampWindow([-1, 48 * H], domain, 6e4)).toEqual([0, 24 * H]);
  });

  it("zooms around the centre by a factor and respects bounds", () => {
    expect(zoomWindow([4 * H, 8 * H], 0.5, domain, 6e4)).toEqual([5 * H, 7 * H]);
    expect(zoomWindow([4 * H, 8 * H], 2, domain, 6e4)).toEqual([2 * H, 10 * H]);
    expect(zoomWindow([1 * H, 3 * H], 4, domain, 6e4)).toEqual([0, 8 * H]);
    expect(zoomWindow([1 * H, 1 * H + 2 * 6e4], 0.1, domain, 6e4)[1] - zoomWindow([1 * H, 1 * H + 2 * 6e4], 0.1, domain, 6e4)[0]).toBe(6e4);
  });

  it("sorts deterministically and allocates overlap lanes greedily", () => {
    const ev = [
      { id: "b", startMs: 0, endMs: 2 * H, label: "b" },
      { id: "a", startMs: 0, endMs: 2 * H, label: "a" },
      { id: "c", startMs: 1 * H, endMs: 3 * H, label: "c" },
      { id: "d", startMs: 2 * H, label: "d" },
      { id: "e", startMs: 5 * H, label: "e" },
    ];
    expect(sortEvents(ev).map((e) => e.id)).toEqual(["a", "b", "c", "d", "e"]);
    const lanes = allocateLanes(ev);
    expect([...lanes.entries()]).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 0],
      ["e", 0],
    ]);
  });

  it("rejects malformed events with diagnostics and keeps the rest (C46-T10)", () => {
    const { valid, diagnostics } = validateEvents([
      { id: "ok", startMs: 1, label: "ok" },
      { id: "bad", startMs: 5, endMs: 2, label: "bad" },
      { id: "nan", startMs: Number.NaN, label: "nan" },
      { id: "ok", startMs: 3, label: "dup" },
    ]);
    expect(valid.map((e) => e.id)).toEqual(["ok"]);
    expect(diagnostics.map((d) => d.message)).toEqual(['"bad" ends before it starts.', '"nan" has a non-finite start.', 'Duplicate event id "ok".']);
  });

  it("keeps absolute order across a DST boundary while formatting in the zone (C46-T05)", () => {
    // 2026-03-08 06:30Z = 01:30 EST; 07:30Z = 03:30 EDT (02:30 does not exist in New York)
    const before = Date.UTC(2026, 2, 8, 6, 30);
    const after = Date.UTC(2026, 2, 8, 7, 30);
    const sorted = sortEvents([
      { id: "x", startMs: after, label: "x" },
      { id: "y", startMs: before, label: "y" },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["y", "x"]);
    expect(formatInZone(before, "America/New_York", "time")).toBe("01:30");
    expect(formatInZone(after, "America/New_York", "time")).toBe("03:30");
    expect(formatInZone(after, "UTC", "time")).toBe("07:30");
    expect(linearTimeScale([before, after], 100).toX(after)).toBe(100); // one real hour apart
  });

  it("produces aligned ticks and parses only offset-qualified ISO strings", () => {
    const t = ticksFor([0, 6 * H], 6);
    expect(t.map((x) => x.ms)).toEqual([0, H, 2 * H, 3 * H, 4 * H, 5 * H, 6 * H]);
    expect(parseIsoWithOffset("2026-03-08T06:30:00Z")).toBe(Date.UTC(2026, 2, 8, 6, 30));
    expect(parseIsoWithOffset("2026-03-08T01:30:00-05:00")).toBe(Date.UTC(2026, 2, 8, 6, 30));
    expect(parseIsoWithOffset("2026-03-08T02:30")).toBeNull(); // ambiguous local time
    expect(parseIsoWithOffset("yesterday")).toBeNull();
  });
});
