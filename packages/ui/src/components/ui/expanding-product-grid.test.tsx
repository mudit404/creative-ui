import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ExpandingProductCard, ExpandingProductGrid } from "./expanding-product-grid";

const PRODUCTS = [
  { id: "p1", title: "Field jacket", price: "$240", detail: "Waxed cotton, three pockets." },
  { id: "p2", title: "Trail boot", price: "$310", detail: "Full-grain leather, resoleable." },
  { id: "p3", title: "Merino crew", price: "$95", detail: "Extra-fine 18.5 micron merino." },
];

function Grid(props: Partial<React.ComponentProps<typeof ExpandingProductGrid>> = {}) {
  return (
    <ExpandingProductGrid aria-label="Products" motion="off" {...props}>
      {PRODUCTS.map((p) => (
        <ExpandingProductCard
          key={p.id}
          id={p.id}
          title={p.title}
          media={<img src="" alt="" />}
          summary={<span>{p.price}</span>}
          detail={<p>{p.detail}</p>}
          disabled={p.id === "p3"}
        />
      ))}
    </ExpandingProductGrid>
  );
}

describe("ExpandingProductGrid", () => {
  it("renders articles with expand buttons, all collapsed", () => {
    render(<Grid />);
    expect(screen.getByRole("list", { name: "Products" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    for (const p of PRODUCTS) {
      expect(screen.getByRole("button", { name: p.title })).toHaveAttribute("aria-expanded", "false");
    }
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Merino crew" })).toBeDisabled();
  });

  it("expands a card in place, spanning the row, and moves focus to Close", async () => {
    render(<Grid />);
    const btn = screen.getByRole("button", { name: "Field jacket" });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: "Field jacket" });
    expect(btn).toHaveAttribute("aria-controls", region.id);
    expect(region).toHaveTextContent("Waxed cotton");
    const li = btn.closest("li")!;
    expect(li).toHaveAttribute("data-state", "expanded");
    expect(li.style.gridColumn).toBe("1 / -1");
    expect(screen.getByRole("list")).toHaveAttribute("data-expanded", "p1");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    // summary hidden while expanded
    expect(screen.queryByText("$240")).not.toBeInTheDocument();
  });

  it("opens one card at a time and swaps on another trigger", async () => {
    render(<Grid />);
    await userEvent.click(screen.getByRole("button", { name: "Field jacket" }));
    await userEvent.click(screen.getByRole("button", { name: "Trail boot" }));
    expect(screen.getByRole("button", { name: "Field jacket" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Trail boot" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("region")).toHaveLength(1);
  });

  it("collapses with the close button, Escape and the header, returning focus", async () => {
    render(<Grid />);
    const btn = screen.getByRole("button", { name: "Field jacket" });
    await userEvent.click(btn);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(btn).toHaveFocus());

    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await waitFor(() => expect(btn).toHaveFocus());

    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("supports controlled state and reports changes", async () => {
    const onChange = vi.fn();
    function Parent() {
      const [id, setId] = useState<string | null>("p2");
      return (
        <Grid
          expandedId={id}
          onExpandedChange={(v) => {
            onChange(v);
            setId(v);
          }}
        />
      );
    }
    render(<Parent />);
    expect(screen.getByRole("button", { name: "Trail boot" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("button", { name: "Field jacket" }));
    expect(onChange).toHaveBeenLastCalledWith("p1");
    expect(screen.getByRole("button", { name: "Field jacket" })).toHaveAttribute("aria-expanded", "true");
  });

  it("uses defaultExpandedId and reports its motion mode", () => {
    render(<Grid defaultExpandedId="p1" motion="reduced" />);
    expect(screen.getByRole("region", { name: "Field jacket" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveAttribute("data-motion", "reduced");
  });

  it("sets the auto-fill track template from minCardWidth", () => {
    render(<Grid minCardWidth={240} gap={20} />);
    const list = screen.getByRole("list");
    expect(list.style.gridTemplateColumns).toContain("240px");
    expect(list.style.gap).toBe("20px");
  });
});
