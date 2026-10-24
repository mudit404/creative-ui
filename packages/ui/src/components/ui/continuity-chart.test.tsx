import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContinuityChart, type Snapshot } from "./continuity-chart";

const Q1: Snapshot = { id: "q1", label: "Q1", unit: "%", rows: [{ id: "a", label: "Alpha", value: 40 }, { id: "b", label: "Beta", value: 70 }, { id: "c", label: "Gamma", value: 20 }, { id: "d", label: "Delta", value: null }] };
const Q2: Snapshot = { id: "q2", label: "Q2", unit: "%", rows: [{ id: "a", label: "Alpha", value: 80 }, { id: "b", label: "Beta", value: -10 }, { id: "c", label: "Gamma", value: 20 }, { id: "e", label: "Epsilon", value: 20 }] };
const Q3: Snapshot = { id: "q3", label: "Q3", unit: "%", rows: [{ id: "a", label: "Alpha", value: 5 }, { id: "b", label: "Beta", value: 5 }] };

let roCallback: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
class RO {
  constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
    roCallback = cb;
  }
  observe() {
    queueMicrotask(() => roCallback?.([{ contentRect: { width: 712 } }])); // plot = 712 - 140 - 72 = 500
  }
  unobserve() {}
  disconnect() {}
}
const originalRO = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = originalRO;
});
const flush = () => act(async () => {
  await Promise.resolve();
});
const Chart = (props: Partial<React.ComponentProps<typeof ContinuityChart>>) => <ContinuityChart snapshots={[Q1, Q2]} summary="Share of respondents by option" motion="off" {...props} />;
const bar = (id: string) => document.querySelector(`[data-mark="${id}"] [data-bar]`) as SVGRectElement | null;
const row = (id: string) => document.querySelector(`[data-row="${id}"]`) as HTMLElement;
const rowOrder = () => Array.from(document.querySelectorAll("[data-row]")).map((r) => [r.getAttribute("data-row"), (r as HTMLElement).style.transform]);

