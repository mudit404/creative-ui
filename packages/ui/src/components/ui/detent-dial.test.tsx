import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetentDial } from "./detent-dial";

function knob() {
  const el = screen.getByRole("slider") as HTMLElement;
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  return el;
}
const down = (el: Element, y: number, id = 1) => fireEvent.pointerDown(el, { clientX: 40, clientY: y, pointerId: id, button: 0 });
const move = (el: Element, y: number, id = 1) => fireEvent.pointerMove(el, { clientX: 40, clientY: y, pointerId: id });
const up = (el: Element, y: number, id = 1) => fireEvent.pointerUp(el, { clientX: 40, clientY: y, pointerId: id });

describe("DetentDial", () => {
  it("is a labelled slider whose value text includes the unit", () => {
    render(<DetentDial label="Gain" unit="dB" min={-60} max={12} defaultValue={-6} />);
    const s = screen.getByRole("slider", { name: "Gain" });
    expect(s).toHaveAttribute("aria-valuemin", "-60");
    expect(s).toHaveAttribute("aria-valuemax", "12");
    expect(s).toHaveAttribute("aria-valuenow", "-6");
    expect(s).toHaveAttribute("aria-valuetext", "-6 dB");
  });

  it("does not flicker when dragging slowly across a detent boundary (C42-T01)", () => {
    const preview = vi.fn();
    // span 100, dragDistance 100 → 1px = 1 unit; detent at 50, snapIn 2, snapOut 4
    render(<DetentDial label="D" defaultValue={40} detents={[50]} dragDistance={100} onValuePreview={preview} motion="off" />);
    const k = knob();
    down(k, 500);
    for (let dy = 1; dy <= 20; dy++) move(k, 500 - dy); // 41 → 60, 1 unit per step
    const values = preview.mock.calls.map((c) => c[0] as number);
    expect(values[0]).toBe(41);
    expect(values.at(-1)).toBe(60);
    // the sequence is monotonic non-decreasing: snapped at 48..54 then releases
    for (let i = 1; i < values.length; i++) expect(values[i]! >= values[i - 1]!).toBe(true);
    const snapped = preview.mock.calls.filter((c) => c[1].detent).map((c) => c[0]);
    expect(new Set(snapped)).toEqual(new Set([50]));
    // exactly one contiguous snapped run
    const flags = preview.mock.calls.map((c) => (c[1].detent ? 1 : 0)).join("");
    expect(flags).toMatch(/^0*1+0*$/);
    up(k, 480);
  });

  it("falls back to linear with a diagnostic when log scale gets min=0 (C42-T02)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<DetentDial label="Freq" scale="log" min={0} max={1000} defaultValue={500} />);
    const root = document.querySelector('[data-slot="detent-dial"]')!;
    expect(root.getAttribute("data-diagnostic")).toMatch(/log scale requires min > 0/);
    expect(screen.getByRole("note")).toHaveTextContent(/linear/);
    expect(warn).toHaveBeenCalledTimes(1);
    const s = screen.getByRole("slider");
    expect(s).toHaveAttribute("aria-valuenow", "500");
    warn.mockRestore();
  });

  it("reaches the same endpoints by Home/End, numeric entry and dragging (C42-T03)", async () => {
    const commit = vi.fn();
    render(<DetentDial label="D" min={10} max={90} defaultValue={50} dragDistance={100} onValueCommit={commit} motion="off" />);
    const s = knob();
    await act(async () => s.focus());
    await userEvent.keyboard("{End}");
    expect(commit).toHaveBeenLastCalledWith(90, { source: "keyboard", detent: false });
    await userEvent.keyboard("{Home}");
    expect(commit).toHaveBeenLastCalledWith(10, { source: "keyboard", detent: false });
    const input = screen.getByRole("textbox", { name: "D value" });
    await userEvent.clear(input);
    await userEvent.type(input, "999{Enter}");
    expect(commit).toHaveBeenLastCalledWith(90, { source: "input", detent: false });
    down(s, 500);
    move(s, 1500); // far past the bottom
    up(s, 1500);
    expect(commit).toHaveBeenLastCalledWith(10, { source: "pointer", detent: false });
  });

  it("cancels a pending drag when the controlled value is replaced (C42-T04)", () => {
    const commit = vi.fn();
    const { rerender } = render(<DetentDial label="D" value={20} dragDistance={100} onValueCommit={commit} motion="off" />);
    const s = knob();
    down(s, 500);
    move(s, 470);
    expect(s).toHaveAttribute("aria-valuenow", "50");
    rerender(<DetentDial label="D" value={80} dragDistance={100} onValueCommit={commit} motion="off" />);
    expect(s).toHaveAttribute("aria-valuenow", "80");
    up(s, 470);
    expect(commit).not.toHaveBeenCalled();
  });

  it("resets to its documented value, not zero (C42-T05)", async () => {
    const commit = vi.fn();
    render(<DetentDial label="Pan" min={-100} max={100} defaultValue={35} resetValue={0} onValueCommit={commit} />);
    await userEvent.click(screen.getByRole("button", { name: "Reset Pan" }));
    expect(commit).toHaveBeenLastCalledWith(0, { source: "reset", detent: false });
    commit.mockClear();
    const { unmount } = render(<DetentDial label="Q" defaultValue={7} onValueCommit={commit} />);
    await userEvent.click(screen.getByRole("button", { name: "Increase Q" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset Q" }));
    expect(commit).toHaveBeenLastCalledWith(7, { source: "reset", detent: false });
    unmount();
  });

  it("keeps the indicator inside the arc during a default drag (C42-T06)", () => {
    render(<DetentDial label="D" defaultValue={50} dragDistance={100} motion="off" />);
    const s = knob();
    const notch = () => document.querySelector("g")!;
    down(s, 500);
    for (const y of [200, 100, -400, 900, 1400]) {
      move(s, y);
      const rot = parseFloat((notch().style.transform.match(/rotate\(([-\d.]+)deg\)/) ?? [])[1] ?? "0");
      expect(rot).toBeGreaterThanOrEqual(-135);
      expect(rot).toBeLessThanOrEqual(135);
    }
    up(s, 1400);
  });

  it("ignores invalid text and keeps the last committed value (C42-T07)", async () => {
    const commit = vi.fn();
    render(<DetentDial label="D" defaultValue={42} onValueCommit={commit} />);
    const input = screen.getByRole("textbox", { name: "D value" });
    await userEvent.clear(input);
    await userEvent.type(input, "abc{Enter}");
    expect(commit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "42");
    await userEvent.clear(input);
    await userEvent.type(input, "43,5{Enter}");
    expect(commit).toHaveBeenLastCalledWith(44, { source: "input", detent: false });
  });

  it("adjusts fully without drag or wheel: arrows, fine step, buttons (C42-T08)", async () => {
    const commit = vi.fn();
    render(<DetentDial label="D" min={0} max={10} step={1} fineStep={0.1} defaultValue={5} onValueCommit={commit} wheel="off" />);
    const s = knob();
    await act(async () => s.focus());
    await userEvent.keyboard("{ArrowUp}");
    expect(commit).toHaveBeenLastCalledWith(6, { source: "keyboard", detent: false });
    await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(commit).toHaveBeenLastCalledWith(5.9, { source: "keyboard", detent: false });
    await userEvent.click(screen.getByRole("button", { name: "Decrease D" }));
    expect(commit).toHaveBeenLastCalledWith(4.9, { source: "button", detent: false });
    fireEvent.wheel(s, { deltaY: -100 });
    expect(commit).toHaveBeenCalledTimes(3); // wheel off
  });

  it("stepped variant commits detents only", async () => {
    const commit = vi.fn();
    render(<DetentDial label="Mode" variant="stepped" detents={[0, 25, 50, 75, 100]} defaultValue={30} onValueCommit={commit} />);
    const s = knob();
    expect(s).toHaveAttribute("aria-valuenow", "25");
    await act(async () => s.focus());
    await userEvent.keyboard("{ArrowUp}");
    expect(commit).toHaveBeenLastCalledWith(50, { source: "keyboard", detent: true });
    await userEvent.keyboard("{End}");
    expect(commit).toHaveBeenLastCalledWith(100, { source: "keyboard", detent: true });
    const input = screen.getByRole("textbox", { name: "Mode value" });
    await userEvent.clear(input);
    await userEvent.type(input, "60{Enter}");
    expect(commit).toHaveBeenLastCalledWith(50, { source: "input", detent: true });
  });

  it("runs no rotation animation while disabled or reduced, but stays accurate (C42-T09)", async () => {
    const commit = vi.fn();
    const { rerender } = render(<DetentDial label="D" defaultValue={10} motion="reduced" onValueCommit={commit} />);
    const root = document.querySelector('[data-slot="detent-dial"]')!;
    expect(root).toHaveAttribute("data-motion", "reduced");
    const s = knob();
    await act(async () => s.focus());
    await userEvent.keyboard("{PageUp}");
    expect(commit).toHaveBeenLastCalledWith(20, expect.anything());
    rerender(<DetentDial label="D" defaultValue={10} disabled onValueCommit={commit} />);
    expect(s).toHaveAttribute("aria-disabled", "true");
    down(s, 500);
    move(s, 400);
    up(s, 400);
    await userEvent.keyboard("{ArrowUp}");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reset D" })).toBeDisabled();
  });

  it("exposes an imperative handle for focusing the input and the dial", () => {
    const ref = { current: null as null | { focusValueInput: () => void; focusDial: () => void } };
    render(<DetentDial ref={ref} label="D" />);
    act(() => ref.current!.focusValueInput());
    expect(screen.getByRole("textbox")).toHaveFocus();
    act(() => ref.current!.focusDial());
    expect(screen.getByRole("slider")).toHaveFocus();
  });
});
