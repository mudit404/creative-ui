import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { OrbitalMenu, OrbitalMenuItem, OrbitalMenuRing, OrbitalMenuTrigger } from "./orbital-menu";

function Menu(props: Partial<React.ComponentProps<typeof OrbitalMenu>> & { onSelect?: (l: string) => void } = {}) {
  const { onSelect, ...rest } = props;
  return (
    <OrbitalMenu motion="off" {...rest}>
      <OrbitalMenuTrigger aria-label="Actions" />
      <OrbitalMenuRing>
        <OrbitalMenuItem label="Write" onSelect={() => onSelect?.("Write")}>
          W
        </OrbitalMenuItem>
        <OrbitalMenuItem label="Share" onSelect={() => onSelect?.("Share")}>
          S
        </OrbitalMenuItem>
        <OrbitalMenuItem label="Archive" disabled>
          A
        </OrbitalMenuItem>
        <OrbitalMenuItem label="Delete" onSelect={() => onSelect?.("Delete")}>
          D
        </OrbitalMenuItem>
      </OrbitalMenuRing>
    </OrbitalMenu>
  );
}

describe("OrbitalMenu", () => {
  it("has menu button semantics and opens on click", async () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeDisabled();
  });

  it("opens from the keyboard and focuses the first item", async () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Write" })).toHaveFocus());
  });

  it("moves around the ring with arrows, skipping disabled items, and closes with Escape returning focus", async () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Write" })).toHaveFocus());
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("menuitem", { name: "Share" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus(); // Archive skipped
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("menuitem", { name: "Write" })).toHaveFocus(); // wraps
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Share" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("selects with click and Enter and closes on select", async () => {
    const onSelect = vi.fn();
    render(<Menu onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onSelect).toHaveBeenCalledWith("Share");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Write" })).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("Write");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("stays open after select with closeOnSelect=false", async () => {
    render(<Menu closeOnSelect={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on outside pointer down", async () => {
    render(
      <>
        <Menu />
        <button type="button">Elsewhere</button>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("supports controlled open state", async () => {
    function Parent() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Menu open={open} onOpenChange={setOpen} />
          <span data-testid="state">{open ? "open" : "closed"}</span>
        </>
      );
    }
    render(<Parent />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByTestId("state")).toHaveTextContent("open");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("lays items out around the ring at distinct angles", async () => {
    render(<Menu defaultOpen radius={100} sweep={360} startAngle={-90} />);
    const wrappers = () =>
      screen.getAllByRole("menuitem").map((el) => el.closest('[data-slot="orbital-menu-ring"] > span') as HTMLElement);
    await waitFor(() => expect(new Set(wrappers().map((w) => w.style.transform)).size).toBe(4));
    // first item straight up: y ≈ -100
    await waitFor(() => expect(wrappers()[0]!.style.transform).toContain("translateY(-100px)"));
  });

  it("renders labels when asked and reports motion mode", async () => {
    const { container } = render(<Menu defaultOpen showLabels motion="reduced" />);
    expect(screen.getByText("Write")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="orbital-menu"]')).toHaveAttribute("data-motion", "reduced");
  });

  it("unmounts cleanly while open", () => {
    const { unmount } = render(<Menu defaultOpen motion="auto" />);
    act(() => {
      expect(() => unmount()).not.toThrow();
    });
  });
});
