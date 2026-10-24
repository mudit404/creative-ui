import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GhostTraceText } from "./ghost-trace-text";

describe("GhostTraceText", () => {
  it("keeps the real text in a semantic heading and hides the SVG from AT", () => {
    const { container } = render(
      <GhostTraceText as="h1" trigger="manual">
        Make it move
      </GhostTraceText>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Make it move" });
    expect(h1).toHaveAttribute("data-slot", "ghost-trace-text");
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll('text[data-layer="ghost"]')).toHaveLength(1);
    expect(svg.querySelector('text[data-layer="fill"]')?.textContent).toBe("Make it move");
  });

  it("splits lines on newlines and arrays", () => {
    const { container, rerender } = render(<GhostTraceText trigger="manual">{"Two\nlines"}</GhostTraceText>);
    expect(container.querySelectorAll('text[data-layer="ghost"]')).toHaveLength(2);
    rerender(<GhostTraceText trigger="manual">{["A", "B", "C"]}</GhostTraceText>);
    expect(container.querySelectorAll('text[data-layer="ghost"]')).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "A B C" })).toBeInTheDocument();
  });

  it("starts idle with a manual trigger and traces when play flips", () => {
    const onStart = vi.fn();
    const { rerender } = render(
      <GhostTraceText trigger="manual" onTraceStart={onStart}>
        Hello
      </GhostTraceText>,
    );
    const el = screen.getByRole("heading");
    expect(el).toHaveAttribute("data-state", "idle");
    rerender(
      <GhostTraceText trigger="manual" play onTraceStart={onStart}>
        Hello
      </GhostTraceText>,
    );
    expect(el).toHaveAttribute("data-state", "tracing");
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("traces on mount with trigger=mount", () => {
    render(<GhostTraceText trigger="mount">Hello</GhostTraceText>);
    expect(screen.getByRole("heading")).toHaveAttribute("data-state", "tracing");
  });

  it("traces when it enters the viewport by default (stubbed observer reports visible)", () => {
    render(<GhostTraceText>Hello</GhostTraceText>);
    expect(screen.getByRole("heading")).toHaveAttribute("data-state", "tracing");
  });

  it("renders plain filled text under reduced motion and off", () => {
    const { container, rerender } = render(<GhostTraceText motion="reduced">{"Plain\ntext"}</GhostTraceText>);
    const h = screen.getByRole("heading", { name: "Plain text" });
    expect(h).toHaveAttribute("data-motion", "reduced");
    expect(h).toHaveAttribute("data-state", "settled");
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.querySelector("br")).toBeInTheDocument();
    rerender(<GhostTraceText motion="off">Plain</GhostTraceText>);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("honours prefers-reduced-motion", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    try {
      const { container } = render(<GhostTraceText>Hi</GhostTraceText>);
      expect(container.querySelector("svg")).not.toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it("forwards refs, classes and attributes", () => {
    const ref = { current: null as HTMLElement | null };
    render(
      <GhostTraceText ref={ref} as="p" className="display" id="hero" trigger="manual">
        Hi
      </GhostTraceText>,
    );
    expect(ref.current?.tagName).toBe("P");
    expect(ref.current).toHaveClass("display");
    expect(ref.current).toHaveAttribute("id", "hero");
  });

  it("unmounts cleanly mid-trace", () => {
    const { unmount } = render(<GhostTraceText trigger="mount">Bye</GhostTraceText>);
    expect(() => unmount()).not.toThrow();
  });
});
