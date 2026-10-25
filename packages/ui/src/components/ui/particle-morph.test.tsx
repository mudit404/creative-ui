import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticleMorph, type MaskDecoder, type MorphTarget, type ParticleMorphHandle } from "./particle-morph";
import { meanDistance, sampleMask } from "@/lib/point-targets";

function disc(size: number, r: number, color = [200, 60, 30]) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = color[0]!; data[i + 1] = color[1]!; data[i + 2] = color[2]!;
      data[i + 3] = Math.hypot(x - size / 2, y - size / 2) <= r ? 255 : 0;
    }
  return { data, width: size, height: size };
}
function square(size: number, half: number) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = 30; data[i + 1] = 60; data[i + 2] = 200;
      data[i + 3] = Math.abs(x - size / 2) <= half && Math.abs(y - size / 2) <= half ? 255 : 0;
    }
  return { data, width: size, height: size };
}
const MASKS: Record<string, ReturnType<typeof disc>> = { "disc.png": disc(64, 24), "square.png": square(64, 20), "empty.png": disc(16, 0) };
const decoder: MaskDecoder = async (src) => {
  const m = MASKS[src];
  if (!m) throw new Error(`The image could not be loaded: ${src}`);
  return m;
};
const TARGETS: MorphTarget[] = [
  { id: "disc", label: "Disc", type: "image", src: "disc.png", fallback: "/disc.svg" },
  { id: "square", label: "Square", type: "image", src: "square.png", fallback: "/square.svg" },
  { id: "cloud", label: "Cloud", type: "points", points: new Float32Array(300).map((_, i) => Math.sin(i * 1.7) * 2), fallback: "/cloud.svg" },
  { id: "missing", label: "Missing", type: "image", src: "nope.png", fallback: "/missing.svg" },
];
const Morph = (props: Partial<React.ComponentProps<typeof ParticleMorph>>) => <ParticleMorph targets={TARGETS} decoder={decoder} pointCount={400} renderer="none" motion="off" {...props} />;
const root = () => document.querySelector('[data-slot="particle-morph"]')!;

describe("ParticleMorph", () => {
  it("renders the fallback and label first, prepares the target and reaches a recognizable endpoint (C54-T01)", async () => {
    const ready = vi.fn();
    const complete = vi.fn();
    const ref = { current: null as ParticleMorphHandle | null };
    render(<Morph ref={ref} onTargetReady={ready} onMorphComplete={complete} />);
    expect(screen.getByRole("img", { name: "Disc" })).toHaveAttribute("src", "/disc.svg");
    expect(document.querySelector("[data-label]")).toHaveTextContent("Disc");
    expect(root()).toHaveAttribute("data-state", "preparing");
    await waitFor(() => expect(ready).toHaveBeenCalledWith("disc"));
    await waitFor(() => expect(complete).toHaveBeenCalledWith("disc", 1)); // completion follows readiness after a render, never in the same tick
    const pos = ref.current!.getPositions()!;
    const expected = sampleMask(MASKS["disc.png"]!, 400, 1)!.positions;
    expect(meanDistance(pos, expected)).toBeCloseTo(0, 6);
    expect(root()).toHaveAttribute("data-state", "fallback"); // no renderer: the image stays as the identity
    expect(screen.getByRole("img", { name: "Disc" })).not.toHaveClass("opacity-0");
  });

  it("identical seed and input reproduce identical ordering; quality cannot mix lengths (C54-T02, C54-T07)", async () => {
    const refA = { current: null as ParticleMorphHandle | null };
    const refB = { current: null as ParticleMorphHandle | null };
    render(
      <>
        <Morph ref={refA} seed={5} label="A" />
        <Morph ref={refB} seed={5} label="B" pointCount={200} />
      </>,
    );
    await waitFor(() => expect(refA.current!.getPositions()).not.toBeNull());
    await waitFor(() => expect(refB.current!.getPositions()).not.toBeNull());
    expect(refA.current!.getPositions()!.length).toBe(1200);
    expect(refB.current!.getPositions()!.length).toBe(600);
    const again = sampleMask(MASKS["disc.png"]!, 400, 5)!.positions;
    expect(Array.from(refA.current!.getPositions()!)).toEqual(Array.from(again));
  });

  it("one hundred rapid requests keep only the latest target; a missing asset keeps label and fallback (C54-T04, C54-T05)", async () => {
    const req = vi.fn();
    const err = vi.fn();
    render(<Morph onTargetRequest={req} onTargetError={err} />);
    await waitFor(() => expect(root()).not.toHaveAttribute("data-state", "preparing"));
    const btn = (name: string) => screen.getByRole("button", { name });
    for (let i = 0; i < 100; i++) await userEvent.click(i % 2 ? btn("Square") : btn("Cloud"));
    expect(req).toHaveBeenCalledTimes(100);
    expect(root()).toHaveAttribute("data-target", "square");
    await waitFor(() => expect(root()).toHaveAttribute("data-shown", "square"));
    expect(btn("Square")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(btn("Missing"));
    await waitFor(() => expect(err).toHaveBeenCalledWith("missing", expect.stringMatching(/could not be loaded/)));
    expect(root()).toHaveAttribute("data-state", "error");
    expect(screen.getByRole("img", { name: "Missing" })).toHaveAttribute("src", "/missing.svg");
    expect(document.querySelector("[data-label]")).toHaveTextContent("Missing");
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
    expect(root()).toHaveAttribute("data-shown", "square"); // the last complete emblem is retained
  });

  it("reduced motion updates immediately and reports no progress percentage (C54-T06, C54-T09)", async () => {
    const complete = vi.fn();
    render(<Morph motion="reduced" onMorphComplete={complete} />);
    await waitFor(() => expect(complete).toHaveBeenCalledWith("disc", 1));
    await userEvent.click(screen.getByRole("button", { name: "Square" }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith("square", 2));
    expect(root()).toHaveAttribute("data-motion", "reduced");
    expect(root().textContent).not.toMatch(/\d+%/);
  });

  it("is controlled when targetId is given and cancels preparation on unmount (C54-T08)", async () => {
    const req = vi.fn();
    let abortSeen = false;
    const slow: MaskDecoder = (src, signal) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve(MASKS[src]!), 500);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          abortSeen = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const { unmount } = render(<Morph decoder={slow} targetId="disc" onTargetRequest={req} />);
    await userEvent.click(screen.getByRole("button", { name: "Square" }));
    expect(req).toHaveBeenCalledWith("square");
    expect(root()).toHaveAttribute("data-target", "disc"); // parent did not change it
    unmount();
    expect(abortSeen).toBe(true);
  });

  it("exposes requestTarget and focusControls", async () => {
    const ref = { current: null as ParticleMorphHandle | null };
    render(<Morph ref={ref} />);
    act(() => ref.current!.requestTarget("cloud"));
    expect(root()).toHaveAttribute("data-target", "cloud");
    await waitFor(() => expect(root()).toHaveAttribute("data-shown", "cloud"));
    act(() => ref.current!.focusControls());
    expect(screen.getByRole("button", { name: "Disc" })).toHaveFocus();
  });
});
