import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AsciiMedia, type AsciiMediaHandle, type FrameSampler } from "./ascii-media";

/** Grayscale ramp frame: luminance rises left→right. */
const gradient: FrameSampler = (_m, cols, rows) => {
  const data = new Uint8ClampedArray(cols * rows * 4);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const v = Math.round((x / (cols - 1)) * 255);
      data.set([v, v, v, 255], (y * cols + x) * 4);
    }
  return { data, width: cols, height: rows };
};
const tainted: FrameSampler = () => {
  throw new DOMException("The canvas has been tainted by cross-origin data.", "SecurityError");
};

let roCb: (() => void) | null = null;
class RO {
  constructor(cb: () => void) {
    roCb = cb;
  }
  observe(el: Element) {
    Object.defineProperty(el, "clientWidth", { value: 960, configurable: true });
    queueMicrotask(() => roCb?.());
  }
  unobserve() {}
  disconnect() {}
}
const originalRO = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});
afterEach(() => {
  globalThis.ResizeObserver = originalRO;
  vi.restoreAllMocks();
});
const loadImage = (w = 1600, h = 900) => {
  const img = document.querySelector("img")!;
  Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
  fireEvent.load(img);
};
const root = () => document.querySelector('[data-slot="ascii-media"]')!;
const Img = (props: Partial<React.ComponentProps<typeof AsciiMedia>>) => <AsciiMedia source={{ kind: "image", src: "/photo.jpg", alt: "A lighthouse at dusk" }} sampler={gradient} motion="off" {...props} />;

describe("AsciiMedia", () => {
  it("renders the original first, then converts with a grid that preserves aspect (C55-T01, C55-T02, C55-T06)", async () => {
    const onReady = vi.fn();
    render(<Img onReady={onReady} />);
    expect(screen.getByRole("img", { name: "A lighthouse at dusk" })).toBeInTheDocument();
    expect(root()).toHaveAttribute("data-state", "original");
    loadImage();
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "ascii"));
    expect(onReady).toHaveBeenCalledWith({ cols: 96, rows: 32 });
    expect(root()).toHaveAttribute("data-cols", "96");
    expect(root()).toHaveAttribute("data-rows", "32");
    expect(root()).toHaveAttribute("data-showing", "ascii");
    expect(document.querySelector("[data-glyphs]")).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelectorAll("span").length).toBeLessThan(10); // no thousands of glyph nodes
    expect(screen.getByRole("status")).toHaveTextContent("96×32 cells");
    const { unmount } = render(<Img columns={48} label="half" />);
    const img2 = document.querySelectorAll("img")[1]!;
    Object.defineProperty(img2, "naturalWidth", { value: 1600, configurable: true });
    Object.defineProperty(img2, "naturalHeight", { value: 900, configurable: true });
    fireEvent.load(img2);
    await waitFor(() => expect(document.querySelectorAll('[data-slot="ascii-media"]')[1]).toHaveAttribute("data-rows", "16"));
    unmount();
  });

  it("the Original switch keeps the same media element and playback state (C55-T04)", async () => {
    const onShow = vi.fn();
    const ref = { current: null as AsciiMediaHandle | null };
    render(<AsciiMedia ref={ref} source={{ kind: "video", src: "/clip.webm", description: "Waves" }} sampler={gradient} motion="off" onShowOriginalChange={onShow} />);
    const video = document.querySelector("video")!;
    Object.defineProperty(video, "videoWidth", { value: 1280, configurable: true });
    Object.defineProperty(video, "videoHeight", { value: 720, configurable: true });
    fireEvent.loadedMetadata(video);
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "ascii"));
    video.currentTime = 4.2;
    await userEvent.click(screen.getByRole("button", { name: "Show original" }));
    expect(onShow).toHaveBeenCalledWith(true);
    expect(root()).toHaveAttribute("data-showing", "original");
    expect(document.querySelector("video")).toBe(video);
    expect(video.currentTime).toBe(4.2);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(ref.current!.media).toBe(video);
    await userEvent.click(screen.getByRole("button", { name: "Show ASCII" }));
    expect(root()).toHaveAttribute("data-showing", "ascii");
  });

  it("a paused video does not keep sampling; reduced motion uses the native player (C55-T03, C55-T09)", async () => {
    const sampler = vi.fn(gradient);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      setTimeout(() => cb(performance.now()), 0);
      return 1;
    });
    const { rerender } = render(<AsciiMedia source={{ kind: "video", src: "/clip.webm", description: "Waves" }} sampler={sampler} motion="off" />);
    const video = document.querySelector("video")!;
    Object.defineProperty(video, "videoWidth", { value: 1280, configurable: true });
    Object.defineProperty(video, "videoHeight", { value: 720, configurable: true });
    fireEvent.loadedMetadata(video);
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "ascii"));
    const calls = sampler.mock.calls.length;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(sampler.mock.calls.length).toBe(calls); // paused: one conversion, no loop
    expect(raf).not.toHaveBeenCalled();
    rerender(<AsciiMedia source={{ kind: "video", src: "/clip.webm", description: "Waves" }} sampler={sampler} motion="reduced" />);
    expect(root()).toHaveAttribute("data-showing", "original");
    expect(screen.getByRole("status")).toHaveTextContent("Reduced motion: showing the native player.");
    expect(screen.getByRole("button", { name: "Show original" })).toBeDisabled();
    expect(document.querySelector("video")).toHaveAttribute("controls");
  });

  it("a cross-origin read failure restores the original with a reason (C55-T05)", async () => {
    const onError = vi.fn();
    render(<Img sampler={tainted} onError={onError} />);
    loadImage();
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "error"));
    expect(screen.getByRole("status")).toHaveTextContent("cross-origin");
    expect(onError).toHaveBeenCalledWith({ reason: "origin", message: expect.stringMatching(/tainted/) });
    expect(root()).toHaveAttribute("data-showing", "original");
    expect(screen.getByRole("img", { name: "A lighthouse at dusk" })).not.toHaveClass("opacity-0");
  });

  it("changing the source invalidates old callbacks and a missing media errors readably (C55-T07)", async () => {
    const onReady = vi.fn();
    const { rerender } = render(<Img onReady={onReady} />);
    loadImage();
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    rerender(<Img onReady={onReady} source={{ kind: "image", src: "/other.jpg", alt: "Other" }} />);
    expect(root()).toHaveAttribute("data-state", "original");
    fireEvent.error(document.querySelector("img")!);
    expect(root()).toHaveAttribute("data-state", "error");
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default ramp for invalid ramps and reports a missing font (C55-T08)", async () => {
    const onError = vi.fn();
    Object.defineProperty(document, "fonts", { value: { load: vi.fn().mockResolvedValue([]) }, configurable: true });
    render(<Img glyphRamp="🙂" fontFamily="Nope Mono, monospace" onError={onError} />);
    loadImage();
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "ascii"));
    expect(screen.getByRole("status")).toHaveTextContent("using the default ramp");
    expect(onError).toHaveBeenCalledWith({ reason: "font", message: expect.stringMatching(/did not load/) });
  });
});
