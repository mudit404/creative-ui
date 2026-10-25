import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeLens, type TimeEvent, type TimeLensHandle, type TimeWindow } from "./time-lens";

const H = 36e5;
const T0 = Date.UTC(2026, 2, 8, 0, 0); // 2026-03-08, DST transition day in New York
const DOMAIN: TimeWindow = [T0, T0 + 24 * H];
const EVENTS: TimeEvent[] = [
  { id: "deploy", startMs: T0 + 2 * H, label: "Deploy 2.4" },
  { id: "incident", startMs: T0 + 6 * H + 30 * 6e4, endMs: T0 + 8 * H, label: "API latency", severity: "major", details: "p95 above 2s" },
  { id: "pre", startMs: T0 + 6.5 * H, label: "Alarm fired" }, // same start as incident: overlaps → second lane
  { id: "post", startMs: T0 + 7.5 * H, label: "Rollback" },
  { id: "late", startMs: T0 + 20 * H, label: "Postmortem" },
];

let roCallback: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
class RO {
  constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
    roCallback = cb;
  }
  observe() {
    queueMicrotask(() => roCallback?.([{ contentRect: { width: 1000 } }]));
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
  vi.restoreAllMocks();
});
const flush = () => act(async () => {
  await Promise.resolve();
});

const Lens = (props: Partial<React.ComponentProps<typeof TimeLens>>) => <TimeLens events={EVENTS} domain={DOMAIN} motion="off" {...props} />;
const handle = (which: "start" | "end") => screen.getByRole("slider", { name: which === "start" ? "Window start" : "Window end" }) as HTMLElement;
const left = (el: Element) => parseFloat((el as HTMLElement).style.left);
const down = (el: Element, x: number) => fireEvent.pointerDown(el, { clientX: x, clientY: 10, pointerId: 1, button: 0 });
const move = (el: Element, x: number) => fireEvent.pointerMove(el, { clientX: x, clientY: 10, pointerId: 1 });
const up = (el: Element, x: number) => fireEvent.pointerUp(el, { clientX: x, clientY: 10, pointerId: 1 });

