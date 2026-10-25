import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { DockWorkspace, type DockLayout, type DockPanel, type DockWorkspaceHandle } from "./dock-workspace";
import { allGroups, groupOf, panelsIn } from "@/lib/dock-layout";

/** A panel with its own form state, to prove it survives moves (C59-T09). */
function Draft({ id }: { id: string }) {
  const [text, setText] = React.useState("");
  return <textarea aria-label={`${id} draft`} value={text} onChange={(e) => setText(e.target.value)} />;
}
const PANELS: DockPanel[] = [
  { id: "canvas", title: "Canvas", render: () => <div>Canvas body</div>, minWidth: 200 },
  { id: "layers", title: "Layers", render: () => <div>Layers body</div> },
  { id: "props", title: "Properties", render: () => <Draft id="props" /> },
  { id: "output", title: "Output", render: () => <div>Output body</div> },
  { id: "notes", title: "Notes", render: () => <div>Notes body</div>, closable: false },
];
const studio = (): DockLayout => ({
  schemaVersion: 1,
  root: {
    type: "split",
    id: "s-root",
    direction: "row",
    ratios: [0.6, 0.4],
    children: [
      { type: "group", id: "g-main", tabs: ["canvas"], active: "canvas" },
      { type: "group", id: "g-side", tabs: ["layers", "props", "output", "notes"], active: "layers" },
    ],
  },
});

let container = { width: 1200, height: 600 };
class RO {
  cb: () => void;
  constructor(cb: () => void) {
    this.cb = cb;
  }
  observe(el: Element) {
    Object.defineProperty(el, "clientWidth", { get: () => container.width, configurable: true });
    Object.defineProperty(el, "clientHeight", { get: () => container.height, configurable: true });
    queueMicrotask(() => act(() => this.cb()));
  }
  unobserve() {}
  disconnect() {}
}
const originalRO = globalThis.ResizeObserver;
beforeEach(() => {
  container = { width: 1200, height: 600 };
  globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const slot = this.getAttribute("data-slot");
    if (slot === "dock-workspace") return { left: 0, top: 0, width: container.width, height: container.height, right: container.width, bottom: container.height, x: 0, y: 0, toJSON() {} } as DOMRect;
    return { left: 10, top: 10, width: 40, height: 24, right: 50, bottom: 34, x: 10, y: 10, toJSON() {} } as DOMRect;
  });
});
afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  vi.restoreAllMocks();
});
const root = () => document.querySelector('[data-slot="dock-workspace"]')!;
const tab = (name: string) => screen.getByRole("tab", { name });
const ready = () => waitFor(() => expect(root()).toHaveAttribute("data-state", "ready"));
const drag = (name: string, to: { x: number; y: number }, release = true) => {
  const t = tab(name);
  fireEvent.pointerDown(t, { button: 0, pointerId: 1, clientX: 20, clientY: 10 });
  fireEvent.pointerMove(t, { pointerId: 1, clientX: 30, clientY: 20 });
  fireEvent.pointerMove(t, { pointerId: 1, clientX: to.x, clientY: to.y });
  if (release) fireEvent.pointerUp(t, { pointerId: 1, clientX: to.x, clientY: to.y });
};

