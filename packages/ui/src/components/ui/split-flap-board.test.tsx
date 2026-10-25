import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { SplitFlapBoard } from "./split-flap-board";

const faces = () => Array.from(document.querySelectorAll("[data-cell]")).map((c) => (c.querySelector("[data-bottom] span") as HTMLElement).textContent);
const phases = () => Array.from(document.querySelectorAll("[data-cell]")).map((c) => c.getAttribute("data-phase"));
const root = () => document.querySelector('[data-slot="split-flap-board"]')!;
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SplitFlapBoard", () => {
  it("SSR/initial render shows the real value in one accessible string, not spinning blanks (C47-T03, C47-T07)", () => {
    render(<SplitFlapBoard value="GATE 12" label="Gate" motion="off" />);
    expect(screen.getByLabelText("Gate")).toHaveTextContent("GATE 12");
    expect(document.querySelectorAll("[data-cell]")).toHaveLength(7);
    expect(faces().join("")).toBe("GATE 12");
    expect(root()).toHaveAttribute("data-state", "settled");
    // the mechanical faces are hidden from the accessibility tree
    expect(document.querySelector("[data-faces]")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryAllByText("G", { ignore: "[aria-hidden] *" })).toHaveLength(0);
  });

  it("only changed cells animate, with a hidden-midpoint swap (C47-T02)", () => {
    const { rerender } = render(<SplitFlapBoard value="ABC" motion="auto" />);
    rerender(<SplitFlapBoard value="AXC" motion="auto" />);
    expect(root()).toHaveAttribute("data-state", "flipping");
    expect(phases()).toEqual(["0", "1", "0"]);
    expect(faces()).toEqual(["A", "B", "C"]); // not swapped yet
    tick(100);
    expect(phases()).toEqual(["0", "2", "0"]);
    expect(faces()).toEqual(["A", "X", "C"]);
    tick(100);
    expect(phases()).toEqual(["0", "0", "0"]);
    expect(root()).toHaveAttribute("data-state", "settled");
  });

  it("100 rapid changes settle on the latest value within maxSettle after the last change (C47-T01)", () => {
    const onSettled = vi.fn();
    const { rerender } = render(<SplitFlapBoard value="00" cells={2} motion="auto" onSettled={onSettled} />);
    for (let i = 1; i <= 100; i++) {
      rerender(<SplitFlapBoard value={String(i).padStart(2, "0")} cells={2} motion="auto" onSettled={onSettled} />);
      tick(3);
    }
    expect(screen.getByText("100", { selector: ".sr-only" })).toBeInTheDocument(); // accessible value updates immediately
    tick(600);
    expect(faces().join("")).toBe("10"); // two cells show the first two graphemes of "100" (fixed cell count)
    expect(root()).toHaveAttribute("data-state", "settled");
    expect(onSettled).toHaveBeenLastCalledWith("10");
  });

  it("keeps emoji whole and uses whole-content for shaped scripts (C47-T04, C47-T05)", () => {
    render(<SplitFlapBoard value="A👨‍👩‍👧B" characterSet={["A", "B", "👨‍👩‍👧"]} motion="off" />);
    expect(document.querySelectorAll("[data-cell]")).toHaveLength(3);
    expect(faces()[1]).toBe("👨‍👩‍👧");
    const { unmount } = render(<SplitFlapBoard value="नमस्ते" label="hi" motion="off" />);
    const whole = document.querySelectorAll('[data-slot="split-flap-board"]')[1]!;
    expect(whole).toHaveAttribute("data-variant", "whole");
    expect(whole.querySelectorAll("[data-cell]")).toHaveLength(1);
    expect(screen.getByLabelText("hi")).toHaveTextContent("नमस्ते");
    unmount();
    render(<SplitFlapBoard value="über" label="u" motion="off" />); // ü not in the default set → whole
    expect(document.querySelectorAll('[data-slot="split-flap-board"]')[1]).toHaveAttribute("data-variant", "whole");
  });

  it("paused and reduced motion still reflect fresh data immediately (C47-T06)", () => {
    const { rerender } = render(<SplitFlapBoard value="12" paused motion="auto" />);
    rerender(<SplitFlapBoard value="34" paused motion="auto" />);
    expect(faces().join("")).toBe("34");
    expect(root()).toHaveAttribute("data-state", "settled");
    rerender(<SplitFlapBoard value="56" motion="reduced" />);
    expect(faces().join("")).toBe("56");
    expect(root()).toHaveAttribute("data-motion", "reduced");
    expect(document.querySelector("[data-flap]")).toBeNull();
  });

  it("overflow modes keep the full text accessible; numeric right-aligns and never shows NaN as zero (C47-T08)", () => {
    render(<SplitFlapBoard value="A VERY LONG DEPARTURES LABEL" overflow="ellipsis" label="long" motion="off" />);
    expect(document.querySelector("[data-faces]")).toHaveClass("overflow-hidden");
    expect(screen.getByLabelText("long")).toHaveTextContent("A VERY LONG DEPARTURES LABEL");
    const { unmount } = render(<SplitFlapBoard value={42} variant="numeric" cells={4} label="n" motion="off" />);
    expect(faces().slice(-4)).toEqual([" ", " ", "4", "2"]);
    unmount();
    render(<SplitFlapBoard value={Number.NaN} variant="numeric" label="nan" motion="off" />);
    expect(screen.getByLabelText("nan")).toHaveTextContent("—");
  });

  it("announces once per source change only when enabled, and makes no audio (C47-T09)", () => {
    const { rerender } = render(<SplitFlapBoard value="ON TIME" announce="polite" motion="off" />);
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent("ON TIME");
    rerender(<SplitFlapBoard value="DELAYED" announce="polite" motion="off" />);
    expect(live).toHaveTextContent("DELAYED");
    expect(document.querySelectorAll("[role=status]")).toHaveLength(1);
    expect(document.querySelector("audio")).toBeNull();
    const { unmount } = render(<SplitFlapBoard value="x" motion="off" />);
    expect(document.querySelectorAll("[role=status]")).toHaveLength(1); // announce off by default
    unmount();
  });

  it("clears timers on unmount and exposes the ref", () => {
    const ref = { current: null as null | { root: HTMLDivElement | null; text: HTMLSpanElement | null } };
    const { rerender, unmount } = render(<SplitFlapBoard ref={ref} value="AB" motion="auto" />);
    rerender(<SplitFlapBoard ref={ref} value="CD" motion="auto" />);
    expect(ref.current!.text).toHaveTextContent("CD");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
