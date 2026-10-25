import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CompareWorkbench, type AttributeDefinition, type CompareItem, type CompareWorkbenchHandle } from "./compare-workbench";

const attributes: AttributeDefinition[] = [
  { key: "weight", label: "Weight", group: "Specs", unit: "g", kind: "number" },
  { key: "wifi", label: "Wi-Fi", group: "Specs", kind: "boolean" },
  { key: "ports", label: "Ports", group: "Specs", kind: "number" },
  { key: "price", label: "Price", group: "Price", unit: "USD", kind: "number" },
];

const items: CompareItem[] = [
  { id: "a", name: "Alpha", image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", attributes: { weight: 500, wifi: false, ports: 0, price: 99 } },
  { id: "b", name: "Beta", attributes: { weight: { value: 500, unit: "oz" }, wifi: { availability: "unknown" }, ports: 0, price: 99 } },
  { id: "c", name: "Gamma", attributes: { weight: 500, wifi: { availability: "not-applicable" }, ports: 2, price: { value: 99, unit: "EUR" } } },
  { id: "d", name: "Delta", attributes: { weight: 600, wifi: true, ports: 1, price: 149 } },
  { id: "e", name: "Epsilon", attributes: { weight: 700, wifi: true, ports: 3, price: 199 } },
];

const NAMES: Record<string, string> = { Alpha: "a", Beta: "b", Gamma: "c", Delta: "d", Epsilon: "e" };
const cb = (name: string) => within(document.querySelector(`[data-item="${NAMES[name]}"]`) as HTMLElement).getByRole("checkbox", { name: "Compare" });
const colHeaders = () => within(screen.getByRole("table").querySelector("thead") as HTMLElement).getAllByRole("columnheader");

describe("CompareWorkbench", () => {
  it("keeps card checkboxes and the tray consistent (C49-T01)", async () => {
    const onChange = vi.fn();
    render(<CompareWorkbench items={items} attributes={attributes} onSelectedIdsChange={onChange} motion="off" />);
    const tray = screen.getByRole("group", { name: "Selected for comparison" });
    await userEvent.click(cb("Alpha"));
    expect(onChange).toHaveBeenLastCalledWith(["a"], "select");
    expect(cb("Alpha")).toBeChecked();
    expect(within(tray).getByText("Alpha")).toBeInTheDocument();
    expect(within(tray).getByText("1/4 selected")).toBeInTheDocument();
    await userEvent.click(within(tray).getByRole("button", { name: "Remove Alpha from comparison" }));
    expect(onChange).toHaveBeenLastCalledWith([], "remove");
    expect(cb("Alpha")).not.toBeChecked();
    expect(within(tray).queryByText("Alpha")).toBeNull();
  });

  it("explains the limit instead of silently dropping an item (C49-T02)", async () => {
    const onLimit = vi.fn();
    const onChange = vi.fn();
    render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "b", "c", "d"]} onLimitReached={onLimit} onSelectedIdsChange={onChange} motion="off" />);
    await userEvent.click(cb("Epsilon"));
    expect(onLimit).toHaveBeenCalledWith("e");
    expect(onChange).not.toHaveBeenCalled();
    expect(cb("Epsilon")).not.toBeChecked();
    expect(cb("Alpha")).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(/up to 4 items.*Remove one.*Epsilon/);
  });

  it("marks matching numbers with different units as not comparable (C49-T03)", async () => {
    render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "b"]} defaultOpen motion="off" />);
    const weight = document.querySelector('[data-row="weight"]')!;
    expect(weight).toHaveAttribute("data-equality", "incomparable");
    expect(within(weight as HTMLElement).getByText("not comparable")).toBeInTheDocument();
    expect(document.querySelector('[data-row="ports"]')).toHaveAttribute("data-equality", "equal");
  });

  it("keeps false, zero, unknown and not-applicable distinct (C49-T04)", () => {
    render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "b", "c"]} defaultOpen motion="off" />);
    const wifi = document.querySelector('[data-row="wifi"]') as HTMLElement;
    const cells = within(wifi).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual(["No", "—", "n/a"]);
    expect(within(wifi).getByLabelText("Not provided")).toBeInTheDocument();
    expect(within(wifi).getByLabelText("Not applicable")).toBeInTheDocument();
    const ports = document.querySelector('[data-row="ports"]') as HTMLElement;
    expect(within(ports).getAllByRole("cell").map((c) => c.textContent)).toEqual(["0", "0", "2"]);
    expect(ports).toHaveAttribute("data-equality", "different");
  });

  it("differences-only hides only proven-equal rows (C49-T05)", async () => {
    render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "b"]} defaultOpen motion="off" />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Differences only/ }));
    expect(document.querySelector('[data-row="ports"]')).toBeNull(); // equal → hidden
    expect(document.querySelector('[data-row="price"]')).toBeNull(); // equal → hidden
    expect(document.querySelector('[data-row="weight"]')).not.toBeNull(); // incomparable stays
    expect(document.querySelector('[data-row="wifi"]')).not.toBeNull(); // unknown stays
    expect(screen.getByText("(2 equal hidden)")).toBeInTheDocument();
  });

  it("drops a removed source item from the selection and announces it, with no orphan column (C49-T06)", () => {
    const onChange = vi.fn();
    const { rerender } = render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "b", "c"]} defaultOpen onSelectedIdsChange={onChange} motion="off" />);
    expect(colHeaders()).toHaveLength(4);
    rerender(<CompareWorkbench items={items.filter((i) => i.id !== "b")} attributes={attributes} defaultSelectedIds={["a", "b", "c"]} defaultOpen onSelectedIdsChange={onChange} motion="off" />);
    expect(colHeaders().map((h) => h.textContent)).toEqual(["Attribute", expect.stringContaining("Alpha"), expect.stringContaining("Gamma")]);
    expect(screen.getByRole("status")).toHaveTextContent(/no longer available/);
    expect(screen.getByText("Comparing 2 items")).toBeInTheDocument();
  });

  it("falls back to guidance instead of a broken table below the minimum", async () => {
    render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "b"]} defaultOpen motion="off" />);
    await userEvent.click(screen.getAllByRole("button", { name: "Remove Beta from comparison" })[0]!);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/1 item selected/)).toBeInTheDocument();
    expect(cb("Alpha")).toBeChecked(); // remaining selection retained
  });

  it("lets narrow viewports compare any pair of the selected set (C49-T07)", async () => {
    const ro = globalThis.ResizeObserver;
    class RO {
      constructor(private cb: ResizeObserverCallback) {}
      observe(el: Element) {
        Object.defineProperty(el, "clientWidth", { value: 360, configurable: true });
        this.cb([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
    try {
      render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "b", "c", "d"]} defaultOpen motion="off" />);
      expect(document.querySelector('[data-slot="compare-workbench"]')).toHaveAttribute("data-narrow", "true");
      const headers = () => colHeaders().slice(1).map((h) => h.textContent);
      expect(headers()).toEqual([expect.stringContaining("Alpha"), expect.stringContaining("Beta")]);
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "Second item to compare" }), "d");
      expect(headers()).toEqual([expect.stringContaining("Alpha"), expect.stringContaining("Delta")]);
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "First item to compare" }), "c");
      expect(headers()).toEqual([expect.stringContaining("Gamma"), expect.stringContaining("Delta")]);
      // choosing the same item on both selectors swaps rather than duplicating
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "First item to compare" }), "d");
      const h = headers();
      expect(h[0]).toContain("Delta");
      expect(h[1]).not.toContain("Delta");
    } finally {
      globalThis.ResizeObserver = ro;
    }
  });

  it("uses semantic headers for both axes and moves focus to the heading on Compare (C49-T08)", async () => {
    render(<CompareWorkbench items={items} attributes={attributes} defaultSelectedIds={["a", "d"]} motion="off" />);
    expect(screen.queryByRole("table")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Compare (2)" }));
    const heading = screen.getByRole("heading", { name: "Comparing 2 items" });
    expect(heading).toHaveFocus();
    const table = screen.getByRole("table");
    const heads = within(table.querySelector("thead") as HTMLElement).getAllByRole("columnheader");
    expect(heads[1]).toHaveAttribute("scope", "col");
    expect(heads[1]).toHaveTextContent("Alpha");
    const rowHeader = within(document.querySelector('[data-row="price"]') as HTMLElement).getByRole("rowheader");
    expect(rowHeader).toHaveAttribute("scope", "row");
    expect(rowHeader).toHaveTextContent("Price");
    expect(screen.getByRole("rowheader", { name: "Specs" })).toHaveAttribute("scope", "rowgroup");
    expect(screen.getByRole("region", { name: "Comparison table" })).toBeInTheDocument();
  });

  it("selection and comparison work with failed images (C49-T09)", async () => {
    const broken = items.map((i) => ({ ...i, image: "https://invalid.invalid/x.png" }));
    render(<CompareWorkbench items={broken} attributes={attributes} motion="off" />);
    for (const img of Array.from(document.querySelectorAll("img"))) img.dispatchEvent(new Event("error"));
    await userEvent.click(cb("Alpha"));
    await userEvent.click(cb("Beta"));
    await userEvent.click(screen.getByRole("button", { name: "Compare (2)" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("reduced motion keeps selection, focus and the table, with no flying clone (C49-T10)", async () => {
    render(<CompareWorkbench items={items} attributes={attributes} motion="reduced" />);
    await userEvent.click(cb("Alpha"));
    await userEvent.click(cb("Gamma"));
    expect(document.querySelectorAll("img.fixed")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Compare (2)" }));
    expect(screen.getByRole("heading", { name: "Comparing 2 items" })).toHaveFocus();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="compare-workbench"]')).toHaveAttribute("data-motion", "reduced");
  });

  it("is controlled: a refused proposal leaves the checkbox unchecked", async () => {
    function Host() {
      const [ids, setIds] = useState<string[]>([]);
      return <CompareWorkbench items={items} attributes={attributes} selectedIds={ids} onSelectedIdsChange={(next) => setIds(next.filter((id) => id !== "b"))} motion="off" />;
    }
    render(<Host />);
    await userEvent.click(cb("Beta"));
    expect(cb("Beta")).not.toBeChecked();
    await userEvent.click(cb("Alpha"));
    expect(cb("Alpha")).toBeChecked();
  });

  it("exposes focusComparison through the ref", async () => {
    const ref = { current: null as CompareWorkbenchHandle | null };
    render(<CompareWorkbench ref={ref} items={items} attributes={attributes} defaultSelectedIds={["a", "b"]} defaultOpen motion="off" />);
    act(() => ref.current!.focusComparison());
    expect(screen.getByRole("heading", { name: "Comparing 2 items" })).toHaveFocus();
  });
});