describe("DockWorkspace", () => {
  it("a drag released outside valid targets leaves layout and persistence unchanged (C59-T01, C59-T08)", async () => {
    const onChange = vi.fn();
    render(<DockWorkspace panels={PANELS} defaultLayout={studio()} onLayoutChange={onChange} motion="off" />);
    await ready();
    drag("Layers", { x: 300, y: 300 }, false);
    expect(root()).toHaveAttribute("data-state", "previewing");
    expect(document.querySelector("[data-preview]")).toHaveAttribute("data-valid", "true");
    expect(onChange).not.toHaveBeenCalled(); // previews never persist
    fireEvent.pointerMove(tab("Layers"), { pointerId: 1, clientX: 2000, clientY: 300 }); // outside
    expect(document.querySelector("[data-preview]")).toHaveAttribute("data-valid", "false");
    fireEvent.pointerUp(tab("Layers"), { pointerId: 1, clientX: 2000, clientY: 300 });
    expect(onChange).not.toHaveBeenCalled();
    expect(root()).toHaveAttribute("data-state", "ready");
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    // Escape cancels too
    drag("Layers", { x: 300, y: 300 }, false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(root()).toHaveAttribute("data-state", "ready");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("menu Move left produces the same structure as dragging to the left edge (C59-T02)", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const { unmount } = render(<DockWorkspace panels={PANELS} defaultLayout={studio()} onLayoutChange={a} motion="off" />);
    await ready();
    // drag "Output" to the left edge of the main group
    drag("Output", { x: 20, y: 300 });
    expect(a).toHaveBeenCalledTimes(1);
    const dragged = a.mock.calls[0]![0] as DockLayout;
    expect(a.mock.calls[0]![1]).toEqual({ reason: "move", panelId: "output" });
    unmount();
    render(<DockWorkspace panels={PANELS} defaultLayout={studio()} onLayoutChange={b} motion="off" />);
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Output panel menu" }));
    // "Move left" relative to Output's own group would split the side group; use Join → then Move left on the main group
    await userEvent.click(screen.getByRole("menuitem", { name: "Join Canvas" }));
    await userEvent.click(screen.getByRole("button", { name: "Output panel menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Move left" }));
    const viaMenu = b.mock.calls.at(-1)![0] as DockLayout;
    const shape = (l: DockLayout) => JSON.stringify(l.root, (k, v) => (k === "id" ? undefined : v));
    expect(shape(viaMenu)).toBe(shape(dragged));
    expect(allGroups(viaMenu.root).map((g) => g.tabs)).toEqual([["output"], ["canvas"], ["layers", "props", "notes"]]);
    expect(tab("Output")).toHaveFocus(); // focus follows the moved panel (C59-T07)
  });

  it("resizing keeps minimum sizes by pointer and keyboard, and viewport reduction clamps or compacts (C59-T03, C59-T06)", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DockWorkspace panels={PANELS} defaultLayout={studio()} onLayoutChange={onChange} motion="off" />);
    await ready();
    const handle = screen.getByRole("separator", { name: "Resize columns" });
    expect(handle).toHaveAttribute("aria-valuenow", "60");
    // drag the divider far left: canvas (minWidth 200) must keep 200px of 1200
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 720, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 300 });
    expect(onChange).not.toHaveBeenCalled(); // preview only
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 0, clientY: 300 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const after = onChange.mock.calls[0]![0] as DockLayout;
    expect(after.root.type).toBe("split");
    if (after.root.type === "split") expect(after.root.ratios[0]! * 1200).toBeCloseTo(200, 3);
    expect(onChange.mock.calls[0]![1]).toEqual({ reason: "resize" });
    // keyboard: one step right = 24px
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    const stepped = onChange.mock.calls[1]![0] as DockLayout;
    if (stepped.root.type === "split") expect(stepped.root.ratios[0]! * 1200).toBeCloseTo(224, 3);
    // a 2000px-wide canvas minimum cannot fit a 1200px container → compact
    rerender(<DockWorkspace panels={[{ ...PANELS[0]!, minWidth: 2000 }, ...PANELS.slice(1)]} defaultLayout={studio()} onLayoutChange={onChange} motion="off" />);
    await waitFor(() => expect(root()).toHaveAttribute("data-compact", "true"));
    expect(screen.getByRole("status")).toHaveTextContent("do not fit");
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });

  it("a rejected dirty-panel close keeps panel and unsaved content; an accepted close removes it and moves focus (C59-T04, C59-T07)", async () => {
    let allow = false;
    const onBeforeClose = vi.fn(async () => allow);
    const onChange = vi.fn();
    render(<DockWorkspace panels={PANELS} defaultLayout={studio()} onBeforeClose={onBeforeClose} onLayoutChange={onChange} motion="off" />);
    await ready();
    await userEvent.click(tab("Properties"));
    await userEvent.type(screen.getByRole("textbox", { name: "props draft" }), "unsaved words");
    await userEvent.click(screen.getByRole("button", { name: "Properties panel menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Close" }));
    await waitFor(() => expect(onBeforeClose).toHaveBeenCalledWith("props"));
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "ready"));
    expect(tab("Properties")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "props draft" })).toHaveValue("unsaved words");
    expect(screen.getByRole("status")).toHaveTextContent("declined the close");
    expect(onChange).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reason: "close" }));
    allow = true;
    await userEvent.click(screen.getByRole("button", { name: "Properties panel menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Properties" })).toBeNull());
    const next = onChange.mock.calls.at(-1)![0] as DockLayout;
    expect(panelsIn(next)).not.toContain("props");
    expect(onChange.mock.calls.at(-1)![1]).toEqual({ reason: "close", panelId: "props" });
    expect(tab("Output")).toHaveFocus(); // the neighbouring tab
    // the non-closable panel has no Close item
    await userEvent.click(screen.getByRole("button", { name: "Notes panel menu" }));
    expect(screen.queryByRole("menuitem", { name: "Close" })).toBeNull();
  });

  it("unknown, duplicate or cyclic persisted layouts recover to the default with a reason (C59-T05)", async () => {
    const onChange = vi.fn();
    const bad: DockLayout = { schemaVersion: 1, root: { type: "split", id: "s", direction: "row", ratios: [0.5, 0.5], children: [{ type: "group", id: "g1", tabs: ["canvas", "ghost"], active: "canvas" }, { type: "group", id: "g2", tabs: ["canvas"], active: "canvas" }] } };
    render(<DockWorkspace panels={PANELS} defaultLayout={bad} onLayoutChange={onChange} motion="off" />);
    await ready();
    expect(root()).toHaveAttribute("data-recovered", "true");
    expect(screen.getByRole("status")).toHaveTextContent("could not be restored");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![1]).toMatchObject({ reason: "recover", problems: expect.arrayContaining([expect.stringMatching(/Unknown panel id "ghost"/), expect.stringMatching(/Duplicate panel id "canvas"/)]) });
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    // a cycle
    const cyc = { schemaVersion: 1, root: { type: "split", id: "s", direction: "row", ratios: [1], children: [] as unknown[] } };
    cyc.root.children.push(cyc.root);
    const { container: c2 } = render(<DockWorkspace panels={PANELS} layout={cyc as unknown as DockLayout} label="Cyclic" motion="off" />);
    expect(c2.querySelector('[data-slot="dock-workspace"]')).toHaveAttribute("data-recovered", "true");
  });

  it("is compact below the breakpoint with the same panels, and panels stay mounted across moves and tab switches (C59-T06, C59-T09)", async () => {
    const onChange = vi.fn();
    const { unmount } = render(<DockWorkspace panels={PANELS} defaultLayout={studio()} onLayoutChange={onChange} motion="off" />);
    await ready();
    await userEvent.click(tab("Properties"));
    const area = screen.getByRole("textbox", { name: "props draft" });
    await userEvent.type(area, "kept");
    await userEvent.click(tab("Layers")); // hidden, still mounted
    expect(screen.getByRole("textbox", { name: "props draft", hidden: true })).toBe(area);
    // move Properties into the main group via drag: same element, same value
    drag("Properties", { x: 360, y: 300 });
    expect(groupOf(onChange.mock.calls.at(-1)![0] as DockLayout, "props")?.id).toBe("g-main");
    expect(screen.getByRole("textbox", { name: "props draft" })).toBe(area);
    expect(area).toHaveValue("kept");
    // narrow container → compact: same panels, one tablist, one visible panel
    unmount();
    container = { width: 500, height: 600 };
    render(<DockWorkspace panels={PANELS} defaultLayout={studio()} motion="off" />);
    await waitFor(() => expect(root()).toHaveAttribute("data-compact", "true"));
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getAllByRole("tabpanel").filter((p) => !p.hidden)).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Compact");
    await userEvent.click(tab("Notes"));
    expect(screen.getByText("Notes body")).toBeVisible();
  });

  it("exposes focusPanel and resetLayout and reports active-panel changes", async () => {
    const ref = { current: null as DockWorkspaceHandle | null };
    const onActive = vi.fn();
    const onChange = vi.fn();
    render(<DockWorkspace ref={ref} panels={PANELS} defaultLayout={studio()} onActivePanelChange={onActive} onLayoutChange={onChange} motion="off" />);
    await ready();
    act(() => ref.current!.focusPanel("output"));
    expect(onActive).toHaveBeenCalledWith("output");
    await waitFor(() => expect(tab("Output")).toHaveFocus());
    expect(onChange.mock.calls.at(-1)![1]).toEqual({ reason: "activate", panelId: "output" });
    act(() => ref.current!.resetLayout());
    expect(onChange.mock.calls.at(-1)![1]).toEqual({ reason: "reset" });
    const l = onChange.mock.calls.at(-1)![0] as DockLayout;
    expect(allGroups(l.root).map((g) => g.id)).toEqual(["g-main", "g-side"]);
  });

  it("controlled layout stays authoritative: a move only proposes", async () => {
    const onChange = vi.fn();
    render(<DockWorkspace panels={PANELS} layout={studio()} onLayoutChange={onChange} motion="off" />);
    await ready();
    drag("Output", { x: 20, y: 300 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(allGroups(studio().root)).toHaveLength(2);
    expect(screen.getAllByRole("tablist")).toHaveLength(2); // parent did not apply it
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });
});
