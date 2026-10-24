import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TransferBoard, type ItemsByContainer, type MoveIntent, type Resolution, type TransferBoardHandle, type TransferContainer, type TransferItem } from "./transfer-board";

const CONTAINERS: TransferContainer[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "Doing", capacity: 2 },
  { id: "done", label: "Done" },
  { id: "archive", label: "Archive", readOnly: true },
];
const ITEMS: TransferItem[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, title: `Task ${id.toUpperCase()}` }));
const BOARD: ItemsByContainer = { todo: ["a", "b", "c"], doing: ["d", "e"], done: [], archive: [] };

/* jsdom has no layout: give rows stacked rects and a hit tester that maps y → container/row */
function layout() {
  const scroller = document.querySelector<HTMLElement>('[data-slot="transfer-board"] .overflow-y-auto');
  if (scroller) scroller.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 600, right: 1200, bottom: 600, x: 0, y: 0, toJSON() {} }) as DOMRect;
  const cols = Array.from(document.querySelectorAll<HTMLElement>("[data-container]"));
  cols.forEach((col, ci) => {
    const left = ci * 300;
    col.getBoundingClientRect = () => ({ left, top: 0, width: 280, height: 600, right: left + 280, bottom: 600, x: left, y: 0, toJSON() {} }) as DOMRect;
    Array.from(col.querySelectorAll<HTMLElement>("[data-item]")).forEach((row, ri) => {
      const top = 40 + ri * 50;
      row.getBoundingClientRect = () => ({ left, top, width: 280, height: 40, right: left + 280, bottom: top + 40, x: left, y: top, toJSON() {} }) as DOMRect;
    });
  });
  document.elementFromPoint = (x: number, y: number) => {
    const col = cols[Math.floor(x / 300)];
    if (!col) return null;
    const rows = Array.from(col.querySelectorAll<HTMLElement>("[data-item]"));
    return rows.find((r) => y >= r.getBoundingClientRect().top && y < r.getBoundingClientRect().bottom) ?? col;
  };
}
const handle = (title: string) => {
  const el = screen.getByRole("button", { name: `Drag ${title}` }) as HTMLElement;
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  return el;
};
const down = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button: 0 });
const move = (el: Element, x: number, y: number) => {
  layout();
  fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1 });
};
const up = (el: Element, x: number, y: number) => fireEvent.pointerUp(el, { clientX: x, clientY: y, pointerId: 1 });
const col = (label: string) => within(screen.getByRole("list", { name: `${label} items` }));
const titles = (label: string) => col(label).queryAllByRole("listitem").map((li) => li.getAttribute("data-item"));

function Board(props: Partial<React.ComponentProps<typeof TransferBoard<TransferItem>>>) {
  return <TransferBoard containers={CONTAINERS} items={ITEMS} itemsByContainer={BOARD} revision={1} onMoveRequest={() => {}} motion="off" {...props} />;
}

/** Demo host that applies accepted moves. */
function Host({ reject = false, children }: { reject?: boolean; children: (api: { board: ItemsByContainer; revision: number; resolution: Resolution | null; onMoveRequest: (i: MoveIntent) => void; onUndoRequest: (i: MoveIntent) => void; resolve: () => void; intents: MoveIntent[]; setBoard: (b: ItemsByContainer) => void }) => React.ReactNode }) {
  const [board, setBoardState] = useState<ItemsByContainer>(BOARD);
  const [revision, setRevision] = useState(1);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [queue, setQueue] = useState<MoveIntent[]>([]);
  const [intents, setIntents] = useState<MoveIntent[]>([]);
  const resolve = () => {
    const i = queue[0];
    if (!i) return;
    setQueue((q) => q.slice(1));
    if (reject) {
      setResolution({ requestId: i.requestId, accepted: false, message: "Server said no" });
      return;
    }
    setBoardState((b) => {
      const from = b[i.fromContainerId]!.filter((x) => x !== i.itemId);
      const base = i.fromContainerId === i.toContainerId ? from : b[i.toContainerId]!.filter((x) => x !== i.itemId);
      const idx = i.beforeItemId ? base.indexOf(i.beforeItemId) : base.length;
      const to = [...base.slice(0, idx), i.itemId, ...base.slice(idx)];
      return { ...b, [i.fromContainerId]: from, [i.toContainerId]: to };
    });
    setRevision((r) => r + 1);
    setResolution({ requestId: i.requestId, accepted: true });
  };
  const onMoveRequest = (i: MoveIntent) => {
    setQueue((q) => [...q, i]);
    setIntents((x) => [...x, i]);
  };
  return <>{children({ board, revision, resolution, onMoveRequest, onUndoRequest: onMoveRequest, resolve, intents, setBoard: (b) => { setBoardState(b); setRevision((r) => r + 1); } })}</>;
}

