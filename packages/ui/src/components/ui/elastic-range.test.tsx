import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ElasticRange, type ElasticRangeValue } from "./elastic-range";

/* jsdom has no layout; give the track a 200px box at x=100..300 and real pointer capture. */
function layout() {
  const track = document.querySelector('[data-slot="elastic-range"] .touch-none') as HTMLElement;
  track.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, height: 44, right: 300, bottom: 44, x: 100, y: 0, toJSON() {} }) as DOMRect;
  track.setPointerCapture = () => {};
  track.releasePointerCapture = () => {};
  return track;
}
const down = (el: Element, x: number, id = 1) => fireEvent.pointerDown(el, { clientX: x, clientY: 20, pointerId: id, button: 0 });
const move = (el: Element, x: number, id = 1) => fireEvent.pointerMove(el, { clientX: x, clientY: 20, pointerId: id });
const up = (el: Element, x: number, id = 1) => fireEvent.pointerUp(el, { clientX: x, clientY: 20, pointerId: id });

describe("ElasticRange", () => {
  it("is a labelled slider with aria-value* and quantizes to the step", () => {
    render(<ElasticRange labels={{ label: "Volume" }} defaultValue={37.3} step={5} />);
    const s = screen.getByRole("slider", { name: "Volume" });
    expect(s).toHaveAttribute("aria-valuemin", "0");
    expect(s).toHaveAttribute("aria-valuemax", "100");
    expect(s).toHaveAttribute("aria-valuenow", "35");
  });

  it("never emits an illegal value when dragged far past either end (C41-T01)", () => {
    const preview = vi.fn();
    const commit = vi.fn();
    render(<ElasticRange labels={{ label: "V" }} defaultValue={50} onValuePreview={preview} onValueCommit={commit} motion="off" />);
    const track = layout();
    down(track, 200);
    move(track, 800);
    move(track, -500);
    up(track, -500);
    const all = [...preview.mock.calls, ...commit.mock.calls].map((c) => c[0] as number);
    expect(all.length).toBeGreaterThan(0);
    for (const v of all) expect(v >= 0 && v <= 100).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenLastCalledWith(0, { source: "pointer", thumb: "lower" });
  });

  it("keeps interval thumbs from crossing or shrinking below minGap (C41-T02)", async () => {
    const commit = vi.fn();
    render(<ElasticRange variant="interval" labels={{ label: "Price" }} defaultValue={[20, 60]} minGap={10} onValueCommit={commit} motion="off" />);
    const lower = screen.getByRole("slider", { name: "Lower bound" });
    const upper = screen.getByRole("slider", { name: "Upper bound" });
    // keyboard: walk the lower thumb up past the upper
    await act(async () => lower.focus());
    for (let i = 0; i < 6; i++) await userEvent.keyboard("{PageUp}");
    expect(lower).toHaveAttribute("aria-valuenow", "50");
    expect(upper).toHaveAttribute("aria-valuenow", "60");
    // pointer: drag the upper thumb below the lower
    const track = layout();
    down(track, 100 + 200 * 0.6); // nearest = upper (at 60)
    move(track, 100);
    up(track, 100);
    const [lo, hi] = commit.mock.calls.at(-1)![0] as [number, number];
    expect(hi - lo).toBe(10);
    expect(lo).toBe(50);
    // text input
    const input = screen.getByRole("textbox", { name: "Upper bound value" });
    await userEvent.clear(input);
    await userEvent.type(input, "5{Enter}");
    expect(upper).toHaveAttribute("aria-valuenow", "60"); // clamped to lower + gap
  });

  it("picks the lower thumb on an equidistant track tap (C41-T03)", () => {
    const commit = vi.fn();
    render(<ElasticRange variant="interval" labels={{ label: "R" }} defaultValue={[40, 60]} onValueCommit={commit} motion="off" />);
    const track = layout();
    down(track, 200); // 50%: exactly between 40 and 60
    up(track, 200);
    expect(commit).toHaveBeenCalledWith([50, 60], { source: "pointer", thumb: "lower" });
    down(track, 200);
    up(track, 200);
    expect(commit).toHaveBeenLastCalledWith([50, 60], { source: "pointer", thumb: "lower" });
  });

  it("emits exactly one commit per release and previews during the drag (C41-T04)", () => {
    const preview = vi.fn();
    const commit = vi.fn();
    render(<ElasticRange labels={{ label: "V" }} defaultValue={0} onValuePreview={preview} onValueCommit={commit} motion="off" />);
    const track = layout();
    down(track, 150);
    move(track, 160);
    move(track, 170);
    expect(commit).not.toHaveBeenCalled();
    expect(preview.mock.calls.length).toBe(3);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "35");
    expect(document.querySelector('[data-slot="elastic-range"]')).toHaveAttribute("data-previewing", "true");
    up(track, 170);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(35, { source: "pointer", thumb: "lower" });
    expect(document.querySelector('[data-slot="elastic-range"]')).not.toHaveAttribute("data-previewing");
    // a second pointer id during the drag is ignored
    down(track, 150, 1);
    up(track, 150, 2);
    expect(commit).toHaveBeenCalledTimes(1);
    up(track, 150, 1);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("cancels the preview when the parent replaces the value mid-drag (C41-T05)", () => {
    const commit = vi.fn();
    const { rerender } = render(<ElasticRange labels={{ label: "V" }} value={10} onValueCommit={commit} motion="off" />);
    const track = layout();
    down(track, 200);
    move(track, 250);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "75");
    rerender(<ElasticRange labels={{ label: "V" }} value={90} onValueCommit={commit} motion="off" />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "90");
    up(track, 250);
    expect(commit).not.toHaveBeenCalled();
  });

  it("is controlled: the parent decides whether a commit lands", async () => {
    const commit = vi.fn();
    render(<ElasticRange labels={{ label: "V" }} value={40} onValueCommit={commit} />);
    const s = screen.getByRole("slider");
    await act(async () => s.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(commit).toHaveBeenCalledWith(41, { source: "keyboard", thumb: "lower" });
    expect(s).toHaveAttribute("aria-valuenow", "40");
  });

  it("steps by 0.1 ten times without float drift (C41-T06)", async () => {
    render(<ElasticRange labels={{ label: "Gain" }} min={0} max={1} step={0.1} defaultValue={0} />);
    const s = screen.getByRole("slider");
    await act(async () => s.focus());
    for (let i = 0; i < 10; i++) await userEvent.keyboard("{ArrowRight}");
    expect(s).toHaveAttribute("aria-valuenow", "1");
    expect(s).toHaveAttribute("aria-valuetext", "1.0");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(s).toHaveAttribute("aria-valuenow", "0.7");
  });

  it("sets both interval values with taps, buttons and text, never dragging (C41-T07)", async () => {
    const commit = vi.fn();
    render(<ElasticRange variant="interval" labels={{ label: "R" }} defaultValue={[20, 80]} onValueCommit={commit} motion="off" />);
    const track = layout();
    down(track, 110); // 5% → lower
    up(track, 110);
    expect(commit).toHaveBeenLastCalledWith([5, 80], expect.objectContaining({ source: "pointer", thumb: "lower" }));
    await userEvent.click(screen.getByRole("button", { name: "Increase Upper bound value" }));
    expect(commit).toHaveBeenLastCalledWith([5, 81], { source: "button", thumb: "upper" });
    const input = screen.getByRole("textbox", { name: "Lower bound value" });
    await userEvent.clear(input);
    await userEvent.type(input, "33{Enter}");
    expect(commit).toHaveBeenLastCalledWith([33, 81], { source: "input", thumb: "lower" });
    expect(screen.getByRole("slider", { name: "Lower bound" })).toHaveAttribute("aria-valuenow", "33");
  });

  it("rejects invalid text and keeps the committed value", async () => {
    const commit = vi.fn();
    render(<ElasticRange labels={{ label: "V" }} defaultValue={40} onValueCommit={commit} />);
    const input = screen.getByRole("textbox", { name: "V value" });
    await userEvent.clear(input);
    await userEvent.type(input, "4x{Enter}");
    expect(commit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "40");
  });

  it("serialises to forms, resets with the form and is inert when disabled (C41-T08)", async () => {
    const preview = vi.fn();
    const commit = vi.fn();
    const { container, rerender } = render(
      <form>
        <ElasticRange variant="interval" name="price" labels={{ label: "Price" }} defaultValue={[20, 60]} />
      </form>,
    );
    const form = container.querySelector("form")!;
    let data = new FormData(form);
    expect(data.get("price.lower")).toBe("20");
    expect(data.get("price.upper")).toBe("60");
    await act(async () => screen.getByRole("slider", { name: "Lower bound" }).focus());
    await userEvent.keyboard("{End}");
    data = new FormData(form);
    expect(data.get("price.lower")).toBe("60");
    rerender(
      <form>
        <ElasticRange variant="interval" name="price" labels={{ label: "Price" }} defaultValue={[20, 60]} disabled onValuePreview={preview} onValueCommit={commit} />
      </form>,
    );
    const track = layout();
    down(track, 200);
    move(track, 250);
    up(track, 250);
    await act(async () => screen.getByRole("slider", { name: "Lower bound" }).focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(new FormData(form).get("price.lower")).toBeNull(); // disabled fields do not submit
  });

  it("reduced motion keeps numeric editing and removes the bow (C41-T09)", async () => {
    const commit = vi.fn();
    render(<ElasticRange labels={{ label: "V" }} defaultValue={10} motion="reduced" onValueCommit={commit} />);
    expect(document.querySelector('[data-slot="elastic-range"]')).toHaveAttribute("data-motion", "reduced");
    const track = layout();
    down(track, 200);
    move(track, 900);
    expect(document.querySelector("path")!.getAttribute("d")).toBe("M 0 4 Q 50 4 100 4");
    up(track, 900);
    expect(commit).toHaveBeenCalledWith(100, expect.anything());
    const input = screen.getByRole("textbox", { name: "V value" });
    await userEvent.clear(input);
    await userEvent.type(input, "42{Enter}");
    expect(commit).toHaveBeenLastCalledWith(42, { source: "input", thumb: "lower" });
  });

  it("works controlled end to end", async () => {
    function Host() {
      const [v, setV] = useState<ElasticRangeValue>(30);
      return (
        <>
          <ElasticRange labels={{ label: "V" }} value={v} onValueCommit={setV} />
          <output>{String(v)}</output>
        </>
      );
    }
    render(<Host />);
    await act(async () => screen.getByRole("slider").focus());
    await userEvent.keyboard("{PageUp}{Home}{End}");
    expect(screen.getByRole("status").textContent).toBe("100");
  });

  it("falls back to a valid domain and warns once when configured badly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ElasticRange labels={{ label: "V" }} min={10} max={5} defaultValue={3} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuemax", "100");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
