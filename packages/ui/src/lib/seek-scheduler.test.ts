import { describe, expect, it, vi } from "vitest";
import { activeChapter, createSeekScheduler, fractionToTime, scrollFraction, validateChapters } from "./seek-scheduler";

describe("seek scheduler", () => {
  it("keeps one seek in flight and only the latest pending target (C50-T02)", () => {
    const seeks: number[] = [];
    const s = createSeekScheduler({ seek: (t) => seeks.push(t) });
    s.request(1);
    s.request(2);
    s.request(3);
    s.request(4);
    expect(seeks).toEqual([1]);
    expect(s.state()).toMatchObject({ requested: 4, presented: null, seeking: true });
    s.onSeeked(1);
    expect(seeks).toEqual([1, 4]); // 2 and 3 were never issued
    expect(s.state()).toMatchObject({ requested: 4, presented: 1, seeking: true });
    s.onSeeked(4);
    expect(s.state()).toMatchObject({ requested: 4, presented: 4, seeking: false });
    s.request(4); // already there: no seek
    expect(seeks).toHaveLength(2);
  });

  it("releases a seek that never reports back after the timeout, without inventing a presented time", () => {
    vi.useFakeTimers();
    const seeks: number[] = [];
    const s = createSeekScheduler({ seek: (t) => seeks.push(t) }, { timeoutMs: 100 });
    s.request(0);
    s.request(5);
    expect(seeks).toEqual([0]);
    vi.advanceTimersByTime(120);
    expect(seeks).toEqual([0, 5]);
    expect(s.state()).toMatchObject({ requested: 5, presented: null, seeking: true });
    s.onSeeked(5);
    expect(s.state()).toMatchObject({ presented: 5, seeking: false });
    vi.useRealTimers();
  });

  it("distinguishes requested from presented time and reports subscribers (C50-T06)", () => {
    const states: string[] = [];
    const s = createSeekScheduler({ seek: () => {} });
    s.subscribe((st) => states.push(`${st.requested}/${st.presented}/${st.seeking}`));
    s.request(2.5);
    s.onPresented(2.4);
    s.onSeeked(2.5);
    expect(states).toEqual(["2.5/null/true", "2.5/2.4/true", "2.5/2.5/false"]);
  });

  it("ignores callbacks from a previous generation after reset (C50-T03)", () => {
    const seeks: number[] = [];
    const s = createSeekScheduler({ seek: (t) => seeks.push(t) });
    s.request(5);
    const gen = s.state().generation;
    const next = s.reset();
    expect(next).toBe(gen + 1);
    s.onSeeked(5, gen); // stale
    expect(s.state()).toMatchObject({ requested: null, presented: null, seeking: false });
    s.request(1);
    s.onSeeked(1, next);
    expect(s.state().presented).toBe(1);
    expect(seeks).toEqual([5, 1]);
  });

  it("clamps fractions into the video range and scroll progress into [0,1] (C50-T01)", () => {
    expect(fractionToTime(-1, [2, 12])).toBe(2);
    expect(fractionToTime(2, [2, 12])).toBe(12);
    expect(fractionToTime(0.5, [2, 12])).toBe(7);
    expect(fractionToTime(Number.NaN, [2, 12])).toBe(2);
    expect(scrollFraction(150, 100, 300)).toBe(0.25);
    expect(scrollFraction(-50, 100, 300)).toBe(0);
    expect(scrollFraction(999, 100, 300)).toBe(1);
    expect(scrollFraction(10, 100, 100)).toBe(0);
  });

  it("validates chapters and the range; a nonfinite duration is unsupported (C50-T07)", () => {
    expect(validateChapters([], [0, Infinity])[0]).toMatch(/nonfinite/);
    expect(validateChapters([{ id: "a", label: "A", startTime: 0, endTime: 4 }, { id: "b", label: "B", startTime: 3 }], [0, 12])).toEqual(['Chapter "b" overlaps the previous chapter.']);
    expect(validateChapters([{ id: "a", label: "A", startTime: 5, endTime: 2 }], [0, 12])).toEqual(['Chapter "a" has an invalid time.']);
    const ch = [{ id: "a", label: "A", startTime: 0, endTime: 4 }, { id: "b", label: "B", startTime: 4, endTime: 8 }, { id: "c", label: "C", startTime: 8 }];
    expect(validateChapters(ch, [0, 12])).toEqual([]);
    expect(activeChapter(ch, 0)?.id).toBe("a");
    expect(activeChapter(ch, 4)?.id).toBe("b");
    expect(activeChapter(ch, 11.9)?.id).toBe("c");
  });
});