describe("ContinuityChart", () => {
  it("renders the summary, a table and keyed marks from a zero baseline with negatives left and null as Not available (C57-T03)", async () => {
    render(<Chart defaultShowTable />);
    await flush();
    expect(screen.getByText("Share of respondents by option")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Value (%)" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Delta/ })).toHaveTextContent("Not available");
    // domain shared across snapshots: [-10, 80] over 500px → zero at 500·10/90
    const zero = (500 * 10) / 90;
    expect(Number(bar("a")!.getAttribute("x"))).toBeCloseTo(zero);
    expect(Number(bar("a")!.getAttribute("width"))).toBeCloseTo((500 * 40) / 90); // 40% of the 90-unit span
    expect(bar("d")).toBeNull();
    expect(document.querySelector('[data-mark="d"] text')).toHaveTextContent("Not available");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Snapshot" }), "q2");
    expect(Number(bar("b")!.getAttribute("x"))).toBe(0); // −10 extends left of zero
    expect(Number(bar("b")!.getAttribute("width"))).toBeCloseTo(zero);
    expect(row("a")).toHaveTextContent("80 %");
  });

  it("keeps identity and colour across sorting and snapshot replacement (C57-T01, C57-T05)", async () => {
    render(<Chart />);
    await flush();
    const colorA = bar("a")!.getAttribute("fill");
    const colorB = bar("b")!.getAttribute("fill");
    expect(colorA).not.toBe(colorB);
    // ranking: Beta (70) first in Q1
    expect(rowOrder().map(([id]) => id)).toEqual(["b", "a", "c", "d"]);
    expect(row("b").style.transform).toContain("translateY(0px)");
    expect(row("a").style.transform).toContain("translateY(28px)");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Snapshot" }), "q2");
    // Alpha (80) now first; Beta last; Delta removed; Epsilon added — nobody borrows a mark
    expect(rowOrder().map(([id]) => id)).toEqual(["a", "c", "e", "b"]);
    expect(bar("a")!.getAttribute("fill")).toBe(colorA);
    expect(bar("b")!.getAttribute("fill")).toBe(colorB);
    expect(bar("e")!.getAttribute("fill")).not.toBe(colorA);
    expect(document.querySelector('[data-mark="d"]')).toBeNull();
    expect(row("a").style.transform).toContain("translateY(0px)");
  });

  it("bars-to-dots preserves every endpoint's data coordinate (C57-T02)", async () => {
    render(<Chart />);
    await flush();
    const endA = Number(bar("a")!.getAttribute("x")) + Number(bar("a")!.getAttribute("width")); // 300
    await userEvent.click(screen.getByRole("button", { name: "dots" }));
    expect(document.querySelector('[data-slot="continuity-chart"]')).toHaveAttribute("data-mode", "dots");
    expect(Number(bar("a")!.getAttribute("x")) + 6).toBe(endA);
    expect(bar("a")!.getAttribute("width")).toBe("12");
    expect(bar("a")!.getAttribute("rx")).toBe("6");
    expect(row("a")).toHaveTextContent("Alpha"); // labels never disappear
  });

  it("a units mismatch fails to a table with a diagnostic (C57-T04, C57-T10)", async () => {
    render(<Chart snapshots={[Q1, { ...Q2, unit: "pts" }]} />);
    await flush();
    expect(document.querySelector('[data-slot="continuity-chart"]')).toHaveAttribute("data-state", "table-only");
    expect(screen.getByRole("note")).toHaveTextContent("different units");
    expect(document.querySelector("[data-chart]")).toBeNull();
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByRole("button", { name: "dots" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Chart unavailable");
  });

  it("three rapid snapshot selections settle on the last one (C57-T06)", async () => {
    render(<Chart snapshots={[Q1, Q2, Q3]} />);
    await flush();
    const select = screen.getByRole("combobox", { name: "Snapshot" });
    await userEvent.selectOptions(select, "q2");
    await userEvent.selectOptions(select, "q3");
    await userEvent.selectOptions(select, "q1");
    expect(select).toHaveValue("q1");
    expect(rowOrder().map(([id]) => id)).toEqual(["b", "a", "c", "d"]);
    expect(row("b")).toHaveTextContent("70 %");
  });

  it("tooltips, labels and table show authoritative values; the transitioning label never shows a number (C57-T07)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Chart motion="auto" />);
    await flush();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Snapshot" }), "q2");
    expect(screen.getByRole("status")).toHaveTextContent("Transitioning…");
    expect(document.querySelector('[data-slot="continuity-chart"]')).toHaveAttribute("data-state", "morphing");
    expect(screen.getByRole("button", { name: "Alpha: 80 %" })).toHaveAttribute("title", "Alpha: 80 %");
    expect(within(screen.getByRole("table", { hidden: true })).getByRole("row", { name: /Alpha/, hidden: true })).toHaveTextContent("80 %");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Q2, 4 categories");
    vi.useRealTimers();
  });

  it("reduced motion removes positional animation but keeps all controls (C57-T08)", async () => {
    render(<Chart motion="reduced" />);
    await flush();
    expect(document.querySelector('[data-slot="continuity-chart"]')).toHaveAttribute("data-motion", "reduced");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Snapshot" }), "q2");
    expect(screen.getByRole("status")).not.toHaveTextContent("Transitioning");
    expect(row("a").style.transform).toContain("translateY(0px)");
    await userEvent.click(screen.getByRole("button", { name: "dots" }));
    expect(bar("a")!.getAttribute("width")).toBe("12");
    await userEvent.click(screen.getByRole("button", { name: "Show table" }));
    expect(screen.getByRole("table")).toBeVisible();
  });

  it("ties keep a stable order across renders and selection highlights a row (C57-T09)", async () => {
    const { rerender } = render(<Chart snapshots={[Q3]} />);
    await flush();
    expect(rowOrder().map(([id]) => id)).toEqual(["a", "b"]);
    rerender(<Chart snapshots={[{ ...Q3, rows: [Q3.rows[1]!, Q3.rows[0]!] }]} />);
    expect(rowOrder().map(([id]) => id)).toEqual(["a", "b"]); // tie → id order, regardless of input order
    await userEvent.click(screen.getByRole("button", { name: "Beta: 5 %" }));
    expect(screen.getByRole("button", { name: "Beta: 5 %" })).toHaveAttribute("aria-pressed", "true");
    expect(bar("a")!.getAttribute("opacity")).toBe("0.35");
  });

  it("is controlled for snapshot and mode", async () => {
    const onSnap = vi.fn();
    const onMode = vi.fn();
    render(<Chart snapshotId="q1" onSnapshotChange={onSnap} mode="bars" onModeChange={onMode} />);
    await flush();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Snapshot" }), "q2");
    expect(onSnap).toHaveBeenCalledWith("q2");
    expect(screen.getByRole("combobox", { name: "Snapshot" })).toHaveValue("q1");
    await userEvent.click(screen.getByRole("button", { name: "dots" }));
    expect(onMode).toHaveBeenCalledWith("dots");
    expect(document.querySelector('[data-slot="continuity-chart"]')).toHaveAttribute("data-mode", "bars");
  });
});
