import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FlowStackGallery, type FlowStackItem } from "./flow-stack-gallery";

const ITEMS: FlowStackItem[] = Array.from({ length: 5 }, (_, i) => ({
  id: `i${i + 1}`,
  src: `/img/${i + 1}.jpg`,
  alt: `Photo ${i + 1}`,
  caption: `Caption ${i + 1}`,
}));

const topImage = () => {
  const panel = screen.getByRole("tabpanel");
  return panel.querySelector('[data-offset="0"] img') as HTMLImageElement;
};

describe("FlowStackGallery", () => {
  it("renders tabs for thumbnails and a tabpanel viewer", () => {
    render(<FlowStackGallery items={ITEMS} label="Lookbook" motion="off" />);
    expect(screen.getByRole("group", { name: "Lookbook" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0]!.id);
    expect(topImage()).toHaveAttribute("alt", "Photo 1");
    expect(screen.getByText("Caption 1")).toBeInTheDocument();
    // deck shows the following images behind, hidden from AT
    expect(panel.querySelectorAll("[data-offset]")).toHaveLength(4);
    expect(panel.querySelector('[data-offset="1"] img')).toHaveAttribute("aria-hidden", "true");
  });

  it("selects by clicking a thumbnail", async () => {
    const onChange = vi.fn();
    render(<FlowStackGallery items={ITEMS} label="L" motion="off" onIndexChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Photo 3" }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("tab", { name: "Photo 3" })).toHaveAttribute("aria-selected", "true");
    expect(topImage()).toHaveAttribute("alt", "Photo 3");
    expect(screen.getByText("Caption 3")).toBeInTheDocument();
  });

  it("moves with arrow keys on the strip, Home and End", async () => {
    render(<FlowStackGallery items={ITEMS} label="L" motion="off" />);
    const first = screen.getByRole("tab", { name: "Photo 1" });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Photo 2" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Photo 2" })).toHaveFocus());
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Photo 5" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}"); // loops
    expect(screen.getByRole("tab", { name: "Photo 1" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Photo 1" })).toHaveAttribute("aria-selected", "true");
  });

  it("navigates with next/previous buttons and viewer arrow keys", async () => {
    render(<FlowStackGallery items={ITEMS} label="L" motion="off" />);
    await userEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(topImage()).toHaveAttribute("alt", "Photo 2");
    await userEvent.click(screen.getByRole("button", { name: "Previous image" }));
    expect(topImage()).toHaveAttribute("alt", "Photo 1");
    await userEvent.click(screen.getByRole("button", { name: "Previous image" })); // loops back
    expect(topImage()).toHaveAttribute("alt", "Photo 5");
    screen.getByRole("tabpanel").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(topImage()).toHaveAttribute("alt", "Photo 1");
  });

  it("disables the edges without loop", async () => {
    render(<FlowStackGallery items={ITEMS} label="L" motion="off" loop={false} />);
    expect(screen.getByRole("button", { name: "Previous image" })).toBeDisabled();
    await userEvent.click(screen.getByRole("tab", { name: "Photo 5" }));
    expect(screen.getByRole("button", { name: "Next image" })).toBeDisabled();
  });

  it("supports controlled index", async () => {
    function Parent() {
      const [i, setI] = useState(1);
      return (
        <>
          <FlowStackGallery items={ITEMS} label="L" motion="off" index={i} onIndexChange={setI} />
          <span data-testid="i">{i}</span>
        </>
      );
    }
    render(<Parent />);
    expect(topImage()).toHaveAttribute("alt", "Photo 2");
    await userEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByTestId("i")).toHaveTextContent("2");
    expect(topImage()).toHaveAttribute("alt", "Photo 3");
  });

  it("reports its motion mode and announces position", () => {
    render(<FlowStackGallery items={ITEMS} label="L" motion="reduced" defaultIndex={3} />);
    expect(screen.getByRole("group")).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByRole("group")).toHaveAttribute("data-index", "3");
    expect(screen.getByText("Image 4 of 5")).toBeInTheDocument();
  });

  it("handles an empty list and a single item", () => {
    const { rerender } = render(<FlowStackGallery items={[]} label="L" motion="off" />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    rerender(<FlowStackGallery items={ITEMS.slice(0, 1)} label="L" motion="off" />);
    expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel").querySelectorAll("[data-offset]")).toHaveLength(1);
  });
});