describe("TimeLens", () => {
  it("places equal intervals at equal distances and stacks overlaps into lanes (C46-T01)", async () => {
    render(<Lens defaultWindow={[T0, T0 + 10 * H]} />);
    await flush();
    const deploy = screen.getByRole("button", { name: /^Deploy 2.4/ });
    const incident = screen.getByRole("button", { name: /^API latency/ });
    const post = screen.getByRole("button", { name: /^Rollback/ });
    // 1000px over 10h → 100px/h
    expect(left(deploy)).toBeCloseTo(200);
    expect(left(incident)).toBeCloseTo(650);
    expect(left(post)).toBeCloseTo(750);
    expect(parseFloat(incident.style.width)).toBeCloseTo(150);
    expect(screen.getByRole("button", { name: /^Alarm fired/ }).style.top).toBe("40px"); // the point sorts first (earlier end)
    expect(incident.style.top).toBe("68px"); // overlapping duration stacks into the second lane
    const ticks = document.querySelectorAll("[data-tick]");
    expect(ticks.length).toBeGreaterThan(3);
    expect(left(ticks[1]!) - left(ticks[0]!)).toBeCloseTo(left(ticks[2]!) - left(ticks[1]!));
  });

  it("brushing previews, release commits, timestamps never change (C46-T02)", async () => {
    const preview = vi.fn();
    const commit = vi.fn();
    const events = EVENTS.map((e) => ({ ...e }));
    render(<Lens events={events} onWindowPreview={preview} onWindowCommit={commit} />);
    await flush();
    const win = document.querySelector("[data-window]") as HTMLElement;
    win.setPointerCapture = () => {};
    win.releasePointerCapture = () => {};
    // zoom in first so the window can pan (domain is 24h → 1000px)
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(commit).toHaveBeenLastCalledWith([T0 + 6 * H, T0 + 18 * H], "zoom");
    down(win, 500);
    move(win, 400); // −100px = −2.4h
    expect(document.querySelector('[data-slot="time-lens"]')).toHaveAttribute("data-state", "brushing");
    expect(preview).toHaveBeenLastCalledWith([T0 + 3.6 * H, T0 + 15.6 * H], "pan");
    expect(commit).toHaveBeenCalledTimes(1);
    up(win, 400);
    expect(commit).toHaveBeenLastCalledWith([T0 + 3.6 * H, T0 + 15.6 * H], "pan");
    expect(handle("start")).toHaveAttribute("aria-valuenow", String(T0 + 3.6 * H));
    expect(events).toEqual(EVENTS); // untouched
  });

  it("handles respect minSpan and domain bounds by pointer and keyboard (C46-T03)", async () => {
    const commit = vi.fn();
    render(<Lens defaultWindow={[T0 + 4 * H, T0 + 8 * H]} minSpan={H} onWindowCommit={commit} />);
    await flush();
    const end = handle("end");
    end.setPointerCapture = () => {};
    end.releasePointerCapture = () => {};
    down(end, 333);
    move(end, -500); // drag far left: end cannot cross start + minSpan
    up(end, -500);
    expect(commit).toHaveBeenLastCalledWith([T0 + 4 * H, T0 + 5 * H], "handle");
    const start = handle("start");
    start.setPointerCapture = () => {};
    start.releasePointerCapture = () => {};
    down(start, 166);
    move(start, 5000); // far right
    up(start, 5000);
    expect(commit).toHaveBeenLastCalledWith([T0 + 4 * H, T0 + 5 * H], "handle");
    await act(async () => start.focus());
    for (let i = 0; i < 10; i++) await userEvent.keyboard("{ArrowLeft}");
    expect((commit.mock.calls.at(-1)![0] as TimeWindow)[0]).toBeGreaterThanOrEqual(T0);
    await act(async () => end.focus());
    for (let i = 0; i < 40; i++) await userEvent.keyboard("{ArrowRight}");
    expect((commit.mock.calls.at(-1)![0] as TimeWindow)[1]).toBe(T0 + 24 * H);
  });

  it("the ISO editor commits the same viewport as a brush would (C46-T04)", async () => {
    const commit = vi.fn();
    render(<Lens onWindowCommit={commit} />);
    await flush();
    const s = screen.getByRole("textbox", { name: "Window start (ISO)" });
    const e = screen.getByRole("textbox", { name: "Window end (ISO)" });
    await userEvent.clear(s);
    await userEvent.type(s, "2026-03-08T04:00:00Z");
    await userEvent.clear(e);
    await userEvent.type(e, "2026-03-08T08:00:00Z{Enter}");
    expect(commit).toHaveBeenLastCalledWith([T0 + 4 * H, T0 + 8 * H], "editor");
    expect(handle("start")).toHaveAttribute("aria-valuenow", String(T0 + 4 * H));
    // invalid: local time without an offset
    await userEvent.clear(e);
    await userEvent.type(e, "2026-03-08T02:30{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("ISO-8601 with an offset");
    expect(commit).toHaveBeenCalledTimes(1);
    await userEvent.clear(e);
    await userEvent.type(e, "2026-03-08T03:00:00Z{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("End must be after start.");
  });

  it("formats in the display zone across DST without reordering (C46-T05)", async () => {
    render(<Lens timeZone="America/New_York" defaultWindow={[T0 + 6 * H, T0 + 8 * H]} />);
    await flush();
    const list = within(screen.getByRole("list", { name: /All events/ }));
    const labels = list.getAllByRole("button").map((b) => b.textContent);
    expect(labels[0]).toMatch(/Deploy 2.4/);
    expect(labels[1]).toMatch(/Alarm fired/);
    expect(labels[2]).toMatch(/API latency/);
    expect(labels[4]).toMatch(/Postmortem/);
    // 06:30Z is 01:30 EST; 07:30Z is 03:30 EDT: the clock skips 02:30 but the gap is one real hour
    expect(screen.getByRole("button", { name: /^API latency, 08 Mar 2026, 01:30/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Rollback, 08 Mar 2026, 03:30/ })).toBeInTheDocument();
    const a = left(screen.getByRole("button", { name: /^API latency/ }));
    const b = left(screen.getByRole("button", { name: /^Rollback/ }));
    expect(b - a).toBeCloseTo(500); // 1h of a 2h window
  });

  it("does not intercept ordinary wheel scrolling when wheelZoom is off (C46-T06)", async () => {
    const commit = vi.fn();
    const { rerender } = render(<Lens onWindowCommit={commit} />);
    await flush();
    const lane = screen.getByRole("region", { name: /^Detail/ });
    const ev = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    lane.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    rerender(<Lens onWindowCommit={commit} wheelZoom="ctrl" />);
    const plain = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    lane.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false); // not focused, no modifier
    await act(async () => lane.focus());
    const withCtrl = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true, ctrlKey: true });
    lane.dispatchEvent(withCtrl);
    expect(withCtrl.defaultPrevented).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("data replacement during a brush cancels it and reclamps (C46-T07)", async () => {
    const commit = vi.fn();
    const { rerender } = render(<Lens defaultWindow={[T0, T0 + 12 * H]} onWindowCommit={commit} />);
    await flush();
    const win = document.querySelector("[data-window]") as HTMLElement;
    win.setPointerCapture = () => {};
    const release = vi.fn();
    win.releasePointerCapture = release;
    down(win, 200);
    move(win, 300);
    expect(document.querySelector('[data-slot="time-lens"]')).toHaveAttribute("data-state", "brushing");
    rerender(<Lens defaultWindow={[T0, T0 + 12 * H]} onWindowCommit={commit} domain={[T0 + 6 * H, T0 + 10 * H]} events={EVENTS.slice(1)} />);
    expect(document.querySelector('[data-slot="time-lens"]')).toHaveAttribute("data-state", "ready");
    expect(release).toHaveBeenCalled();
    up(win, 300);
    expect(commit).not.toHaveBeenCalled();
    expect(handle("start")).toHaveAttribute("aria-valuenow", String(T0 + 6 * H));
    expect(handle("end")).toHaveAttribute("aria-valuenow", String(T0 + 10 * H));
  });

  it("selecting an event outside the window from the list brings it into view (C46-T08)", async () => {
    const commit = vi.fn();
    const sel = vi.fn();
    render(<Lens defaultWindow={[T0, T0 + 4 * H]} onWindowCommit={commit} onSelectedIdChange={sel} />);
    await flush();
    expect(screen.queryByRole("button", { name: /^Postmortem, / })).toBeNull(); // not in the lane
    const list = within(screen.getByRole("list", { name: /All events/ }));
    await userEvent.click(list.getByRole("button", { name: /Postmortem/ }));
    expect(sel).toHaveBeenCalledWith("late", "list");
    expect(commit).toHaveBeenLastCalledWith([T0 + 18 * H, T0 + 22 * H], "select");
    expect(screen.getByRole("button", { name: /^Postmortem, / })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("[data-details]")).toHaveTextContent("Postmortem");
    // selecting an event already in view does not move the window
    await userEvent.click(screen.getByRole("button", { name: /^Postmortem, / }));
    expect(sel).toHaveBeenLastCalledWith(null, "clear");
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("keeps axis and marks on one scale under animated zoom and in reduced motion (C46-T09)", async () => {
    render(<Lens defaultWindow={[T0, T0 + 10 * H]} motion="auto" />);
    await flush();
    const deploy = screen.getByRole("button", { name: /^Deploy 2.4/ });
    const tick3h = Array.from(document.querySelectorAll("[data-tick]")).find((t) => t.textContent!.endsWith("03:00"))!;
    expect(left(tick3h) - left(deploy)).toBeCloseTo(100); // 1h at 100px/h
    expect(deploy.style.transition).toContain("240ms");
    expect((tick3h as HTMLElement).style.transition).toContain("240ms");
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const tick = Array.from(document.querySelectorAll("[data-tick]")).find((t) => t.textContent!.endsWith("00:00"));
    expect(tick).toBeUndefined(); // 00:00 scrolled out: window is 2.5h–7.5h
    const post = screen.getByRole("button", { name: /^Rollback/ });
    const tick7 = Array.from(document.querySelectorAll("[data-tick]")).find((t) => t.textContent!.endsWith("07:00"))!;
    expect(left(post) - left(tick7)).toBeCloseTo(100); // 30 min at 200px/h
  });

  it("renders readable empty and invalid states (C46-T10)", async () => {
    const { rerender } = render(<Lens events={[]} />);
    await flush();
    expect(screen.getByText("No events in this timeline.")).toBeInTheDocument();
    rerender(<Lens events={[{ id: "x", startMs: T0 + 1, endMs: T0, label: "broken" }, EVENTS[0]!]} window={[T0 + 10 * H, T0 + 12 * H]} />);
    expect(screen.getByRole("note")).toHaveTextContent('"x" ends before it starts.');
    expect(screen.getByText("No events in this interval. Zoom out or Fit.")).toBeInTheDocument();
    rerender(<Lens domain={[5, 5]} />);
    expect(screen.getByRole("note")).toHaveTextContent("Invalid domain");
  });

  it("exposes focusEvent and fitWindow through the ref and reports reduced motion", async () => {
    const ref = { current: null as TimeLensHandle | null };
    const commit = vi.fn();
    render(<Lens ref={ref} motion="reduced" defaultWindow={[T0, T0 + 4 * H]} onWindowCommit={commit} />);
    await flush();
    expect(document.querySelector('[data-slot="time-lens"]')).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByRole("button", { name: /^Deploy 2.4/ }).style.transition).toBe("");
    act(() => ref.current!.focusEvent("late"));
    expect(commit).toHaveBeenLastCalledWith([T0 + 18 * H, T0 + 22 * H], "select");
    act(() => ref.current!.fitWindow());
    expect(commit).toHaveBeenLastCalledWith(DOMAIN, "fit");
  });
});
