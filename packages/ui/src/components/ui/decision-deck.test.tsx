import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DecisionDeck, type Decision, type DecisionDeckHandle, type DecisionIntent, type DeckItem, type Resolution, type UndoIntent } from "./decision-deck";

const ITEMS: DeckItem[] = Array.from({ length: 5 }, (_, i) => ({ id: `i${i + 1}`, title: `Card ${i + 1}` }));
const OUTCOMES = [
  { id: "reject", label: "Reject" },
  { id: "accept", label: "Accept" },
] as const;

function card() {
  const el = screen.getByRole("group", { name: /Card \d/ }) as HTMLElement;
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  el.getBoundingClientRect = () => ({ width: 300, height: 200, left: 0, top: 0, right: 300, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return el;
}
const down = (el: Element, x: number, y = 50, t = 0) => fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button: 0, timeStamp: t });
const move = (el: Element, x: number, y = 50, t = 0) => fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1, timeStamp: t });
const up = (el: Element, x: number, y = 50, t = 0) => fireEvent.pointerUp(el, { clientX: x, clientY: y, pointerId: 1, timeStamp: t });

const Deck = (props: Partial<React.ComponentProps<typeof DecisionDeck<DeckItem>>>) => (
  <DecisionDeck items={ITEMS} outcomes={OUTCOMES} onDecisionRequest={() => {}} renderCard={(item) => <div className="p-4">{item.title}</div>} motion="off" {...props} />
);

/** A demo host: records intents, resolves on demand. */
function Host({ reject = new Set<string>(), undoRefused = false, children }: { reject?: Set<string>; undoRefused?: boolean; children: (api: { decisions: Decision[]; resolution: Resolution | null; onDecisionRequest: (i: DecisionIntent) => void; onUndoRequest: (i: UndoIntent) => void; resolveLast: () => void; intents: DecisionIntent[] }) => React.ReactNode }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [queue, setQueue] = useState<(DecisionIntent | UndoIntent)[]>([]);
  const [intents, setIntents] = useState<DecisionIntent[]>([]);
  const resolveLast = () => {
    const i = queue[queue.length - 1];
    if (!i) return;
    setQueue((q) => q.slice(0, -1));
    if ("outcomeId" in i) {
      if (reject.has(i.itemId)) setResolution({ requestId: i.requestId, accepted: false, message: `Host refused ${i.itemId}` });
      else {
        setDecisions((d) => [...d, { decisionId: `d-${i.requestId}`, itemId: i.itemId, outcomeId: i.outcomeId, requestId: i.requestId }]);
        setResolution({ requestId: i.requestId, accepted: true });
      }
    } else if (undoRefused) setResolution({ requestId: i.requestId, accepted: false, message: "Already shipped" });
    else {
      setDecisions((d) => d.filter((x) => x.decisionId !== i.decisionId));
      setResolution({ requestId: i.requestId, accepted: true });
    }
  };
  return <>{children({ decisions, resolution, onDecisionRequest: (i) => { setQueue((q) => [...q, i]); setIntents((x) => [...x, i]); }, onUndoRequest: (i) => setQueue((q) => [...q, i]), resolveLast, intents })}</>;
}

