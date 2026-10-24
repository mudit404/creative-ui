import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { AdaptiveRail, AdaptiveRailItem, AdaptiveRailSeparator } from "./adaptive-rail";

function Rail(props: Partial<React.ComponentProps<typeof AdaptiveRail>> = {}) {
  return (
    <AdaptiveRail label="Actions" motion="off" {...props}>
      <AdaptiveRailItem label="Home" priority>
        H
      </AdaptiveRailItem>
      <AdaptiveRailItem label="Search">S</AdaptiveRailItem>
      <AdaptiveRailSeparator />
      <AdaptiveRailItem label="Delete" contexts={["selection"]}>
        D
      </AdaptiveRailItem>
      <AdaptiveRailItem label="Profile" href="/me" active>
        P
      </AdaptiveRailItem>
    </AdaptiveRail>
  );
}

function scrollWindowTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
  window.dispatchEvent(new Event("scroll"));
}

describe("AdaptiveRail", () => {
  it("is a labelled toolbar with named items", () => {
    render(<Rail />);
    const bar = screen.getByRole("toolbar", { name: "Actions" });
    expect(bar).toHaveAttribute("aria-orientation", "horizontal");
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(bar).toHaveAttribute("data-state", "expanded");
  });

  it("scopes items to a context", () => {
    const { rerender } = render(<Rail />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    rerender(<Rail context="selection" />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("collapses to priority items while scrolling down and expands on scroll up", async () => {
    vi.useFakeTimers();
    try {
      render(<Rail />);
      const bar = screen.getByRole("toolbar");
      act(() => scrollWindowTo(0));
      act(() => scrollWindowTo(300));
      expect(bar).toHaveAttribute("data-state", "collapsed");
      expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
      act(() => scrollWindowTo(100));
      expect(bar).toHaveAttribute("data-state", "expanded");
      expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
      // idle after scrolling down also expands
      act(() => scrollWindowTo(400));
      expect(bar).toHaveAttribute("data-state", "collapsed");
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(bar).toHaveAttribute("data-state", "expanded");
    } finally {
      vi.useRealTimers();
      scrollWindowTo(0);
    }
  });

  it("hides instead of collapsing with behavior=hide, and never with static", () => {
    const { rerender } = render(<Rail behavior="hide" />);
    act(() => scrollWindowTo(0));
    act(() => scrollWindowTo(300));
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-state", "hidden");
    rerender(<Rail behavior="static" />);
    act(() => scrollWindowTo(600));
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-state", "expanded");
    scrollWindowTo(0);
  });

  it("stays expanded while it holds focus and when expanded is forced", () => {
    const { rerender } = render(<Rail />);
    act(() => scrollWindowTo(0));
    screen.getByRole("button", { name: "Home" }).focus();
    act(() => scrollWindowTo(300));
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-state", "expanded");
    (document.activeElement as HTMLElement).blur();
    rerender(<Rail expanded />);
    act(() => scrollWindowTo(600));
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-state", "expanded");
    scrollWindowTo(0);
  });

  it("moves focus with arrow keys, Home and End", async () => {
    render(<Rail context="selection" />);
    const home = screen.getByRole("button", { name: "Home" });
    home.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(home).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(home).toHaveFocus();
  });

  it("uses vertical arrows for left/right placements", async () => {
    render(<Rail placement="left" />);
    expect(screen.getByRole("toolbar")).toHaveAttribute("aria-orientation", "vertical");
    screen.getByRole("button", { name: "Home" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Search" })).toHaveFocus();
  });

  it("fires item clicks and forwards refs", async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <AdaptiveRail label="x" ref={ref} motion="off">
        <AdaptiveRailItem label="Go" onClick={onClick}>
          G
        </AdaptiveRailItem>
      </AdaptiveRail>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("shows labels when asked", async () => {
    render(<Rail showLabels />);
    await waitFor(() => expect(screen.getByText("Search")).toBeInTheDocument());
  });

  it("reports its motion mode", () => {
    const { rerender } = render(<Rail motion="reduced" />);
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-motion", "reduced");
    rerender(<Rail motion="auto" />);
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-motion", "full");
  });
});
