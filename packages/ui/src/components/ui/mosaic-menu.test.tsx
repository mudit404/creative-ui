import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MosaicMenu, MosaicMenuTrigger, type MosaicTile } from "./mosaic-menu";

const TILES: MosaicTile[] = [
  { id: "work", href: "/work", title: "Work", span: 2 },
  { id: "studio", href: "/studio", title: "Studio", current: true },
  { id: "journal", href: "/journal", title: "Journal" },
  { id: "contact", href: "/contact", title: "Contact" },
];

function Menu(props: Partial<React.ComponentProps<typeof MosaicMenu>> = {}) {
  return (
    <MosaicMenu tiles={TILES} label="Site menu" motion="off" footer={<span>hello@studio.example</span>} {...props}>
      <MosaicMenuTrigger />
    </MosaicMenu>
  );
}

describe("MosaicMenu", () => {
  it("has a dialog trigger and opens a modal dialog in a portal", async () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Site menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);
    expect(screen.getByRole("navigation", { name: "Site menu" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Work", "Studio", "Journal", "Contact"]);
    expect(screen.getByRole("link", { name: "Studio" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("hello@studio.example")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("focuses the current tile on open, closes on Escape and returns focus", async () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("link", { name: "Studio" })).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("traps Tab inside the dialog", async () => {
    render(<Menu />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Studio" })).toHaveFocus());
    const close = screen.getByRole("button", { name: "Close menu" });
    close.focus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("link", { name: "Contact" })).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
  });

  it("moves between tiles with arrow keys, Home and End", async () => {
    render(<Menu />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Studio" })).toHaveFocus());
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("link", { name: "Journal" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("link", { name: "Work" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("link", { name: "Work" })).toHaveFocus();
    // jsdom has no layout, so every tile shares a row: Down jumps to the end, Up back to the start
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("link", { name: "Work" })).toHaveFocus();
  });

  it("closes on the close button, the backdrop, and after navigating (unless kept open)", async () => {
    const onNavigate = vi.fn(() => false);
    const { rerender } = render(<Menu />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.pointer({ keys: "[MouseLeft]", target: document.querySelector('[data-slot="mosaic-menu-overlay"]') as Element });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("link", { name: "Journal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<Menu onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("link", { name: "Journal" }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: "journal" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("supports controlled open state and a custom link component", async () => {
    const Fancy = ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={href} data-fancy {...rest}>
        {children}
      </a>
    );
    function Parent() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Menu open={open} onOpenChange={setOpen} linkComponent={Fancy} />
          <span data-testid="state">{open ? "open" : "closed"}</span>
        </>
      );
    }
    render(<Parent />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("data-fancy");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("spans tiles and reports motion mode", async () => {
    render(<Menu motion="reduced" defaultOpen />);
    const work = screen.getByRole("link", { name: "Work" }).closest("li") as HTMLElement;
    expect(work.style.gridColumn).toBe("span 2");
    expect(document.querySelector('[data-slot="mosaic-menu-overlay"]')).toHaveAttribute("data-motion", "reduced");
  });
});
