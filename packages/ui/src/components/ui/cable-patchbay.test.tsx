import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CablePatchbay, type CablePatchbayHandle, type ConnectIntent, type Connection, type Port } from "./cable-patchbay";

const PORTS: Port[] = [
  { id: "osc", nodeId: "src1", label: "Osc out", direction: "output", dataType: "audio" },
  { id: "lfo", nodeId: "src2", label: "LFO out", direction: "output", dataType: "cv" },
  { id: "noise", nodeId: "src3", label: "Noise out", direction: "output", dataType: "audio" },
  { id: "amp", nodeId: "dst1", label: "Amp in", direction: "input", dataType: "audio" },
  { id: "gain", nodeId: "dst1", label: "Gain cv", direction: "input", dataType: "cv" },
  { id: "fx", nodeId: "dst2", label: "FX in", direction: "input", dataType: "audio" },
  { id: "rec", nodeId: "dst3", label: "Rec in", direction: "input", dataType: "audio" },
];
const MODULES = [
  { id: "src1", label: "Oscillator" },
  { id: "src2", label: "LFO" },
  { id: "src3", label: "Noise" },
  { id: "dst1", label: "Amplifier" },
  { id: "dst2", label: "Effects" },
  { id: "dst3", label: "Recorder" },
];
const CONNS: Connection[] = [
  { id: "c1", sourcePortId: "osc", targetPortId: "amp" },
  { id: "bad", sourcePortId: "lfo", targetPortId: "fx" },
];

/* fake layout: outputs at x=20, inputs at x=400, rows 40px apart */
const ROW: Record<string, number> = { osc: 20, lfo: 60, noise: 100, amp: 20, gain: 60, fx: 100, rec: 140 };
let roCallbacks: (() => void)[] = [];
class RO {
  private cb: () => void;
  constructor(cb: () => void) {
    this.cb = cb;
    roCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
/** Stub socket rects (after render) and deliver a ResizeObserver notification. */
function installLayout() {
  const root = document.querySelector('[data-slot="cable-patchbay"]') as HTMLElement;
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 400, right: 600, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
  for (const [id, y] of Object.entries(ROW)) {
    const sock = root.querySelector<HTMLElement>(`[data-port="${id}"] [data-socket]`)!;
    const x = PORTS.find((p) => p.id === id)!.direction === "output" ? 20 : 400;
    sock.getBoundingClientRect = () => ({ left: x - 11, top: y - 11, width: 22, height: 22, right: x + 11, bottom: y + 11, x: x - 11, y: y - 11, toJSON() {} }) as DOMRect;
  }
}
const port = (label: string) => screen.getByRole("button", { name: new RegExp("^" + label + " \\(") }) as HTMLElement;
const down = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button: 0 });
const move = (el: Element, x: number, y: number) => fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1 });
const up = (el: Element, x: number, y: number) => fireEvent.pointerUp(el, { clientX: x, clientY: y, pointerId: 1 });
const flush = () =>
  act(async () => {
    roCallbacks.forEach((cb) => cb());
    await Promise.resolve();
  });

const Bay = (props: Partial<React.ComponentProps<typeof CablePatchbay>>) => <CablePatchbay ports={PORTS} modules={MODULES} connections={CONNS} motion="off" onConnectRequest={() => {}} onDisconnectRequest={() => {}} {...props} />;

const originalRO = globalThis.ResizeObserver;
beforeEach(() => {
  roCallbacks = [];
  globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver; // before render so the component observes with it
});
afterEach(() => {
  globalThis.ResizeObserver = originalRO;
});