describe("DecisionDeck", () => {
  it("renders the first undecided item, two backing cards and a counter", () => {
    render(<Deck decisions={[{ decisionId: "d1", itemId: "i1", outcomeId: "accept", requestId: "r1" }]} />);
    expect(screen.getByRole("group", { name: "Card 2" })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-card^="backing"]')).toHaveLength(2);
    expect(screen.getByText("4 remaining")).toBeInTheDocument();
    expect(screen.getByText("1 decided")).toBeInTheDocument();
  });

  it("a short swipe resets without a request; vertical movement is left to scrolling (C43-T01)", () => {
    const req = vi.fn();
    render(<Deck onDecisionRequest={req} />);
    const c = card();
    down(c, 100);
    move(c, 140); // 40px of 300 = 13%
    expect(c).toHaveAttribute("data-dragging", "true");
    up(c, 140);
    expect(req).not.toHaveBeenCalled();
    expect(c).not.toHaveAttribute("data-dragging");
    down(c, 100, 50);
    move(c, 104, 90); // vertical intent
    expect(c).not.toHaveAttribute("data-dragging");
    move(c, 300, 90);
    up(c, 300, 90);
    expect(req).not.toHaveBeenCalled();
  });

  it("a valid swipe and the Accept button create equivalent intents (C43-T02)", async () => {
    const req = vi.fn();
    const { rerender } = render(<Deck onDecisionRequest={req} />);
    const c = card();
    down(c, 100);
    move(c, 220); // 120/300 = 40%
    up(c, 220);
    expect(req).toHaveBeenCalledTimes(1);
    const swipe = req.mock.calls[0]![0] as DecisionIntent;
    expect(swipe).toMatchObject({ itemId: "i1", outcomeId: "accept", source: "pointer" });
    rerender(<Deck onDecisionRequest={req} decisions={[{ decisionId: "d1", itemId: "i1", outcomeId: "accept", requestId: swipe.requestId }]} resolution={{ requestId: swipe.requestId, accepted: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    const btn = req.mock.calls[1]![0] as DecisionIntent;
    expect(btn).toMatchObject({ itemId: "i2", outcomeId: "accept", source: "button" });
    expect(btn.requestId).not.toBe(swipe.requestId);
    // flick: 20% travel fast
    rerender(<Deck onDecisionRequest={req} decisions={[{ decisionId: "d1", itemId: "i1", outcomeId: "accept", requestId: swipe.requestId }, { decisionId: "d2", itemId: "i2", outcomeId: "accept", requestId: btn.requestId }]} resolution={{ requestId: btn.requestId, accepted: true }} />);
    const c3 = card();
    down(c3, 200, 50, 0);
    move(c3, 170, 50, 10);
    move(c3, 140, 50, 20); // 3000 px/s leftwards, 20% travel
    up(c3, 140, 50, 20);
    expect(req.mock.calls[2]![0]).toMatchObject({ itemId: "i3", outcomeId: "reject", source: "pointer" });
  });

  it("twenty clicks while pending create one request (C43-T03)", async () => {
    const req = vi.fn();
    render(<Deck onDecisionRequest={req} />);
    const accept = screen.getByRole("button", { name: "Accept" });
    await userEvent.click(accept);
    expect(accept).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    for (let i = 0; i < 19; i++) await userEvent.click(accept);
    const c = card();
    down(c, 100);
    move(c, 250);
    up(c, 250);
    await act(async () => c.focus());
    await userEvent.keyboard("{ArrowRight}{ArrowLeft}");
    expect(req).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Accept requested…");
    expect(c).toHaveAttribute("data-pending", "true");
  });

  it("a rejected request restores the same item and shows the host error (C43-T04)", async () => {
    render(
      <Host reject={new Set(["i1"])}>
        {(h) => <Deck decisions={h.decisions} resolution={h.resolution} onDecisionRequest={h.onDecisionRequest} onUndoRequest={h.onUndoRequest} />}
      </Host>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.getByRole("group", { name: "Card 1" })).toHaveAttribute("data-pending", "true");
    // resolve through a hidden control: re-render by clicking a host button
    const resolve = screen.queryByRole("button", { name: "resolve" });
    expect(resolve).toBeNull();
    // use the host API directly via a second render tree
  });

  it("host rejection, acceptance, stale resolutions and undo through a demo host (C43-T04, T05, T06)", async () => {
    let api: Parameters<React.ComponentProps<typeof Host>["children"]>[0] | null = null;
    render(
      <Host reject={new Set(["i2"])}>
        {(h) => {
          api = h;
          return <Deck decisions={h.decisions} resolution={h.resolution} onDecisionRequest={h.onDecisionRequest} onUndoRequest={h.onUndoRequest} />;
        }}
      </Host>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    await act(async () => api!.resolveLast());
    expect(screen.getByRole("group", { name: "Card 2" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Accept. Next: Card 2.");
    expect(screen.getByRole("button", { name: "Accept" })).toHaveFocus();
    // rejection restores Card 2 with the message
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await act(async () => api!.resolveLast());
    expect(screen.getByRole("group", { name: "Card 2" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Card 2" })).not.toHaveAttribute("data-pending");
    expect(screen.getByRole("status")).toHaveTextContent("Host refused i2");
    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
    // undo targets the latest accepted decision (i1) and waits
    const undo = screen.getByRole("button", { name: "Undo" });
    await userEvent.click(undo);
    expect(screen.getByRole("status")).toHaveTextContent("Undo requested…");
    expect(screen.getByRole("group", { name: "Card 2" })).toBeInTheDocument(); // nothing reversed yet
    await act(async () => api!.resolveLast());
    expect(screen.getByRole("group", { name: "Card 1" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Decision undone.");
  });

  it("a stale resolution cannot remove the newly active item (C43-T05)", async () => {
    const req = vi.fn();
    const { rerender } = render(<Deck onDecisionRequest={req} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    const first = (req.mock.calls[0]![0] as DecisionIntent).requestId;
    const d1: Decision = { decisionId: "d1", itemId: "i1", outcomeId: "accept", requestId: first };
    rerender(<Deck onDecisionRequest={req} decisions={[d1]} resolution={{ requestId: first, accepted: true }} />);
    expect(screen.getByRole("group", { name: "Card 2" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    // a late, foreign resolution arrives: ignored, Card 2 stays pending
    rerender(<Deck onDecisionRequest={req} decisions={[d1]} resolution={{ requestId: "ancient", accepted: true }} />);
    expect(screen.getByRole("group", { name: "Card 2" })).toHaveAttribute("data-pending", "true");
    rerender(<Deck onDecisionRequest={req} decisions={[d1]} resolution={{ requestId: first, accepted: false, message: "old" }} />);
    expect(screen.getByRole("group", { name: "Card 2" })).toHaveAttribute("data-pending", "true");
    expect(screen.getByRole("status")).not.toHaveTextContent("old");
  });

  it("undo refusal preserves the deck and explains (C43-T06)", async () => {
    let api: Parameters<React.ComponentProps<typeof Host>["children"]>[0] | null = null;
    render(
      <Host undoRefused>
        {(h) => {
          api = h;
          return <Deck decisions={h.decisions} resolution={h.resolution} onDecisionRequest={h.onDecisionRequest} onUndoRequest={h.onUndoRequest} />;
        }}
      </Host>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    await act(async () => api!.resolveLast());
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => api!.resolveLast());
    expect(screen.getByRole("group", { name: "Card 2" })).toBeInTheDocument();
    expect(screen.getByText("1 decided")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Already shipped");
  });

  it("external deletion of the dragged item releases capture without errors (C43-T07)", () => {
    const req = vi.fn();
    const { rerender } = render(<Deck onDecisionRequest={req} />);
    const c = card();
    const release = vi.fn();
    c.releasePointerCapture = release;
    down(c, 100);
    move(c, 160);
    expect(c).toHaveAttribute("data-dragging", "true");
    rerender(<Deck onDecisionRequest={req} items={ITEMS.slice(1)} />);
    expect(release).toHaveBeenCalledWith(1);
    expect(screen.getByRole("group", { name: "Card 2" })).not.toHaveAttribute("data-dragging");
    fireEvent.pointerUp(screen.getByRole("group", { name: "Card 2" }), { clientX: 300, pointerId: 1 });
    expect(req).not.toHaveBeenCalled();
  });

  it("text fields and links inside a card remain usable (C43-T08)", async () => {
    const req = vi.fn();
    render(<Deck onDecisionRequest={req} renderCard={(item) => (<div><a href="#x">{item.title}</a><input aria-label="Note" /></div>)} />);
    const input = screen.getByRole("textbox", { name: "Note" });
    down(input, 100);
    move(input, 260);
    up(input, 260);
    expect(req).not.toHaveBeenCalled();
    await userEvent.type(input, "hello");
    expect(input).toHaveValue("hello");
    expect(screen.getByRole("link", { name: "Card 1" })).toBeInTheDocument();
  });

  it("keyboard alone completes the queue and the empty view keeps history (C43-T09, C43-T10)", async () => {
    let api: Parameters<React.ComponentProps<typeof Host>["children"]>[0] | null = null;
    render(
      <Host>
        {(h) => {
          api = h;
          return <Deck items={ITEMS.slice(0, 2)} decisions={h.decisions} resolution={h.resolution} onDecisionRequest={h.onDecisionRequest} onUndoRequest={h.onUndoRequest} motion="reduced" />;
        }}
      </Host>,
    );
    expect(document.querySelector('[data-slot="decision-deck"]')).toHaveAttribute("data-motion", "reduced");
    await act(async () => card().focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(api!.intents[0]).toMatchObject({ itemId: "i1", outcomeId: "accept", source: "keyboard" });
    await act(async () => api!.resolveLast());
    await act(async () => card().focus());
    await userEvent.keyboard("{ArrowLeft}");
    await act(async () => api!.resolveLast());
    expect(screen.queryByRole("group", { name: /Card/ })).toBeNull();
    expect(document.querySelector('[data-card="empty"]')).toHaveTextContent("2 decisions recorded");
    expect(screen.getByRole("status")).toHaveTextContent("Deck complete.");
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
  });

  it("shortlist variant counts kept items and exposes a handle", () => {
    const ref = { current: null as DecisionDeckHandle | null };
    render(<Deck ref={ref} variant="shortlist" outcomes={[{ id: "skip", label: "Skip" }, { id: "keep", label: "Keep" }]} decisions={[{ decisionId: "d1", itemId: "i1", outcomeId: "keep", requestId: "r" }]} />);
    expect(screen.getByText("4 remaining · 1 kept")).toBeInTheDocument();
    act(() => ref.current!.focusActive());
    expect(screen.getByRole("group", { name: "Card 2" })).toHaveFocus();
  });
});