let elementFromPoint: typeof document.elementFromPoint;
beforeEach(() => {
  elementFromPoint = document.elementFromPoint;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  document.elementFromPoint = elementFromPoint;
  vi.restoreAllMocks();
});

describe("TransferBoard", () => {
  it("renders labelled columns with authoritative counts, empty targets and a read-only column", () => {
    render(<Board />);
    expect(screen.getByRole("group", { name: "Transfer board" })).toBeInTheDocument();
    expect(titles("To do")).toEqual(["a", "b", "c"]);
    expect(screen.getByLabelText("3 items")).toHaveTextContent("3");
    expect(screen.getByLabelText("2 items")).toHaveTextContent("2/2");
    expect(col("Done").getByText("Empty")).toBeInTheDocument();
    expect(col("Archive").getByText("Read-only")).toBeInTheDocument();
  });

  it("dropping into an empty allowed column emits one correctly addressed intent (C44-T01)", () => {
    const req = vi.fn();
    render(<Board onMoveRequest={req} revision="v7" />);
    const h = handle("Task A");
    down(h, 10, 60);
    move(h, 650, 100); // over "done"
    expect(screen.getByRole("status")).toHaveTextContent("Drop to move to Done");
    expect(document.querySelector('[data-container="done"]')).toHaveAttribute("data-target", "valid");
    expect(col("Done").getByRole("listitem", { hidden: true })).toHaveAttribute("data-placeholder", "a"); // preview placeholder, source untouched
    expect(titles("To do")).toEqual(["a", "b", "c"]);
    expect(screen.getByRole("heading", { name: "Done" }).nextElementSibling).toHaveTextContent("0"); // counts stay authoritative
    up(h, 650, 100);
    expect(req).toHaveBeenCalledTimes(1);
    expect(req.mock.calls[0]![0]).toMatchObject({ itemId: "a", fromContainerId: "todo", toContainerId: "done", beforeItemId: null, baseRevision: "v7", source: "pointer" });
    expect(document.querySelector('[data-item="a"]')).toHaveAttribute("data-pending", "true");
    expect(titles("Done")).toEqual([]); // nothing applied until the host answers
    expect(document.querySelector("[data-drag-preview]")).toBeNull();
  });

  it("invalid targets neither change counts nor emit a request (C44-T02)", () => {
    const req = vi.fn();
    render(<Board onMoveRequest={req} canMove={(m) => (m.itemId === "c" ? { allowed: false, reason: "C is locked" } : true)} />);
    const h = handle("Task A");
    down(h, 10, 60);
    move(h, 950, 100); // archive: read-only
    expect(document.querySelector('[data-container="archive"]')).toHaveAttribute("data-target", "blocked");
    expect(screen.getByRole("status")).toHaveTextContent("Cannot drop here: Archive is read-only.");
    up(h, 950, 100);
    expect(req).not.toHaveBeenCalled();
    const h2 = handle("Task A");
    down(h2, 10, 60);
    move(h2, 350, 100); // doing: full (capacity 2)
    expect(screen.getByRole("status")).toHaveTextContent("Doing is full (2).");
    up(h2, 350, 100);
    const h3 = handle("Task C");
    down(h3, 10, 160);
    move(h3, 650, 100);
    expect(screen.getByRole("status")).toHaveTextContent("C is locked");
    up(h3, 650, 100);
    expect(req).not.toHaveBeenCalled();
    expect(titles("To do")).toEqual(["a", "b", "c"]);
  });

  it("moving before an item addresses it by id, including within a column (C44-T03)", () => {
    const req = vi.fn();
    render(<Board onMoveRequest={req} />);
    const h = handle("Task C");
    down(h, 10, 160);
    move(h, 10, 45); // above the midpoint of row "a"
    expect(col("To do").getAllByRole("listitem", { hidden: true }).map((li) => li.getAttribute("data-placeholder") ?? li.getAttribute("data-item"))).toEqual(["c", "a", "b", "c"]);
    expect(document.querySelector('[data-item="c"]')).toHaveAttribute("data-dragging", "true");
    up(h, 10, 45);
    expect(req.mock.calls[0]![0]).toMatchObject({ itemId: "c", fromContainerId: "todo", toContainerId: "todo", beforeItemId: "a" });
  });

  it("a revision change mid-drag cancels the preview safely (C44-T04)", () => {
    const req = vi.fn();
    const { rerender } = render(<Board onMoveRequest={req} />);
    const h = handle("Task A");
    down(h, 10, 60);
    move(h, 650, 100);
    expect(document.querySelector('[data-slot="transfer-board"]')).toHaveAttribute("data-state", "preview");
    rerender(<Board onMoveRequest={req} revision={2} itemsByContainer={{ ...BOARD, todo: ["b", "c", "a"] }} />);
    expect(document.querySelector('[data-slot="transfer-board"]')).toHaveAttribute("data-state", "idle");
    expect(screen.getByRole("status")).toHaveTextContent("the drag was cancelled");
    expect(document.querySelector("[data-drag-preview]")).toBeNull();
    up(h, 650, 100);
    expect(req).not.toHaveBeenCalled();
  });

  it("host rejection restores membership, order and focus; acceptance applies and focuses the item (C44-T05)", async () => {
    let api: Parameters<React.ComponentProps<typeof Host>["children"]>[0] | null = null;
    const { unmount } = render(
      <Host reject>
        {(h) => {
          api = h;
          return <Board itemsByContainer={h.board} revision={h.revision} resolution={h.resolution} onMoveRequest={h.onMoveRequest} />;
        }}
      </Host>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Move Task A" }));
    const dialog = screen.getByRole("dialog", { name: "Move Task A" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Destination"), "done");
    await userEvent.click(within(dialog).getByRole("button", { name: "Move here" }));
    expect(api!.intents[0]).toMatchObject({ itemId: "a", toContainerId: "done", beforeItemId: null, source: "menu" });
    expect(document.querySelector('[data-item="a"]')).toHaveAttribute("data-pending", "true");
    await act(async () => api!.resolve());
    expect(titles("To do")).toEqual(["a", "b", "c"]);
    expect(screen.getByRole("status")).toHaveTextContent("Server said no");
    expect(screen.getByRole("button", { name: "Move Task A" })).toHaveFocus();
    expect(document.querySelector('[data-item="a"]')).not.toHaveAttribute("data-pending");
    unmount();

    render(
      <Host>
        {(h) => {
          api = h;
          return <Board itemsByContainer={h.board} revision={h.revision} resolution={h.resolution} onMoveRequest={h.onMoveRequest} />;
        }}
      </Host>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Move Task B" }));
    const d2 = screen.getByRole("dialog", { name: "Move Task B" });
    await userEvent.selectOptions(within(d2).getByLabelText("Destination"), "done");
    await userEvent.click(within(d2).getByRole("button", { name: "Move here" }));
    await act(async () => api!.resolve());
    expect(titles("Done")).toEqual(["b"]);
    expect(titles("To do")).toEqual(["a", "c"]);
    expect(screen.getByRole("status")).toHaveTextContent("Task B moved to Done.");
    expect(screen.getByRole("button", { name: "Move Task B" })).toHaveFocus();
  });

  it("undo submits the inverse move, and explains a conflict when the origin is gone (C44-T06)", async () => {
    let api: Parameters<React.ComponentProps<typeof Host>["children"]>[0] | null = null;
    const { rerender } = render(
      <Host>
        {(h) => {
          api = h;
          return <Board itemsByContainer={h.board} revision={h.revision} resolution={h.resolution} onMoveRequest={h.onMoveRequest} onUndoRequest={h.onUndoRequest} undoEnabled />;
        }}
      </Host>,
    );
    expect(screen.getByRole("button", { name: "Undo last move" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Move Task A" }));
    await userEvent.selectOptions(within(screen.getByRole("dialog")).getByLabelText("Destination"), "done");
    await userEvent.click(screen.getByRole("button", { name: "Move here" }));
    await act(async () => api!.resolve());
    expect(titles("Done")).toEqual(["a"]);
    await userEvent.click(screen.getByRole("button", { name: "Undo last move" }));
    expect(api!.intents[1]).toMatchObject({ itemId: "a", fromContainerId: "done", toContainerId: "todo", beforeItemId: "b", source: "undo" });
    await act(async () => api!.resolve());
    expect(titles("To do")).toEqual(["a", "b", "c"]);
    // move again, then delete the origin container: undo must explain
    await userEvent.click(screen.getByRole("button", { name: "Move Task C" }));
    await userEvent.selectOptions(within(screen.getByRole("dialog")).getByLabelText("Destination"), "done");
    await userEvent.click(screen.getByRole("button", { name: "Move here" }));
    await act(async () => api!.resolve());
    const { todo: _t, ...noTodo } = api!.board;
    void _t;
    rerender(
      <Host>
        {(h) => <Board containers={CONTAINERS.filter((c) => c.id !== "todo")} itemsByContainer={noTodo} revision={99} resolution={h.resolution} onMoveRequest={h.onMoveRequest} onUndoRequest={h.onUndoRequest} undoEnabled />}
      </Host>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo last move" }));
    expect(screen.getByRole("status")).toHaveTextContent('Cannot undo: "todo" no longer exists.');
    expect(titles("Done")).toEqual(["c"]);
  });

  it("every operation is achievable through the click-only Move menu (C44-T07)", async () => {
    const req = vi.fn();
    render(<Board onMoveRequest={req} />);
    await userEvent.click(screen.getByRole("button", { name: "Move Task E" }));
    const dialog = screen.getByRole("dialog", { name: "Move Task E" });
    expect(within(dialog).getByLabelText("Destination")).toHaveFocus();
    await userEvent.selectOptions(within(dialog).getByLabelText("Destination"), "archive");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Archive is read-only.");
    expect(within(dialog).getByRole("button", { name: "Move here" })).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText("Destination"), "todo");
    await userEvent.selectOptions(within(dialog).getByLabelText("Position"), "b");
    await userEvent.click(within(dialog).getByRole("button", { name: "Move here" }));
    expect(req).toHaveBeenCalledTimes(1);
    expect(req.mock.calls[0]![0]).toMatchObject({ itemId: "e", fromContainerId: "doing", toContainerId: "todo", beforeItemId: "b", source: "menu" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Move Task D" })).toBeDisabled(); // locked while pending
  });

  it("the Move menu closes on Escape and returns focus", async () => {
    render(<Board />);
    await userEvent.click(screen.getByRole("button", { name: "Move Task D" }));
    expect(screen.getByRole("dialog", { name: "Move Task D" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Move Task D" })).toHaveFocus();
  });

  it("handles use touch-action none only on themselves; the board stays scrollable (C44-T08)", () => {
    render(<Board />);
    expect(screen.getByRole("button", { name: "Drag Task A" }).className).toContain("touch-none");
    const scroller = screen.getByRole("group", { name: "Transfer board" }).querySelector(".overflow-y-auto")!;
    expect(scroller.className).not.toContain("touch-none");
  });

  it("rapid pointer cancellation leaves no overlay or autoscroll loop (C44-T09)", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const caf = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    render(<Board />);
    const h = handle("Task A");
    down(h, 10, 60);
    move(h, 650, 590); // near the bottom edge → autoscroll starts
    expect(raf).toHaveBeenCalled();
    expect(document.querySelector("[data-drag-preview]")).not.toBeNull();
    fireEvent.pointerCancel(h, { pointerId: 1 });
    expect(document.querySelector("[data-drag-preview]")).toBeNull();
    expect(caf).toHaveBeenCalled();
    expect(document.querySelector('[data-slot="transfer-board"]')).toHaveAttribute("data-state", "idle");
    // Escape during a drag also cancels
    down(h, 10, 60);
    move(h, 650, 100);
    fireEvent.keyDown(h, { key: "Escape" });
    expect(document.querySelector("[data-drag-preview]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Drag cancelled.");
  });

  it("duplicate ids show a diagnostic and disable moves (C44-T10)", async () => {
    const req = vi.fn();
    render(<Board onMoveRequest={req} itemsByContainer={{ ...BOARD, done: ["a"] }} />);
    expect(screen.getByRole("note")).toHaveTextContent('item "a" appears in "todo" and "done"');
    expect(document.querySelector('[data-slot="transfer-board"]')).toHaveAttribute("data-invalid", "true");
    expect(screen.getAllByRole("button", { name: "Move Task A" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Drag Task A" })[0]).toBeDisabled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("exposes focusItem through the ref and renders custom items with handle and menu", () => {
    const ref = { current: null as TransferBoardHandle | null };
    render(
      <Board
        ref={ref}
        renderItem={(item, ctx) => (
          <div data-custom>
            {ctx.handle}
            <strong>{item.title}</strong>
            {ctx.moveMenu}
          </div>
        )}
      />,
    );
    expect(document.querySelectorAll("[data-custom]")).toHaveLength(5);
    act(() => ref.current!.focusItem("d"));
    expect(screen.getByRole("button", { name: "Move Task D" })).toHaveFocus();
  });
});