describe("CablePatchbay", () => {
  it("renders modules, ports as 44px buttons, the connection list and a diagnostic for the invalid edge", async () => {
    render(<Bay />);
    expect(screen.getByRole("region", { name: "Oscillator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Osc out (audio output), connected" })).toHaveClass("min-h-[44px]");
    const list = within(screen.getByRole("list", { name: "Connections" }));
    expect(list.getAllByRole("listitem")).toHaveLength(1);
    expect(list.getByText("Osc out → Amp in")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("bad: Type mismatch: cv → audio.");
    installLayout();
    await flush();
    expect(document.querySelectorAll("[data-cable]")).toHaveLength(1);
    expect(document.querySelector('[data-cable="c1"] path')!.getAttribute("d")).toMatch(/^M 20 20 C /);
  });

  it("connects by drag, by two taps, by keyboard and from the list with equivalent payloads (C45-T01)", async () => {
    const req = vi.fn();
    const { rerender } = render(<Bay onConnectRequest={req} />);
    installLayout();
    await flush();
    // drag: Noise out → FX in (snaps within 24px)
    const noise = port("Noise out");
    noise.setPointerCapture = () => {};
    noise.releasePointerCapture = () => {};
    down(noise, 20, 100);
    move(noise, 200, 110);
    expect(document.querySelector('[data-slot="cable-patchbay"]')).toHaveAttribute("data-state", "dragging");
    expect(document.querySelector("[data-temp-cable]")).not.toBeNull();
    move(noise, 390, 108); // 14px from FX socket
    expect(port("FX in")).toHaveAttribute("data-snapped", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Release to connect to FX in.");
    up(noise, 390, 108);
    expect(req).toHaveBeenCalledTimes(1);
    const drag = req.mock.calls[0]![0] as ConnectIntent;
    expect(drag).toMatchObject({ sourcePortId: "noise", targetPortId: "fx", source: "pointer" });
    expect(document.querySelector("[data-pending-cable]")).not.toBeNull();
    expect(document.querySelector('[data-slot="cable-patchbay"]')).toHaveAttribute("data-state", "pending");
    // host accepts
    rerender(<Bay onConnectRequest={req} connections={[...CONNS, { id: "c2", sourcePortId: "noise", targetPortId: "fx" }]} resolution={{ requestId: drag.requestId, accepted: true }} />);
    expect(document.querySelector("[data-pending-cable]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Connected Noise out to FX in.");
    // two taps: Osc out → Rec in
    await userEvent.click(port("Osc out"));
    expect(port("Osc out")).toHaveAttribute("aria-pressed", "true");
    expect(port("Rec in")).toHaveAttribute("data-eligible", "true");
    expect(port("Gain cv")).toHaveAttribute("data-invalid", "true");
    expect(port("Gain cv")).toHaveAccessibleDescription("Type mismatch: audio → cv.");
    await userEvent.click(port("Rec in"));
    expect(req.mock.calls[1]![0]).toMatchObject({ sourcePortId: "osc", targetPortId: "rec", source: "tap" });
    const tap = req.mock.calls[1]![0] as ConnectIntent;
    rerender(<Bay onConnectRequest={req} connections={[...CONNS, { id: "c2", sourcePortId: "noise", targetPortId: "fx" }]} resolution={{ requestId: tap.requestId, accepted: false, message: "nope" }} />);
    // keyboard: LFO out → Gain cv
    await act(async () => port("LFO out").focus());
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Connecting from LFO out (cv). Choose an input.");
    await act(async () => port("Gain cv").focus());
    await userEvent.keyboard("{Enter}");
    expect(req.mock.calls[2]![0]).toMatchObject({ sourcePortId: "lfo", targetPortId: "gain", source: "keyboard" });
    const kb = req.mock.calls[2]![0] as ConnectIntent;
    rerender(<Bay onConnectRequest={req} connections={[...CONNS, { id: "c2", sourcePortId: "noise", targetPortId: "fx" }]} resolution={{ requestId: kb.requestId, accepted: false }} />);
    // list form: Osc out → Rec in
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Source output" }), "osc");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Target input" }), "rec");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(req.mock.calls[3]![0]).toMatchObject({ sourcePortId: "osc", targetPortId: "rec", source: "list" });
    const ids = req.mock.calls.map((c) => (c[0] as ConnectIntent).requestId);
    expect(new Set(ids).size).toBe(4);
  });

  it("shows reasons for incompatible ports and never creates an edge (C45-T02)", async () => {
    const req = vi.fn();
    render(<Bay onConnectRequest={req} />);
    installLayout();
    await flush();
    const lfo = port("LFO out");
    lfo.setPointerCapture = () => {};
    lfo.releasePointerCapture = () => {};
    down(lfo, 20, 60);
    move(lfo, 200, 60);
    move(lfo, 395, 22); // over Amp in (audio)
    expect(screen.getByRole("status")).toHaveTextContent("Cannot connect: Type mismatch: cv → audio.");
    up(lfo, 395, 22);
    expect(req).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Type mismatch: cv → audio.");
    // form shows the reason and disables Connect
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Source output" }), "lfo");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Target input" }), "amp");
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(document.querySelector("[data-form-verdict]")).toHaveTextContent("Type mismatch: cv → audio.");
    // occupied input: Noise out → Amp in (capacity 1), even with the parent-supplied c1
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Source output" }), "noise");
    expect(document.querySelector("[data-form-verdict]")).toHaveTextContent("Amp in is already occupied.");
  });

  it("reconnection rejection leaves the original connection intact (C45-T03)", async () => {
    const re = vi.fn();
    const { rerender } = render(<Bay onReconnectRequest={re} />);
    installLayout();
    await flush();
    const list = within(screen.getByRole("list", { name: "Connections" }));
    await userEvent.click(list.getByRole("button", { name: "Osc out → Amp in" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Reconnect to" }), "rec");
    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(re).toHaveBeenCalledTimes(1);
    expect(re.mock.calls[0]![0]).toMatchObject({ connectionId: "c1", sourcePortId: "osc", targetPortId: "rec", source: "list" });
    expect(document.querySelector('[data-cable="c1"]')).not.toBeNull(); // original still drawn
    expect(document.querySelector("[data-pending-cable]")).not.toBeNull();
    rerender(<Bay onReconnectRequest={re} resolution={{ requestId: re.mock.calls[0]![0].requestId, accepted: false, message: "Recorder is busy" }} />);
    expect(document.querySelector('[data-cable="c1"]')).not.toBeNull();
    expect(document.querySelector("[data-pending-cable]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Recorder is busy");
    expect(list.getByText("Osc out → Amp in")).toBeInTheDocument();
  });

  it("a removed source cancels the pending cable without touching other edges (C45-T04)", async () => {
    const { rerender } = render(<Bay />);
    installLayout();
    await flush();
    await userEvent.click(port("Noise out"));
    expect(document.querySelector('[data-slot="cable-patchbay"]')).toHaveAttribute("data-state", "connecting");
    rerender(<Bay ports={PORTS.filter((p) => p.id !== "noise")} />);
    expect(document.querySelector('[data-slot="cable-patchbay"]')).toHaveAttribute("data-state", "idle");
    expect(screen.getByRole("status")).toHaveTextContent("The source port was removed");
    expect(within(screen.getByRole("list", { name: "Connections" })).getByText("Osc out → Amp in")).toBeInTheDocument();
  });

  it("re-measures on resize and scroll so endpoints stay attached (C45-T05)", async () => {
    render(<Bay />);
    installLayout();
    await flush();
    const d0 = document.querySelector('[data-cable="c1"] path')!.getAttribute("d");
    ROW.amp = 60; // the panel reflowed
    const sock = document.querySelector<HTMLElement>('[data-port="amp"] [data-socket]')!;
    sock.getBoundingClientRect = () => ({ left: 389, top: 49, width: 22, height: 22, right: 411, bottom: 71, x: 389, y: 49, toJSON() {} }) as DOMRect;
    await act(async () => roCallbacks.forEach((cb) => cb()));
    const d1 = document.querySelector('[data-cable="c1"] path')!.getAttribute("d");
    expect(d1).not.toBe(d0);
    expect(d1).toMatch(/400 60$/);
    sock.getBoundingClientRect = () => ({ left: 389, top: 129, width: 22, height: 22, right: 411, bottom: 151, x: 389, y: 129, toJSON() {} }) as DOMRect;
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(document.querySelector('[data-cable="c1"] path')!.getAttribute("d")).toMatch(/400 140$/);
    ROW.amp = 20;
  });

  it("two rapid releases produce one request (C45-T06)", async () => {
    const req = vi.fn();
    render(<Bay onConnectRequest={req} />);
    installLayout();
    await flush();
    const noise = port("Noise out");
    noise.setPointerCapture = () => {};
    noise.releasePointerCapture = () => {};
    down(noise, 20, 100);
    move(noise, 200, 100);
    move(noise, 398, 102);
    up(noise, 398, 102);
    up(noise, 398, 102);
    down(noise, 20, 100);
    move(noise, 398, 102);
    up(noise, 398, 102);
    expect(req).toHaveBeenCalledTimes(1);
    expect(port("Noise out")).toHaveAttribute("aria-disabled", "true");
  });

  it("every connection is readable and removable from the list; the cable menu disconnects too (C45-T08)", async () => {
    const dis = vi.fn();
    const { rerender } = render(<Bay onDisconnectRequest={dis} />);
    installLayout();
    await flush();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Osc out from Amp in" }));
    expect(dis).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "c1", source: "list" }));
    expect(screen.getByRole("status")).toHaveTextContent("Disconnecting…");
    rerender(<Bay onDisconnectRequest={dis} connections={[CONNS[1]!]} resolution={{ requestId: dis.mock.calls[0]![0].requestId, accepted: true }} />);
    expect(within(screen.getByRole("list", { name: "Connections" })).getByText("None yet.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Disconnected.");
  });

  it("reduced motion keeps snapping and validation (C45-T09)", async () => {
    const req = vi.fn();
    render(<Bay motion="reduced" onConnectRequest={req} />);
    installLayout();
    await flush();
    expect(document.querySelector('[data-slot="cable-patchbay"]')).toHaveAttribute("data-motion", "reduced");
    const noise = port("Noise out");
    noise.setPointerCapture = () => {};
    noise.releasePointerCapture = () => {};
    down(noise, 20, 100);
    move(noise, 200, 100);
    move(noise, 392, 136); // snaps to Rec in
    expect(port("Rec in")).toHaveAttribute("data-snapped", "true");
    up(noise, 392, 136);
    expect(req.mock.calls[0]![0]).toMatchObject({ targetPortId: "rec" });
  });

  it("unmount removes observers and window listeners (C45-T10)", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Bay />);
    installLayout();
    await flush();
    expect(add.mock.calls.some((c) => c[0] === "scroll")).toBe(true);
    unmount();
    expect(remove.mock.calls.some((c) => c[0] === "scroll")).toBe(true);
    expect(remove.mock.calls.some((c) => c[0] === "resize")).toBe(true);
    add.mockRestore();
    remove.mockRestore();
  });

  it("Escape cancels connect mode and the ref focuses ports", async () => {
    const ref = { current: null as CablePatchbayHandle | null };
    render(<Bay ref={ref} />);
    await userEvent.click(port("Osc out"));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    act(() => ref.current!.focusPort("fx"));
    expect(port("FX in")).toHaveFocus();
  });
});
