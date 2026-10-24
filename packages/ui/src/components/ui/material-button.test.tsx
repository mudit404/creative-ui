import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MaterialButton } from "./material-button";

describe("MaterialButton", () => {
  it("renders a real button with its label", () => {
    render(<MaterialButton>Let’s collaborate</MaterialButton>);
    const btn = screen.getByRole("button", { name: "Let’s collaborate" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "button");
  });

  it("fires onClick and forwards native attributes", async () => {
    const onClick = vi.fn();
    render(
      <MaterialButton onClick={onClick} id="cta" data-testid="cta" title="Go">
        Go
      </MaterialButton>,
    );
    const btn = screen.getByTestId("cta");
    expect(btn).toHaveAttribute("id", "cta");
    expect(btn).toHaveAttribute("title", "Go");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates from the keyboard", async () => {
    const onClick = vi.fn();
    render(<MaterialButton onClick={onClick}>Go</MaterialButton>);
    const btn = screen.getByRole("button");
    btn.focus();
    expect(btn).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does not activate when disabled", async () => {
    const onClick = vi.fn();
    render(
      <MaterialButton disabled onClick={onClick}>
        Go
      </MaterialButton>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("announces loading and blocks activation", async () => {
    const onClick = vi.fn();
    render(
      <MaterialButton loading onClick={onClick}>
        Save
      </MaterialButton>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    // label stays in the accessible name while visually hidden
    expect(btn).toHaveAccessibleName("Save");
  });

  it("forwards refs to the underlying button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<MaterialButton ref={ref}>Ref</MaterialButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("renders the child as the control with asChild", () => {
    render(
      <MaterialButton asChild>
        <a href="/pricing">Pricing</a>
      </MaterialButton>,
    );
    const link = screen.getByRole("link", { name: "Pricing" });
    expect(link).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies colour overrides as CSS variables", () => {
    const { container } = render(
      <MaterialButton colors={{ surface: "#123456", label: "#abcdef" }}>Tinted</MaterialButton>,
    );
    const root = container.querySelector('[data-slot="material-button"]') as HTMLElement;
    expect(root.style.getPropertyValue("--mb-surface")).toBe("#123456");
    expect(root.style.getPropertyValue("--mb-label")).toBe("#abcdef");
    // goo follows the surface unless set explicitly
    expect(root.style.getPropertyValue("--mb-goo")).toBe("#123456");
  });

  it("mounts the goo canvas only when full motion is allowed", () => {
    const { container, rerender } = render(<MaterialButton>Go</MaterialButton>);
    expect(container.querySelector("canvas")).toBeInTheDocument();
    rerender(<MaterialButton motion="reduced">Go</MaterialButton>);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    rerender(<MaterialButton motion="off">Go</MaterialButton>);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    rerender(<MaterialButton disabled>Go</MaterialButton>);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
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
      const { container } = render(<MaterialButton>Go</MaterialButton>);
      expect(container.querySelector("canvas")).not.toBeInTheDocument();
      expect(container.querySelector('[data-slot="material-button"]')).toHaveAttribute(
        "data-motion",
        "reduced",
      );
    } finally {
      window.matchMedia = original;
    }
  });

  it("merges class names on the control and the wrapper", () => {
    const { container } = render(
      <MaterialButton className="custom-btn" wrapperClassName="w-full">
        Go
      </MaterialButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("custom-btn");
    expect(container.querySelector('[data-slot="material-button"]')).toHaveClass("w-full");
  });

  it("unmounts cleanly while animating", () => {
    const { unmount } = render(<MaterialButton idle>Go</MaterialButton>);
    expect(() => unmount()).not.toThrow();
  });
});
